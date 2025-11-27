/**
 * Utility functions for deploying scripts across the network.
 */
import { getAllNodes } from '/lib/map.js';

/**
 * Copies a script to a list of hosts, automatically filtering out 'home'.
 * @param {NS} ns
 * @param {string} scriptName - The name of the script to copy.
 * @param {string[]} hosts - An array of hostnames to copy the script to.
 * @returns {Promise<void>} A promise that resolves when all scp operations are complete.
 */
export async function smartScp(ns, scriptName, hosts) {
    const remoteHosts = hosts.filter(h => h !== "home");
    if (remoteHosts.length > 0) {
        await Promise.all(remoteHosts.map(host => ns.scp(scriptName, host)));
    }
}

/**
 * Executes a script on all available rooted hosts (excluding 'home')
 * with the maximum possible threads. Assumes the script has already been copied.
 *
 * @param {NS} ns
 * @param {string} scriptName - The name of the script to execute (e.g., "hack/early-hack.js").
 * @param {string[]} hosts - An array of hostnames (from getAllNodes) to execute the script on.
 */
export function smartExec(ns, scriptName, hosts) {
    // Hosts are already provided and will be filtered internally.
    const scriptRam = ns.getScriptRam(scriptName);

    if (scriptRam === 0) {
        ns.tprint(`ERROR: Script ${scriptName} has 0 RAM cost. Skipping execution.`);
        return;
    }

    for (const host of hosts) {
        // Skip home and hosts without root access
        if (host === "home" || !ns.hasRootAccess(host)) continue;

        const maxRam = ns.getServerMaxRam(host);
        const usedRam = ns.getServerUsedRam(host);
        
        let availableRam = maxRam - usedRam;
        
        const threads = Math.floor(availableRam / scriptRam);

        if (threads > 0) {
            // Check if script is already running with these specific arguments (none for now)
            if (ns.isRunning(scriptName, host)) { 
                continue; 
            }
            
            ns.exec(scriptName, host, threads);
            // ns.print(`Deployed ${scriptName} on ${host} with ${threads} threads.`);
        }
    }
}