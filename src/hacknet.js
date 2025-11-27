import { upgradeHacknet } from '/lib/hacknet.js';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.print("Hacknet automation script started.");

    while (true) {
        const bought = await upgradeHacknet(ns);
        
        // If we bought something, check again immediately
        if (bought) {
            await ns.sleep(10);
        } else {
            await ns.sleep(1000);
        }
    }
}