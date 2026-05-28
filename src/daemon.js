import { getAllNodes } from '/lib/map.js';
import { checkTransition, getStartupStage } from '/lib/progression.js';
import { spread } from '/lib/spread.js';
import { getRankedTargets, getNextAction } from '/lib/target-analysis.js';
import { distribute, runDelegate, delegateInfrastructure, manageShare } from '/lib/dispatch.js';
import { MAINTENANCE_INTERVAL_MS } from '/lib/constants.js';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    // --- 1. BOOTSTRAP ---
    ns.tprint("Daemon: Boot sequence started. Run 'help.js' (alias: h) for the recovery guide and system usage.");
    ns.tprint("Daemon: Stages: EARLY (serial, <1TB home) → MIDGAME (concurrent batcher, ≥1TB home).");

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
    runDelegate(ns, '/util/cleanup.js', nodes);
    runDelegate(ns, '/util/deploy-all.js', nodes);

    // --- 2. MAIN LOOP ---
    let stage = getStartupStage(ns);
    ns.tprint(`Daemon: Startup Stage determined as '${stage}'.`);

    while (true) {
        if (stage === "early") {
            const next = await runEarly(ns);
            if (next) stage = next;
        } else if (stage === "midgame") {
            ns.tprint("Daemon: Transitioning to Midgame Concurrent Batcher...");
            ns.tprint("Daemon: Launching /stages/midgame.js on home and exiting.");
            ns.exec('/stages/midgame.js', 'home', 1);
            return; // Exit daemon to free its RAM for the midgame script
        } else {
            ns.tprint(`Daemon: Unknown stage '${stage}'. Exiting.`);
            return;
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

        // Dispatch Loop (serial: one action per target at a time)
        for (const target of targets) {
            // Skip if currently busy
            if (tracked.has(target) && ns.isRunning(tracked.get(target))) {
                continue;
            }

            // Decide Action via Strategy
            const plan = getNextAction(ns, target);

            if (plan) {
                const pid = distribute(ns, plan.script, plan.threads, target, hosts, { ramCapPct: 0.5 });
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