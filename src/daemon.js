import { getAllNodes } from '/lib/map.js';
import { checkTransition } from '/lib/progression.js';
import { getCost } from '/lib/cost.js';
import { spread } from '/lib/spread.js';
import { deployLibs } from '/lib/deploy.js';

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
    ns.rm("/tmp/", "home", { recursive: true });

    // Initial Setup
    ns.print("Daemon: Running initial network spread...");
    while (spread(ns)) await ns.sleep(50);
    
    ns.print("Daemon: Running initial library deploy...");
    await deployLibs(ns, getAllNodes(ns));

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
    const WORKER_SCRIPT = "/hack/early-hack.js";

    while (true) {
        // A. Infrastructure & Expansion
        const hosts = getAllNodes(ns);
        await delegateInfrastructure(ns, nodes);

        // B. Dispatcher Loop
        const target = getBestTarget(ns, hosts);
        
        if (target) {
            ns.write("/data/target.txt", target, "w");

            for (const host of hosts) {
                if (!ns.hasRootAccess(host)) continue;

                const scriptRam = ns.getScriptRam(WORKER_SCRIPT);
                const maxRam = ns.getServerMaxRam(host);
                const usedRam = ns.getServerUsedRam(host);
                let availableRam = maxRam - usedRam;

                if (host === "home") {
                    const RESERVED_HOME = 8.0;
                    availableRam = Math.max(0, availableRam - RESERVED_HOME);
                }

                const threads = Math.floor(availableRam / scriptRam);
                if (threads > 0) {
                    ns.exec(WORKER_SCRIPT, host, threads, target);
                }
            }
        }

        // C. State Transition Check
        const nextStage = checkTransition(ns, "early");
        if (nextStage) {
            ns.tprint(`SUCCESS: Early Game Goals Met. Transitioning to '${nextStage}'.`);
            ns.write("/data/state.txt", nextStage, "w");
            return; // Return to main loop to handle state change
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
    
    const RARE_TASK_CHANCE = 0.004; // ~2 mins
    if (Math.random() > RARE_TASK_CHANCE) {
        return
    }

    ns.tprint('running')

    // 1. Critical Expansion (Spread & Deploy)
    await runDelegate(ns, '/util/spread.js', hosts);
    await runDelegate(ns, '/util/deploy-all.js', hosts);

    // 2. Purchasing
    const serverCost = getCost(ns, 'server') || 55000;
    if (ns.getServerMoneyAvailable("home") > serverCost) {
        await runDelegate(ns, '/util/purchase-server.js', hosts);
    }

    const hacknetCost = getCost(ns, 'hacknet') || 1000;
    ns.tprint(`${hacknetCost}`)
    if (ns.getServerMoneyAvailable("home") > hacknetCost) {
         await runDelegate(ns, '/util/upgrade-hacknet.js', hosts);
    }

    // 3. Contracts
    await runDelegate(ns, '/util/solve-contracts.js', hosts);
}

async function runDelegate(ns, script, hosts) {
    const ram = ns.getScriptRam(script);
    for (const host of hosts) {
        // Check if already running
        if (ns.isRunning(script, host)) return;
        
        // Check if can run
        if (ns.hasRootAccess(host) && (ns.getServerMaxRam(host) - ns.getServerUsedRam(host)) >= ram) {
             ns.exec(script, host, 1);
             return;
        }
    }
}