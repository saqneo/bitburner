import { solveContracts } from '/lib/contract.js';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    solveContracts(ns);
}
