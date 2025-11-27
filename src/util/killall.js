import { killAll } from '/lib/process.js';

/** @param {NS} ns */
export async function main(ns) {
    const confirm = await ns.prompt("Are you sure you want to KILL ALL scripts on ALL servers (except this one)?");
    if (confirm) {
        ns.tprint("Killing all scripts...");
        killAll(ns);
        ns.tprint("Done.");
    } else {
        ns.tprint("Operation cancelled.");
    }
}