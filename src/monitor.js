import { updateHud } from '/lib/hud.js';
import { getStartupStage } from '/lib/progression.js';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.ui.openTail();
    ns.ui.setTailTitle("System Monitor HUD");
    ns.ui.resizeTail(750, 450);
    ns.ui.moveTail(250, 80);
    
    ns.print("Initializing System Monitor...");

    while (true) {
        let stage = getStartupStage(ns);

        // Update the visual HUD
        // This script bears the heavy RAM cost of scanning the network (ns.ps, ns.getServer)
        // so the controller doesn't have to.
        updateHud(ns, { 
            stage: stage.toUpperCase() 
        });

        // 1Hz Refresh Rate
        await ns.sleep(1000);
    }
}