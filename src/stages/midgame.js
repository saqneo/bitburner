import { getAllNodes } from '/lib/map.js';
import { distribute, manageShare, delegateInfrastructure } from '/lib/dispatch.js';
import { getRankedTargets } from '/lib/target-analysis.js';
import { 
    MAX_CONCURRENT_BATCHES, 
    HACK_FRACTION, 
    GROW_SAFETY_FACTOR, 
    MAINTENANCE_INTERVAL_MS,
    TICK_RATE_MS,
    BATCH_SPACING_MS,
    CYCLE_PERIOD_MS
} from '/lib/constants.js';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.print("Stage: MID GAME started.");
    ns.tprint("Mid Game Stage Loaded.");

    // Launch stock trader startup helper (transient execution to keep midgame RAM at 0GB extra footprint)
    ns.exec("/util/start-stock-trader.js", "home", 1);

    // Launch Singularity Manager if not running and we have enough RAM
    const singScript = "/sing/manager.js";
    if (ns.fileExists(singScript, "home") && !ns.isRunning(singScript, "home")) {
        const singRam = ns.getScriptRam(singScript, "home");
        const freeRam = ns.getServerMaxRam("home") - ns.getServerUsedRam("home");
        if (freeRam >= singRam) {
            ns.exec(singScript, "home", 1);
            ns.tprint(`Midgame: Launched Singularity Manager (${singRam.toFixed(2)} GB).`);
        } else {
            ns.print(`Midgame: Skipping Singularity Manager (needs ${singRam.toFixed(2)} GB, only ${freeRam.toFixed(2)} GB free).`);
        }
    }

    // --- State Tracking ---
    // Instead of tracking wave completion, we track the next landing slot for each target's pipeline.
    const nextLanding = new Map();   // target -> next landing timestamp
    const prepPids = new Map();      // target -> pid (only for prep, which is serial)
    let nextMaintenance = 0;
    let batchIdCounter = 1;

    // Cache worker RAM costs once (they don't change at runtime)
    const HACK_RAM = ns.getScriptRam("/hack/hack.js");
    const GROW_RAM = ns.getScriptRam("/hack/grow.js");
    const WEAKEN_RAM = ns.getScriptRam("/hack/weaken.js");

    // Outer orchestrator loop
    while (true) {
        const hosts = getAllNodes(ns);
        const targets = getRankedTargets(ns, hosts);
        const now = Date.now();

        // Infrastructure: Run periodically
        if (now > nextMaintenance) {
            await delegateInfrastructure(ns, hosts);
            ns.exec("/util/start-stock-trader.js", "home", 1);
            if (targets.length > 0) {
                ns.print(`Midgame: Maintenance done. Top Targets: [${targets.slice(0, 3).join(", ")}]`);
            }
            nextMaintenance = now + MAINTENANCE_INTERVAL_MS;
        }

        // Calculate total free RAM across the cluster (snapshot once per tick)
        let clusterFreeRam = getClusterFreeRam(ns, hosts);

        for (const target of targets) {
            // --- B. Clean up finished prep PIDs ---
            const prepPid = prepPids.get(target);
            if (prepPid && ns.isRunning(prepPid)) continue; // prep still running
            prepPids.delete(target);

            // --- C. Query target metrics ---
            const server = ns.getServer(target);
            const sec = server.hackDifficulty;
            const minSec = server.minDifficulty;
            const money = server.moneyAvailable;
            const maxMoney = server.moneyMax;

            // --- D. Prep if needed ---
            const needsPrep = (sec > minSec + 0.1) || (money < maxMoney * 0.90);
            if (needsPrep) {
                // Clear any harvest pipeline to prevent batch desync during prep
                nextLanding.delete(target);
                runPrep(ns, target, server, hosts, prepPids, batchIdCounter);
                batchIdCounter++;
                continue;
            }

            // --- E. Harvest: Calculate HWGW batch parameters ---
            const hackPercentPerThread = ns.hackAnalyze(target);
            if (hackPercentPerThread <= 0) continue;

            const hackThreads = Math.max(1, Math.floor(HACK_FRACTION / hackPercentPerThread));

            // Weaken₁: cancel hack security
            const hackSec = ns.hackAnalyzeSecurity(hackThreads, target);
            const weakenPerThread = ns.weakenAnalyze(1, 1);
            const weaken1Threads = Math.max(1, Math.ceil(hackSec / weakenPerThread));

            // Grow: restore money (1/(1-fraction) multiplier to go from (1-frac)*max back to max)
            const growMultiplier = 1 / (1 - HACK_FRACTION);
            const baseGrowThreads = ns.growthAnalyze(target, growMultiplier);
            const growThreads = Math.max(1, Math.ceil(baseGrowThreads * GROW_SAFETY_FACTOR));

            // Weaken₂: cancel grow security
            const growSec = ns.growthAnalyzeSecurity(growThreads, target);
            const weaken2Threads = Math.max(1, Math.ceil(growSec / weakenPerThread));

            // --- F. Calculate batch RAM cost ---
            const batchRam = (hackThreads * HACK_RAM) +
                             (weaken1Threads * WEAKEN_RAM) +
                             (growThreads * GROW_RAM) +
                             (weaken2Threads * WEAKEN_RAM);

            if (batchRam <= 0) continue;

            // --- G. Calculate timing ---
            const tWeaken = ns.getWeakenTime(target);
            const tGrow = ns.getGrowTime(target);
            const tHack = ns.getHackTime(target);

            // Earliest landing time must allow the longest execution time (weaken) plus scheduling buffer
            const schedulingBuffer = 200; 
            const earliestLanding = now + tWeaken + schedulingBuffer;

            // Calculate next available landing time slot
            let landingTime = nextLanding.get(target) || earliestLanding;
            if (landingTime < earliestLanding) {
                landingTime = earliestLanding;
            }

            // Cap the lookahead pipeline window to 1 weaken cycle into the future to avoid hacking-level drift
            const maxLandingTime = earliestLanding + tWeaken;

            // --- H. Pipelining: Queue batches into future slots ---
            let scheduled = 0;
            while (landingTime <= maxLandingTime && clusterFreeRam >= batchRam) {
                const hackDelay    = Math.round(landingTime - tHack - now);
                const weaken1Delay = Math.round(landingTime + BATCH_SPACING_MS - tWeaken - now);
                const growDelay    = Math.round(landingTime + 2 * BATCH_SPACING_MS - tGrow - now);
                const weaken2Delay = Math.round(landingTime + 3 * BATCH_SPACING_MS - tWeaken - now);

                if (hackDelay < 0 || weaken1Delay < 0 || growDelay < 0 || weaken2Delay < 0) {
                    // Safety check: if somehow delays fall negative (should not happen), slip slot forward
                    landingTime += CYCLE_PERIOD_MS;
                    continue;
                }

                // Unique batchId per script execution
                const baseBatchId = batchIdCounter;
                batchIdCounter += 4;

                const h  = distribute(ns, "/hack/hack.js",   hackThreads,    target, hosts, { batchId: baseBatchId,     delay: hackDelay });
                const w1 = distribute(ns, "/hack/weaken.js", weaken1Threads, target, hosts, { batchId: baseBatchId + 1, delay: weaken1Delay });
                const g  = distribute(ns, "/hack/grow.js",   growThreads,    target, hosts, { batchId: baseBatchId + 2, delay: growDelay });
                const w2 = distribute(ns, "/hack/weaken.js", weaken2Threads, target, hosts, { batchId: baseBatchId + 3, delay: weaken2Delay });

                if (!h || !w1 || !g || !w2) {
                    // Failed to fit batch in RAM (fragmented/low RAM)
                    break;
                }

                scheduled++;
                clusterFreeRam -= batchRam;
                landingTime += CYCLE_PERIOD_MS;
            }

            if (scheduled > 0) {
                nextLanding.set(target, landingTime);
                ns.print(`Midgame: Pipelined ${scheduled} HWGW batches for ${target} ` +
                         `(Next landing in ${((landingTime - now) / 1000).toFixed(1)}s, ` +
                         `${(scheduled * batchRam).toFixed(0)} GB)`);
            }

            // If we've used most of the cluster RAM, stop trying more targets
            if (clusterFreeRam < batchRam) break;
        }

        // Write pipeline status for diagnostics
        const statusFile = "/data/midgame-status.json";
        const statusData = {
            timestamp: Date.now(),
            pipelines: {}
        };
        for (const [target, landingTime] of nextLanding.entries()) {
            statusData.pipelines[target] = {
                nextLandingTime: landingTime,
                timeLeftMs: Math.max(0, landingTime - Date.now()),
                isPrepping: prepPids.has(target)
            };
        }
        for (const [target, pid] of prepPids.entries()) {
            if (!statusData.pipelines[target]) {
                statusData.pipelines[target] = {
                    nextLandingTime: 0,
                    timeLeftMs: 0,
                    isPrepping: true
                };
            }
        }
        await ns.write(statusFile, JSON.stringify(statusData, null, 2), "w");

        // Manage Share across the whole cluster with any remaining idle RAM
        manageShare(ns, hosts);

        // Sleep until next tick. Check every tick to queue new pipeline slots.
        await ns.sleep(TICK_RATE_MS);
    }
}

