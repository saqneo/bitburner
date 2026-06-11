import { getCost } from '/lib/cost.js';

/**
 * Distributes threads of a script across available hosts.
 * @param {NS} ns
 * @param {string} script - The worker script to run
 * @param {number} needed - Number of threads needed (can be Infinity)
 * @param {string} target - The target server passed as arg to the script
 * @param {string[]} hosts - Available hosts to distribute across
 * @param {Object} [options={}] - Configuration options
 * @param {number} [options.ramCapPct=1.0] - Max fraction of total network RAM this call may consume (0.0–1.0)
 * @param {number} [options.batchId=0] - Unique ID appended as a second arg to allow concurrent exec on same host+target
 * @returns {number} The PID of the LAST successfully launched instance (to track completion).
 */
export function distribute(ns, script, needed, target, hosts, options = {}) {
    const { ramCapPct = 1.0, batchId = 0, delay = 0 } = options;
    const ramCost = ns.getScriptRam(script);

    // Apply per-call RAM cap to prevent a single operation from starving others.
    if (ramCapPct < 1.0) {
        const totalNetworkRam = hosts.reduce((sum, h) => {
            if (!ns.hasRootAccess(h)) return sum;
            let max = ns.getServerMaxRam(h);
            if (h === "home") max = Math.max(0, max - 128);
            return sum + max;
        }, 0);
        const maxThreads = Math.max(1, Math.floor((totalNetworkRam * ramCapPct) / ramCost));
        needed = (needed === Infinity) ? maxThreads : Math.min(needed, maxThreads);
    }

    // Load-balance hosts: Prioritize purchased servers, then hacked servers, then home.
    // Shuffle within groups to distribute load evenly across all servers.
    const purchased = [];
    const hacked = [];
    let hasHome = false;

    for (const h of hosts) {
        if (h === "home") {
            hasHome = true;
        } else if (h.startsWith("owned-")) {
            purchased.push(h);
        } else {
            hacked.push(h);
        }
    }

    const shuffle = (arr) => {
        const result = [...arr];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    };

    const balancedHosts = [
        ...shuffle(purchased),
        ...shuffle(hacked),
        ...(hasHome ? ["home"] : [])
    ];

    let remaining = needed;
    let lastPid = 0;

    ns.print(`distribute: Scheduling ${script} for ${target} (needed: ${needed} threads, ramCost: ${ramCost}GB, delay: ${delay}ms)`);
    ns.print(`distribute: Candidate host path: [${balancedHosts.slice(0, 10).join(", ")}...] (total candidates: ${balancedHosts.length})`);

    for (const host of balancedHosts) {
        if (remaining <= 0) break;
        if (!ns.hasRootAccess(host)) {
            ns.print(`distribute: Skipping ${host} (no root access)`);
            continue;
        }

        let available = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
        if (host === "home") {
            available -= 128; // Reserve 128GB on home for orchestrators and utilities
        }
        
        if (available < ramCost) {
            // Log only if it's a purchased server to avoid spamming normal tiny servers
            if (host.startsWith("owned-")) {
                ns.print(`distribute: Skipping purchased server ${host} (insufficient RAM: ${available.toFixed(1)}GB free, requires ${ramCost}GB)`);
            }
            continue;
        }

        let threads = Math.floor(available / ramCost);
        if (threads > remaining && remaining !== Infinity) {
            threads = remaining;
        }

        if (threads > 0) {
            // batchId and delay differentiate concurrent instances and handle timing in midgame.
            // For early game, we pass zero extra parameters to remain completely vanilla and backward-compatible.
            const pid = (batchId > 0 || delay > 0)
                ? ns.exec(script, host, threads, target, batchId, delay)
                : ns.exec(script, host, threads, target);
            if (pid > 0) {
                lastPid = pid;
                if (remaining !== Infinity) remaining -= threads;
                ns.print(`distribute: SUCCESS! Launched ${script} on ${host} with ${threads} threads (PID: ${pid}). Remaining needed: ${remaining}`);
            } else {
                ns.print(`distribute: ERROR! ns.exec failed for ${script} on ${host} with ${threads} threads!`);
            }
        }
    }
    return lastPid;
}

/**
 * Delegates a utility script to run (1 thread) on any host with enough free RAM.
 * Skips if the script is already running on that host.
 * @param {NS} ns
 * @param {string} script
 * @param {string[]} hosts
 * @returns {number} PID of the launched script, or 0 if none launched.
 */
export function runDelegate(ns, script, hosts) {
    const ram = ns.getScriptRam(script);
    for (const host of hosts) {
        if (ns.isRunning(script, host)) return 0;
        if (ns.hasRootAccess(host) && (ns.getServerMaxRam(host) - ns.getServerUsedRam(host)) >= ram) {
            return ns.exec(script, host, 1);
        }
    }
    return 0;
}

/**
 * Runs periodic infrastructure tasks: contracts, spread, deploy, purchasing.
 * @param {NS} ns
 * @param {string[]} hosts
 */
export async function delegateInfrastructure(ns, hosts) {
    ns.print("Maintenance: Triggering periodic tasks (Contracts/Spread/Deploy)...");

    // 1. Solve Contracts FIRST (gets cash into wallet before purchasing checks)
    const pid = runDelegate(ns, '/util/solve-contracts.js', hosts);
    if (pid > 0) {
        ns.print("Maintenance: Waiting for contract solving...");
        while (ns.isRunning(pid)) await ns.sleep(100);
    }

    // 2. Network Maintenance
    runDelegate(ns, '/util/spread.js', hosts);
    runDelegate(ns, '/util/deploy-all.js', hosts);

    // 3. Purchasing (uses cash, potentially from step 1)
    const serverCost = getCost(ns, 'server') || 55000;
    if (ns.getServerMoneyAvailable("home") > serverCost) {
        runDelegate(ns, '/util/purchase-server.js', hosts);
    }

    const hacknetCost = getCost(ns, 'hacknet') || 1000;
    if (ns.getServerMoneyAvailable("home") > hacknetCost) {
        runDelegate(ns, '/util/upgrade-hacknet.js', hosts);
    }
}

/**
 * Maximize share power on home with remaining RAM.
 * @param {NS} ns
 */
export function manageShare(ns) {
    if (ns.getServerMaxRam("home") - ns.getServerUsedRam("home") > 2.0) {
        ns.exec("/util/start-share.js", "home", 1);
    }
}
