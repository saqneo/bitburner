import { killAll } from '/lib/process.js';

/** @param {NS} ns */
export async function main(ns) {
    ns.tprint("Killing all scripts...");
    killAll(ns);
}