/**
 * Runs a prep cycle (weaken-only or grow+weaken) for a target that isn't at ideal levels.
 * Only one prep batch runs at a time per target to avoid over-allocation.
 * @param {NS} ns
 * @param {string} target
 * @param {Object} server - ns.getServer() result
 * @param {string[]} hosts
 * @param {Map} prepPids - Map of target -> prep PID
 * @param {number} batchId
 */
function runPrep(ns, target, server, hosts, prepPids, batchId) {
    const sec = server.hackDifficulty;
    const minSec = server.minDifficulty;
    const money = server.moneyAvailable;
    const maxMoney = server.moneyMax;
    const weakenPerThread = ns.weakenAnalyze(1, 1);

    if (sec > minSec + 0.1) {
        // Prep Security (Weaken-only)
        let weakenThreads = Math.ceil((sec - minSec) / weakenPerThread);
        const weakenRam = ns.getScriptRam("/hack/weaken.js");
        const clusterFreeRam = getClusterFreeRam(ns, hosts);
        const maxPossibleThreads = Math.floor(clusterFreeRam / weakenRam);

        if (weakenThreads > maxPossibleThreads) {
            weakenThreads = maxPossibleThreads;
        }

        if (weakenThreads > 0) {
            const pid = distribute(ns, "/hack/weaken.js", weakenThreads, target, hosts, { batchId });
            if (pid > 0) {
                prepPids.set(target, pid);
                ns.print(`Midgame: Prepping ${target} (Security) -> Weaken x${weakenThreads} (Scaled to fit available RAM)`);
            }
        }
    } else if (money < maxMoney * 0.90) {
        // Prep Money (Grow + Weaken)
        const multiplier = maxMoney / Math.max(money, 1);
        const baseGrowThreads = ns.growthAnalyze(target, multiplier);
        let growThreads = Math.ceil(baseGrowThreads * GROW_SAFETY_FACTOR);
        let growSec = ns.growthAnalyzeSecurity(growThreads, target);
        let weakenThreads = Math.ceil(growSec / weakenPerThread);

        const growRam = ns.getScriptRam("/hack/grow.js");
        const weakenRam = ns.getScriptRam("/hack/weaken.js");
        const clusterFreeRam = getClusterFreeRam(ns, hosts);

        const batchRam = (growThreads * growRam) + (weakenThreads * weakenRam);
        if (batchRam > clusterFreeRam) {
            const scale = clusterFreeRam / batchRam;
            growThreads = Math.floor(growThreads * scale);
            if (growThreads > 0) {
                growSec = ns.growthAnalyzeSecurity(growThreads, target);
                weakenThreads = Math.max(1, Math.ceil(growSec / weakenPerThread));
            } else {
                weakenThreads = 0;
            }
        }

        if (growThreads > 0 && weakenThreads > 0) {
            distribute(ns, "/hack/grow.js", growThreads, target, hosts, { batchId });
            const pid = distribute(ns, "/hack/weaken.js", weakenThreads, target, hosts, { batchId: batchId + 1 });
            if (pid > 0) {
                prepPids.set(target, pid);
                ns.print(`Midgame: Prepping ${target} (Money) -> Grow x${growThreads}, Weaken x${weakenThreads} (Scaled to fit available RAM)`);
            }
        }
    }
}

/**
 * Calculates total free RAM across the cluster (excluding home reserve).
 * @param {NS} ns
 * @param {string[]} hosts
 * @returns {number} Available RAM in GB.
 */
function getClusterFreeRam(ns, hosts) {
    let total = 0;
    for (const host of hosts) {
        if (!ns.hasRootAccess(host)) continue;
        let available = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
        if (host === "home") available = Math.max(0, available - 128);
        if (available > 0) total += available;
    }
    return total;
}

/**
 * Dry-run allocator to ensure the network can fully accommodate a batch's threads.
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
            available -= 128; // Reserve 128GB on home for orchestrators and utilities
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