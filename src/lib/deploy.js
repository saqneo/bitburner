/**
 * Utility functions for deploying scripts across the network.
 */
import { getAllNodes } from '/lib/map.js';

/**
 * Executes a script on all available rooted hosts
 * with the maximum possible threads. Assumes the script has already been copied.
 *
 * @param {NS} ns
 * @param {string} scriptName - The name of the script to execute (e.g., "hack/early-hack.js").
 * @param {string[]} hosts - An array of hostnames (from getAllNodes) to execute the script on.
 * @param {any[]} [scriptArgs=[]] - Arguments to pass to the script.
 */
export function smartExec(ns, scriptName, hosts, scriptArgs = []) {
    // Hosts are already provided and will be filtered internally.
    const scriptRam = ns.getScriptRam(scriptName);

    if (scriptRam === 0) {
        ns.tprint(`ERROR: Script ${scriptName} has 0 RAM cost. Skipping execution.`);
        return;
    }

    for (const host of hosts) {
        // Skip hosts without root access
        if (!ns.hasRootAccess(host)) continue;

        const maxRam = ns.getServerMaxRam(host);
        const usedRam = ns.getServerUsedRam(host);
        
        let availableRam = maxRam - usedRam;
        
        // Reserve RAM on home to prevent locking up the controller
        if (host === "home") {
            const RESERVED_HOME_RAM = 16; // Keep 16GB free for manual usage/daemons
            availableRam = Math.max(0, availableRam - RESERVED_HOME_RAM);
        }
        
        const threads = Math.floor(availableRam / scriptRam);

        if (threads > 0) {
            // Check if script is already running with these specific arguments
            if (ns.isRunning(scriptName, host, ...scriptArgs)) { 
                continue; 
            }
            
            ns.exec(scriptName, host, threads, ...scriptArgs);
            // ns.print(`Deployed ${scriptName} on ${host} with ${threads} threads.`);
        }
    }
}


/**
 * Distributes a specific number of threads of a script across available hosts.
 * @param {NS} ns
 * @param {string} scriptName
 * @param {number} neededThreads
 * @param {string[]} hosts
 * @param {any[]} scriptArgs
 * @returns {number} threadsDeployed
 */
export function distributeTask(ns, scriptName, neededThreads, hosts, scriptArgs = []) {
    let remainingThreads = neededThreads;
    const scriptRam = ns.getScriptRam(scriptName);
    
    if (scriptRam === 0) return 0;

    // Sort hosts: 'home' last to save its RAM for other things if possible?
    // Or just simple iteration.
    const sortedHosts = [...hosts].sort((a, b) => {
        // prioritize remote hosts over home
        if (a === 'home') return 1;
        if (b === 'home') return -1;
        // then by max ram descending (fill big servers first)
        return ns.getServerMaxRam(b) - ns.getServerMaxRam(a);
    });

    for (const host of sortedHosts) {
        if (remainingThreads <= 0) break;
        if (!ns.hasRootAccess(host)) continue;
        
        const maxRam = ns.getServerMaxRam(host);
        const usedRam = ns.getServerUsedRam(host);
        let availableRam = maxRam - usedRam;
        
        if (host === "home") {
             const RESERVED_HOME_RAM = 16; 
             availableRam = Math.max(0, availableRam - RESERVED_HOME_RAM);
        }

        const possibleThreads = Math.floor(availableRam / scriptRam);
        if (possibleThreads <= 0) continue;
        
        const threadsToLaunch = Math.min(remainingThreads, possibleThreads);
        
        ns.exec(scriptName, host, threadsToLaunch, ...scriptArgs);
        remainingThreads -= threadsToLaunch;
    }
    
    return neededThreads - remainingThreads;
}


/**
 * Deploys all scripts from /lib/, /util/, and /hack/ to a list of hosts.
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