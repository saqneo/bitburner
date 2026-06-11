import { getPath } from '/lib/sing-utils.js';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    const keyServers = [
        "CSEC",          // CyberSec
        "avmnite-02h",   // NiteSec
        "I.I.I.I",       // The Black Hand
        "run4theh111z",  // BitRunners
        "w0r1d_d43m0n"   // World Daemon
    ];

    const playerHacking = ns.getHackingLevel();

    for (const host of keyServers) {
        if (!ns.serverExists(host)) continue;
        if (!ns.hasRootAccess(host)) continue;

        const server = ns.getServer(host);
        if (server.backdoorInstalled) continue;

        const reqHacking = ns.getServerRequiredHackingLevel(host);
        if (playerHacking < reqHacking) continue;

        ns.tprint(`Singularity: Attempting to install backdoor on '${host}'...`);
        const path = getPath(ns, host);
        if (!path) {
            ns.print(`Could not find path to ${host}`);
            continue;
        }

        // Navigate to the server
        for (let i = 1; i < path.length; i++) {
            ns.singularity.connect(path[i]);
        }

        // Install backdoor (returns promise)
        await ns.singularity.installBackdoor();
        ns.tprint(`Singularity: Backdoor successfully installed on '${host}'`);

        // Connect back home
        ns.singularity.connect("home");
    }
}
