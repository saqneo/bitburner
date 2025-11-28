import { manageHacknet } from '/lib/hacknet.js';

/** @param {import('../..').NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    await manageHacknet(ns);
}
