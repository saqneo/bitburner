import { getAllNodes } from '/lib/map.js';
import { checkTransition } from '/lib/progression.js';
import { getCost } from '/lib/cost.js';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.print("Stage: EARLY GAME (Lightweight Dispatcher) started.");

    const WORKER_SCRIPT = "/hack/early-hack.js";

    // Initial deploy of libs (via auxiliary script)
    const deployPid = ns.exec("/util/deploy-all.js", "home");
    if (deployPid) {
        ns.tprint("Waiting for initial deployment...");
        while (ns.isRunning(deployPid, "home")) {
            await ns.sleep(100);
        }
    }

    while (true) {
        // 1. Infrastructure & Expansion (Non-blocking, delegated to any free node)
        const nodes = getAllNodes(ns);
        await delegateInfrastructure(ns, nodes);

        // 2. Dispatcher Loop
        const hosts = getAllNodes(ns);
        const target = getBestTarget(ns, hosts);
        
        if (target) {
            // Light reporting for external HUD
            ns.write("/data/target.txt", target, "w");

            for (const host of hosts) {
                if (!ns.hasRootAccess(host)) continue;

                const scriptRam = ns.getScriptRam(WORKER_SCRIPT);
                const maxRam = ns.getServerMaxRam(host);
                const usedRam = ns.getServerUsedRam(host);
                let availableRam = maxRam - usedRam;

                // Reserve RAM on home for this controller script
                if (host === "home") {
                    // Controller uses ~7GB now due to hackAnalyzeChance
                    const RESERVED_HOME = 7.5; 
                    availableRam = Math.max(0, availableRam - RESERVED_HOME);
                }

                const threads = Math.floor(availableRam / scriptRam);

                if (threads > 0) {
                    ns.print(`Can deploy threads=${threads} of '${WORKER_SCRIPT} ${target}' to '${host}' with ${availableRam} RAM.`)
                    ns.print(`${ns.exec(WORKER_SCRIPT, host, threads, target)}`)
                }
            }
        }

        // 4. State Transition Check
        const nextStage = checkTransition(ns, "early");
        if (nextStage) {
            ns.tprint(`SUCCESS: Early Game Goals Met. Transitioning to '${nextStage}'.`);
            ns.write("/data/state.txt", nextStage, "w");
            ns.spawn("/daemon.js");
        }

        // Sleep shorter because we want to catch free slots as soon as workers finish
        await ns.sleep(500);
    }
}

/**
 * Selects the best target based on Profit per Second.
 * @param {NS} ns
 * @param {string[]} hosts 
 * @returns {string|null}
 */
function getBestTarget(ns, hosts) {
    const playerHackLevel = ns.getHackingLevel();
    let bestTarget = null;
    let maxScore = 0;

    for (const host of hosts) {
        if (host === 'home' || host.startsWith('owned-')) continue;
        if (!ns.hasRootAccess(host)) continue;
        if (ns.getServerRequiredHackingLevel(host) > playerHackLevel) continue;
        if (ns.getServerMaxMoney(host) <= 0) continue;

        // Calculate score: Profit per Thread-Second
        // Money * HackChance * HackPercent / Time
        const money = ns.getServerMaxMoney(host);
        const chance = ns.hackAnalyzeChance(host);
        const time = ns.getHackTime(host);
        const percent = ns.hackAnalyze(host);
        
        if (time === 0 || percent === 0) continue;

        const score = (money * chance * percent) / time;

        if (score > maxScore) {
            maxScore = score;
            bestTarget = host;
        }
    }

    ns.print(`Found bestTarget '${bestTarget}'.`)
    return bestTarget;
}

/**
 * Delegates infrastructure tasks.
 * @param {NS} ns 
 * @param {string[]} hosts
 */
async function delegateInfrastructure(ns, hosts) {
    // 1. Critical Expansion (Spread & Deploy)
    // Always attempt to run these if not running.
    await runDelegate(ns, '/util/spread.js', hosts);
    await runDelegate(ns, '/util/deploy-all.js', hosts);

    // 2. Purchasing (Cost-based)
    const serverCost = getCost(ns, 'server') || 55000;
    if (ns.getServerMoneyAvailable("home") > serverCost) {
        await runDelegate(ns, '/util/purchase-server.js', hosts);
    }

    const hacknetCost = getCost(ns, 'hacknet') || 1000;
    if (ns.getServerMoneyAvailable("home") > hacknetCost) {
         await runDelegate(ns, '/util/upgrade-hacknet.js', hosts);
    }

    // 3. Contracts (Occasional)
    if (Math.random() < 0.05) { // ~ every 20 loops (10s)
         await runDelegate(ns, '/util/solve-contracts.js', hosts);
    }
}

async function runDelegate(ns, script, hosts) {
    for (const h of hosts) {
        if (ns.isRunning(script, h)) return;
    }

    const ram = ns.getScriptRam(script);
    // Simple find first fit to save sort RAM
    for (const host of hosts) {
        if (!ns.hasRootAccess(host)) continue;
        if ((ns.getServerMaxRam(host) - ns.getServerUsedRam(host)) >= ram) {
             ns.exec(script, host, 1);
             return;
        }
    }
}