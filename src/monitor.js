import { updateHud } from '/lib/hud.js';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.tail(); // Open the custom log window
    
    ns.print("Initializing System Monitor...");

    while (true) {
        // Read state from the file system (written by the active stage controller)
        let target = ns.read("/data/target.txt");
        if (target === "") target = null;

        // Read stage info if available (optional)
        let stage = "UNKNOWN";
        if (ns.fileExists("/data/state.txt")) {
            stage = ns.read("/data/state.txt");
        }

        // Update the visual HUD
        // This script bears the heavy RAM cost of scanning the network (ns.ps, ns.getServer)
        // so the controller doesn't have to.
        updateHud(ns, { 
            target: target, 
            stage: stage.toUpperCase() 
        });

        // 1Hz Refresh Rate
        await ns.sleep(1000);
    }
}