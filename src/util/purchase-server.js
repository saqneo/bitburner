import { manageServers } from '/lib/servers.js';

/** @param {import('../..').NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    const actionTaken = manageServers(ns);
    if (actionTaken) {
        ns.tprint("Server manager took action.");
    }
}
