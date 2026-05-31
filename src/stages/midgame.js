import { getAllNodes } from '/lib/map.js';
import { distribute, manageShare, delegateInfrastructure } from '/lib/dispatch.js';
import { getRankedTargets } from '/lib/target-analysis.js';
import { 
    MAX_CONCURRENT_BATCHES, 
    HACK_FRACTION, 
    GROW_SAFETY_FACTOR, 
    MAINTENANCE_INTERVAL_MS,
    TICK_RATE_MS
} from '/lib/constants.js';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.print("Stage: MID GAME started.");
    ns.tprint("Mid Game Stage Loaded.");

    // Launch stock trader startup helper (transient execution to keep midgame RAM at 0GB extra footprint)
    ns.exec("/util/start-stock-trader.js", "home", 1);

    const activeBatches = new Map(); // target -> [weaken_pids]
    const targetStates = new Map();  // target -> "prep" | "harvest"
    const lastLaunchTimes = new Map(); // target -> timestamp
    let nextMaintenance = 0;
    let currentBatchId = 1;

    // Outer orchestrator loop
    while (true) {
        const hosts = getAllNodes(ns);
        const targets = getRankedTargets(ns, hosts);

        // Infrastructure: Run periodically
        if (Date.now() > nextMaintenance) {
            await delegateInfrastructure(ns, hosts);
            if (targets.length > 0) {
                ns.print(`Midgame: Maintenance done. Top Targets: [${targets.slice(0, 3).join(", ")}]`);
            }
            nextMaintenance = Date.now() + MAINTENANCE_INTERVAL_MS;
        }

        // Loop over ranked targets and manage their batches
        for (const target of targets) {
            if (!activeBatches.has(target)) {
                activeBatches.set(target, []);
            }

            // A. Clean up finished PIDs
            let pids = activeBatches.get(target).filter(pid => ns.isRunning(pid));
            activeBatches.set(target, pids);

            // B. Query target metrics
            const server = ns.getServer(target);
            const sec = server.hackDifficulty;
            const minSec = server.minDifficulty;
            const money = server.moneyAvailable;
            const maxMoney = server.moneyMax;

            // C. State Management
            // If the server has drifted too far (money below 80% or security above min + 0.5),
            // immediately trigger a "prep" state to let the server heal, even if PIDs are active.
            // Otherwise, if the pipeline is dry, check if we need prep or can harvest.
            const isUnprepped = (sec > minSec + 0.5) || (money < maxMoney * 0.80);
            if (isUnprepped || !targetStates.has(target)) {
                targetStates.set(target, "prep");
            } else if (pids.length === 0) {
                const needsPrep = (sec > minSec + 0.1) || (money < maxMoney * 0.90);
                targetStates.set(target, needsPrep ? "prep" : "harvest");
            }

            const state = targetStates.get(target);

            if (state === "prep") {
                // To avoid over-allocating during prep, we only run one prep batch at a time
                if (pids.length > 0) {
                    continue;
                }

                if (sec > minSec + 0.1) {
                    // Prep Security (Weaken-only)
                    const weakenThreads = Math.ceil((sec - minSec) / 0.05);
                    if (weakenThreads > 0) {
                        const batchId = currentBatchId++;
                        if (canFitBatch(ns, hosts, 0, 0, weakenThreads)) {
                            const pid = distribute(ns, "/hack/weaken.js", weakenThreads, target, hosts, { batchId });
                            if (pid > 0) {
                                pids.push(pid);
                                ns.print(`Midgame: Prepping ${target} (Security) -> Weaken x${weakenThreads} (PID: ${pid})`);
                            }
                        }
                    }
                } else if (money < maxMoney * 0.90) {
                    // Prep Money (Grow + Weaken)
                    const multiplier = maxMoney / Math.max(money, 1);
                    const baseGrowThreads = ns.growthAnalyze(target, multiplier);
                    const growThreads = Math.ceil(baseGrowThreads * GROW_SAFETY_FACTOR);
                    const growSec = ns.growthAnalyzeSecurity(growThreads, target);
                    const weakenThreads = Math.ceil(growSec / 0.05);

                    if (growThreads > 0) {
                        const batchId = currentBatchId++;
                        if (canFitBatch(ns, hosts, 0, growThreads, weakenThreads)) {
                            distribute(ns, "/hack/grow.js", growThreads, target, hosts, { batchId });
                            const pid = distribute(ns, "/hack/weaken.js", weakenThreads, target, hosts, { batchId });
                            if (pid > 0) {
                                pids.push(pid);
                                ns.print(`Midgame: Prepping ${target} (Money) -> Grow x${growThreads}, Weaken x${weakenThreads} (PID: ${pid})`);
                            }
                        }
                    }
                }
            } else {
                // Harvest Phase (HWGW Batches) - Saturation pipeline
                if (pids.length >= MAX_CONCURRENT_BATCHES) {
                    continue;
                }

                // Enforce a staggered launch spacing of 100ms per target
                // This spaces out the landing times so that batches land sequentially (H1->G1->W1->H2->G2->W2)
                const lastLaunch = lastLaunchTimes.get(target) || 0;
                if (Date.now() - lastLaunch < 100) {
                    continue;
                }

                const hackPercentPerThread = ns.hackAnalyze(target);
                if (hackPercentPerThread <= 0) continue;

                // Calculate required threads for steady-state HWGW
                const hackThreads = Math.floor(HACK_FRACTION / hackPercentPerThread);
                if (hackThreads <= 0) continue;

                const hackSec = ns.hackAnalyzeSecurity(hackThreads, target);
                const weakenThreadsForHack = Math.ceil(hackSec / 0.05);

                const baseGrowThreads = ns.growthAnalyze(target, 1 / (1 - HACK_FRACTION));
                const growThreads = Math.ceil(baseGrowThreads * GROW_SAFETY_FACTOR);
                const growSec = ns.growthAnalyzeSecurity(growThreads, target);
                const weakenThreadsForGrow = Math.ceil(growSec / 0.05);

                const weakenThreads = weakenThreadsForHack + weakenThreadsForGrow;

                // Spaced Delay Calculations
                const tWeaken = ns.getWeakenTime(target);
                const tGrow = ns.getGrowTime(target);
                const tHack = ns.getHackTime(target);
                const spacing = 25; // 25ms staggered step spacing between H, G, W components

                const weakenDelay = 0;
                const growDelay = Math.max(0, tWeaken - tGrow - spacing);
                const hackDelay = Math.max(0, tWeaken - tHack - 2 * spacing);

                if (canFitBatch(ns, hosts, hackThreads, growThreads, weakenThreads)) {
                    const batchId = currentBatchId++;
                    
                    distribute(ns, "/hack/hack.js", hackThreads, target, hosts, { batchId, delay: hackDelay });
                    distribute(ns, "/hack/grow.js", growThreads, target, hosts, { batchId, delay: growDelay });
                    const pid = distribute(ns, "/hack/weaken.js", weakenThreads, target, hosts, { batchId, delay: weakenDelay });

                    if (pid > 0) {
                        pids.push(pid);
                        lastLaunchTimes.set(target, Date.now());
                        ns.print(`Midgame: Dispatched staggered HWGW batch #${batchId} for ${target}: H=${hackThreads} (delay: ${hackDelay.toFixed(0)}ms), G=${growThreads} (delay: ${growDelay.toFixed(0)}ms), W=${weakenThreads}`);
                    }
                }
            }
        }

        // Manage Share on Home RAM
        manageShare(ns);

        // Standard tick sleep
        await ns.sleep(TICK_RATE_MS);
    }
}

