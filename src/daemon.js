import { getAllNodes } from '/lib/map.js';
import { checkTransition, getStartupStage } from '/lib/progression.js';
import { getCost } from '/lib/cost.js';
import { spread } from '/lib/spread.js';
import { getRankedTargets, getNextAction } from '/lib/target-analysis.js';
import { MAINTENANCE_INTERVAL_MS } from '/lib/constants.js';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    // --- 1. BOOTSTRAP ---
    ns.tprint("Daemon: Boot sequence started. Run 'help.js' (alias: h) for the recovery guide and system usage.");

    // --- 1.1 CLEANUP ---
    // Clear temporary data from previous runs to prevent stale state (e.g. costs)
    ns.print("Daemon: Clearing /tmp/ directory...");
    try {
        ns.rm("/tmp/", "home", { recursive: true });
    } catch (e) {
        // ns.rm throws an error if the directory doesn't exist. This is expected and harmless.
    }

    // Initial Setup
    ns.print("Daemon: Running initial network spread...");
    while (spread(ns)) await ns.sleep(50);

    // Offload heavy maintenance tasks (cleanup, deploy) to the network to save RAM on home/daemon.
    // These will run on any available node (e.g., n00dles).
    ns.print("Daemon: Delegating cleanup and deployment...");
    const nodes = getAllNodes(ns);
    await runDelegate(ns, '/util/cleanup.js', nodes);
    await runDelegate(ns, '/util/deploy-all.js', nodes);

    // --- 2. MAIN LOOP ---
    let stage = getStartupStage(ns);
    ns.tprint(`Daemon: Startup Stage determined as '${stage}'.`);

    while (true) {
        if (stage === "early") {
            const next = await runEarly(ns);
            if (next) stage = next;
        } else {
            ns.tprint(`Daemon: Transition to stage '${stage}' requested.`);
            ns.tprint("CRITICAL: Auto-spawn removed to save RAM. Please run the next stage script manually.");
            return; // Exit to allow manual start
        }

        await ns.sleep(100);
    }
}

/** @param {NS} ns */
async function runEarly(ns) {
    ns.print("Stage: EARLY GAME Controller active.");

    const tracked = new Map(); // target -> pid
    let nextMaintenance = 0;

    while (true) {
        const hosts = getAllNodes(ns);
        const targets = getRankedTargets(ns, hosts);

        // Infrastructure: Run periodically (every 1 minute)
        if (Date.now() > nextMaintenance) {
            await delegateInfrastructure(ns, hosts);
            if (targets.length > 0) {
                ns.print(`Daemon: Top Targets: [${targets.slice(0, 3).join(", ")}]`);
            }
            nextMaintenance = Date.now() + MAINTENANCE_INTERVAL_MS;
        }

        // Dispatch Loop
        for (const target of targets) {
            // Skip if currently busy
            if (tracked.has(target) && ns.isRunning(tracked.get(target))) {
                continue;
            }

            // Decide Action via Strategy
            const plan = getNextAction(ns, target);

            if (plan) {
                const pid = await distribute(ns, plan.script, plan.threads, target, hosts);
                if (pid > 0) {
                    tracked.set(target, pid);
                }
            }
        }

        // C. State Transition Check
        const nextStage = checkTransition(ns, "early");
        if (nextStage) {
            ns.tprint(`SUCCESS: Early Game Goals Met. Transitioning to '${nextStage}'.`);
            return nextStage;
        }

        // D. Utilize Remaining Home RAM for Sharing
        manageShare(ns);

        await ns.sleep(500);
    }
}

// readState function removed as it is no longer used.

/**
 * Distributes threads of a script across available hosts.
 * @param {NS} ns
 * @param {string} script
 * @param {number} needed
 * @param {string} target
 * @param {string[]} hosts
 * @returns {Promise<number>} The PID of the LAST successfully launched instance (to track completion).
 */
async function distribute(ns, script, needed, target, hosts) {
    let remaining = needed;
    let lastPid = 0;
    const ramCost = ns.getScriptRam(script);

    // Standard strategy: Fill efficiently.
    for (const host of hosts) {
        if (remaining <= 0) break;
        if (host === "home") continue; // Skip home for workers
        if (!ns.hasRootAccess(host)) continue;

        const maxRam = ns.getServerMaxRam(host);
        const usedRam = ns.getServerUsedRam(host);
        let available = maxRam - usedRam;

        if (available < ramCost) continue;

        let threads = Math.floor(available / ramCost);
        if (threads > remaining && remaining !== Infinity) {
            threads = remaining;
        }

        if (threads > 0) {
            const pid = ns.exec(script, host, threads, target);
            if (pid > 0) {
                lastPid = pid;
                if (remaining !== Infinity) remaining -= threads;
            }
        }
    }
    return lastPid;
}

/**
 * Maximize share power on home with remaining RAM.
 * Delegated to external script to save Daemon RAM.
 * @param {NS} ns
 */
function manageShare(ns) {
    // Fire and forget the manager script.
    // It handles calculation, killing old instances, and maximizing threads.
    // We use exec to avoid the RAM cost of ns.run()
    if (ns.getServerMaxRam("home") - ns.getServerUsedRam("home") > 2.0) {
        ns.exec("/util/start-share.js", "home"); // default 1 thread
    }
}

/**
 * Delegates infrastructure tasks.
 * @param {NS} ns 
 * @param {string[]} hosts
 */
async function delegateInfrastructure(ns, hosts) {
    ns.print("Daemon: Triggering periodic maintenance (Contracts/Spread/Deploy)...");

    // 1. Solve Contracts FIRST (Cluster-wide)
    // By running this first, it gets 'first pick' of available RAM on rooted nodes.
    const pid = await runDelegate(ns, '/util/solve-contracts.js', hosts);
    if (pid > 0) {
        // We poll for completion because ns.exec is fire-and-forget.
        // We need the contract cash to be IN the wallet before the purchasing logic checks affordability.
        ns.print("Daemon: Waiting for cluster to finish contract solving...");
        while (ns.isRunning(pid)) await ns.sleep(100);
    }

    // 2. Network Maintenance
    await runDelegate(ns, '/util/spread.js', hosts);
    await runDelegate(ns, '/util/deploy-all.js', hosts);

    // 3. Purchasing (Uses cash, potentially from step 1)
    const serverCost = getCost(ns, 'server') || 55000;
    if (ns.getServerMoneyAvailable("home") > serverCost) {
        await runDelegate(ns, '/util/purchase-server.js', hosts);
    }

    const hacknetCost = getCost(ns, 'hacknet') || 1000;
    if (ns.getServerMoneyAvailable("home") > hacknetCost) {
        await runDelegate(ns, '/util/upgrade-hacknet.js', hosts);
    }
}

async function runDelegate(ns, script, hosts) {
    const ram = ns.getScriptRam(script);
    for (const host of hosts) {
        if (ns.isRunning(script, host)) return 0;

        if (ns.hasRootAccess(host) && (ns.getServerMaxRam(host) - ns.getServerUsedRam(host)) >= ram) {
            const pid = ns.exec(script, host, 1);
            return pid;
        }
    }
    return 0;
}