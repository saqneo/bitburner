import { spread } from '/hack/spread.js';
import { getAllNodes } from '/lib/map.js';
import { killAll } from '/lib/process.js';
import { checkTransition } from '/lib/progression.js';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.print("Stage: EARLY GAME started.");

    const SCRIPT_NAME = "hack/early-hack.js";
    const TARGET = "n00dles";

    while (true) {
        // 1. Spread: Gain root access where possible
        spread(ns);

        // 2. Deploy: Run early-hack on all rooted servers
        const hosts = getAllNodes(ns);
        
        for (const host of hosts) {
            // Skip if we don't have root access
            if (!ns.hasRootAccess(host)) continue;
            
            const maxRam = ns.getServerMaxRam(host);
            const usedRam = ns.getServerUsedRam(host);
            const scriptRam = ns.getScriptRam(SCRIPT_NAME);

            if (maxRam === 0) continue;

            // Check if script is already running
            if (ns.isRunning(SCRIPT_NAME, host, TARGET)) {
                continue; 
            }

            // Calculate threads
            // If on home, save a bit of space (e.g. 32GB for other scripts)
            let availableRam = maxRam - usedRam;
            if (host === "home") {
                availableRam = Math.max(0, availableRam - 32); 
            }

            const threads = Math.floor(availableRam / scriptRam);

            if (threads > 0) {
                // Copy script if not on home
                if (host !== "home") {
                    await ns.scp(SCRIPT_NAME, host);
                }

                const pid = ns.exec(SCRIPT_NAME, host, threads, TARGET);
            }
        }

        // --- State Transition Check ---
        const nextStage = checkTransition(ns, "early");
        if (nextStage) {
            ns.tprint(`SUCCESS: Early Game Goals Met. Transitioning to '${nextStage}'.`);
            
            // 1. Cleanup: Kill all workers
            killAll(ns);
            
            ns.write("/data/state.txt", nextStage, "w");
            ns.spawn("/daemon.js");
        }

        await ns.sleep(5000);
    }
}