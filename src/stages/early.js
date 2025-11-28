import { getAllNodes } from '/lib/map.js';
import { checkTransition } from '/lib/progression.js';
import { getCost } from '/lib/cost.js';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.print("Stage: EARLY GAME (Lightweight Dispatcher) started.");

    const WORKER_SCRIPT = "/hack/early-hack.js";

    // Helper to launch auxiliary scripts without importing them (saves RAM)
    const launchAux = (script) => {
        if (!ns.isRunning(script, "home")) {
            ns.exec(script, "home");
        }
    };

    // Initial deploy of libs (via auxiliary script)
    // We need to make sure this exists.
    // For now, we assume deployLibs logic is in a script. We will create /util/deploy-all.js
    launchAux("/util/deploy-all.js");

    while (true) {
        // 1. Spread (Root access) - offloaded to save RAM
        launchAux("/hack/spread.js");
        
        // 2. Infrastructure (Non-blocking)
        await delegateInfrastructure(ns, getAllNodes(ns));

        // 3. Dispatcher Loop
        const hosts = getAllNodes(ns);
        const target = getBestTarget(ns, hosts);
        
        if (target) {
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
                    ns.exec(WORKER_SCRIPT, host, threads, target);
                }
            }
        }

        // 4. State Transition Check
        const nextStage = checkTransition(ns, "early");
        if (nextStage) {
            ns.tprint(`SUCCESS: Early Game Goals Met. Transitioning to '${nextStage}'.`);
            // We don't killAll here to save RAM import. Daemon will handle it or we just spawn.
            // Actually, if we spawn, the current script dies. 
            // Daemon should probably killall on start if it switches stages.
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
        // This prioritizes servers that give the most money per RAM-second invested.
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
    return bestTarget;
}

/**
 * Delegates infrastructure tasks.
 * @param {NS} ns 
 * @param {string[]} hosts
 */
async function delegateInfrastructure(ns, hosts) {
    // Simple fire-and-forget checks
    const serverCost = getCost(ns, 'server') || 55000;
    if (ns.getServerMoneyAvailable("home") > serverCost) {
        await runDelegate(ns, '/util/purchase-server.js', hosts);
    }

    const hacknetCost = getCost(ns, 'hacknet') || 1000;
    if (ns.getServerMoneyAvailable("home") > hacknetCost) {
         await runDelegate(ns, '/util/upgrade-hacknet.js', hosts);
    }

    // Check for contracts - slightly inefficient to ls every loop but ls is fast.
    // To save RAM, we could skip this check or move it to an aux script.
    // Let's keep it simple: check home only? No, contracts spawn everywhere.
    // We can assume if we have money/ram we should run the solver occasionally.
    // Let's just try to run it every minute?
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