import { spread } from '/hack/spread.js';
import { getAllNodes } from '/lib/map.js';
import { killAll } from '/lib/process.js';
import { checkTransition } from '/lib/progression.js';
import { smartScp, smartExec } from '/lib/deploy.js'; // Import both functions

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.print("Stage: EARLY GAME started.");

    // HACKING_PROGRAMS array and purchasing loop removed due to RAM concerns.
    // Programs will need to be purchased manually for now.
    // const HACKING_PROGRAMS = [...];
    // for (const program of HACKING_PROGRAMS) { ... }

    const SCRIPT_NAME = "hack/early-hack.js"; // SCRIPT_NAME is still used here

    while (true) {
        // 1. Spread: Gain root access where possible
        spread(ns);

        // 2. Deploy: Copy the script to all remote hosts
        const hosts = getAllNodes(ns); // Needs to get the full list to pass to smartScp and smartExec
        await smartScp(ns, SCRIPT_NAME, hosts);

        // 3. Deploy: Execute the script on all remote hosts
        smartExec(ns, SCRIPT_NAME, hosts);
        
        // --- State Transition Check ---
        const nextStage = checkTransition(ns, "early");
        if (nextStage) {
            ns.tprint(`SUCCESS: Early Game Goals Met. Transitioning to '${nextStage}'.`);
            
            killAll(ns);
            
            ns.write("/data/state.txt", nextStage, "w");
            ns.spawn("/daemon.js");
        }

        await ns.sleep(5000);
    }
}