/**
 * Kills all scripts on all reachable servers, except for the current script and any specified exceptions.
 * @param {NS} ns
 * @param {string[]} [exceptions=[]] - List of script filenames to NOT kill (e.g. "daemon.js", "hacknet.js").
 */
import { getAllNodes } from '/lib/map.js';

export function killAll(ns, exceptions = []) {
    const hosts = getAllNodes(ns);
    const myPid = ns.pid;

    for (const host of hosts) {
        const procs = ns.ps(host);
        for (const proc of procs) {
            // Don't kill self
            if (proc.pid === myPid) continue;

            // Don't kill exceptions (check filename)
            if (exceptions.includes(proc.filename)) continue;
            
            // Don't kill the daemon (usually running on home, monitoring)
            if (proc.filename === "/daemon.js" || proc.filename === "daemon.js") continue;

            ns.kill(proc.pid);
        }
    }
    ns.print(`Killed all worker processes (Exceptions: ${exceptions}).`);
}