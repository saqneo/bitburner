import { getAllNodes } from '/lib/map.js';
import { checkTransition } from '/lib/progression.js';
import { getCost } from '/lib/cost.js';
import { spread } from '/lib/spread.js';
import { getRankedTargets, getNextAction } from '/lib/target-analysis.js';
import { MAINTENANCE_INTERVAL_MS } from '/lib/constants.js';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    // --- 1. BOOTSTRAP ---
    const guide = `

_______________________________________________________
|            RECOVERY PROTOCOL: EARLY GAME            |
|_____________________________________________________|
| 1. [TRAVEL]   :: Go to Chongqing, New Tokyo, or     |
|                  Ishima immediately.                |
| 2. [FACTION]  :: Join Tian Di Hui (Req: H:50, $1m). |
| 3. [BACKDOOR] :: Crack & Backdoor immediately:      |
|                  -> 'CSEC' (CyberSec)               |
|                  -> 'avmnite-02h' (NiteSec)         |
|-----------------------------------------------------|
|            SHOPPING LIST (PRIORITY ORDER)           |
|-----------------------------------------------------|
| 1. Neuroreceptor Manager (TDH) :: [Auto-Focus Work] |
| 2. Social Neg. Asst (TDH)      :: [Rep Gain +15%]   |
| 3. ADR-V1 Gene (TDH)           :: [Rep Gain +10%]   |
| 4. Cranial Signal Proc (CSEC)  :: [Hack Speed/Power]|
| 5. BitWire (CSEC/NiteSec)      :: [Hack Skill]      |
|-----------------------------------------------------|
| 4. [ACTION]   :: Work 'Hacking Contracts' for TDH.  |
|                  Solve .cct files for Rep bursts.   |
| 5. [SYSTEM]   :: REMINDER: Run 'buyAll' alias!      |
|_____________________________________________________|
`;
    ns.tprint(guide);

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
    while (true) {
        const state = readState(ns);

        if (state === "early") {
            await runEarly(ns);
        } else {
            ns.tprint(`Daemon: Transition to stage '${state}' requested.`);
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
            ns.write("/data/state.txt", nextStage, "w");
            return; 
        }

        await ns.sleep(500);
    }
}

function readState(ns) {
    const STATE_FILE = "/data/state.txt";
    if (ns.fileExists(STATE_FILE)) {
        const content = ns.read(STATE_FILE).trim();
        return content || "early";
    }
    return "early";
}

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
        if (!ns.hasRootAccess(host)) continue;

        const maxRam = ns.getServerMaxRam(host);
        const usedRam = ns.getServerUsedRam(host);
        let available = maxRam - usedRam;

        if (host === "home") {
            available = Math.max(0, available - 10); // Reserve home ram
        }

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
 * Delegates infrastructure tasks.
 * @param {NS} ns 
 * @param {string[]} hosts
 */
async function delegateInfrastructure(ns, hosts) {
    ns.print("Daemon: Triggering periodic maintenance (Spread/Deploy/Contracts)...");
    await runDelegate(ns, '/util/spread.js', hosts);
    await runDelegate(ns, '/util/deploy-all.js', hosts);
    await runDelegate(ns, '/util/solve-contracts.js', hosts);

    // 2. Purchasing (Always check if affordable)
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
        if (ns.isRunning(script, host)) return;
        
        if (ns.hasRootAccess(host) && (ns.getServerMaxRam(host) - ns.getServerUsedRam(host)) >= ram) {
             ns.exec(script, host, 1);
             return;
        }
    }
}