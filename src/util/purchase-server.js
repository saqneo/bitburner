import { manageServers } from '/lib/servers.js';

/** @param {import('../..').NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    const actionTaken = await manageServers(ns);
    if (actionTaken) {
        ns.print("Server manager took action.");
    }
}
