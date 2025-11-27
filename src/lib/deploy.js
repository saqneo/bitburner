/**
 * Utility functions for deploying scripts across the network.
 */
import { getAllNodes } from '/lib/map.js';

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


/**
 * Deploys all scripts from /lib/ and /util/ to a list of hosts.
 * @param {NS} ns
 * @param {string[]} hosts - An array of hostnames to deploy the libraries to.
 * @returns {Promise<void>}
 */
export async function deployLibs(ns, hosts) {
    const remoteHosts = hosts.filter(h => h !== "home");
    if (remoteHosts.length === 0) return;

    const libFiles = ns.ls("home", "/lib/").filter(f => f.endsWith('.js'));
    const utilFiles = ns.ls("home", "/util/").filter(f => f.endsWith('.js'));
    const hackFiles = ns.ls("home", "/hack/").filter(f => f.endsWith('.js'));
    const allLibs = [...libFiles, ...utilFiles, ...hackFiles];

    for (const host of remoteHosts) {
        await ns.scp(allLibs, host, "home");
    }
}