/**
 * Dry-run allocator to ensure the network can fully accommodate the threads of a batch.
 * @param {NS} ns
 * @param {string[]} hosts
 * @param {number} hackThreads
 * @param {number} growThreads
 * @param {number} weakenThreads
 * @returns {boolean}
 */
function canFitBatch(ns, hosts, hackThreads, growThreads, weakenThreads) {
    const hackRam = ns.getScriptRam("/hack/hack.js") || 1.70;
    const growRam = ns.getScriptRam("/hack/grow.js") || 1.75;
    const weakenRam = ns.getScriptRam("/hack/weaken.js") || 1.75;

    let remainingHack = hackThreads;
    let remainingGrow = growThreads;
    let remainingWeaken = weakenThreads;

    for (const host of hosts) {
        if (!ns.hasRootAccess(host)) continue;

        let available = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
        if (host === "home") {
            available -= 64; // Reserve 64GB on home for orchestrators and utilities
        }

        // Try to allocate weaken threads
        if (remainingWeaken > 0) {
            const fit = Math.min(remainingWeaken, Math.floor(available / weakenRam));
            remainingWeaken -= fit;
            available -= fit * weakenRam;
        }

        // Try to allocate grow threads
        if (remainingGrow > 0) {
            const fit = Math.min(remainingGrow, Math.floor(available / growRam));
            remainingGrow -= fit;
            available -= fit * growRam;
        }

        // Try to allocate hack threads
        if (remainingHack > 0) {
            const fit = Math.min(remainingHack, Math.floor(available / hackRam));
            remainingHack -= fit;
            available -= fit * hackRam;
        }

        if (remainingHack <= 0 && remainingGrow <= 0 && remainingWeaken <= 0) {
            return true;
        }
    }

    ns.print(`canFitBatch: WARNING! Failed to fit batch! Remaining needed: H=${remainingHack}, G=${remainingGrow}, W=${remainingWeaken}`);
    return false;
}