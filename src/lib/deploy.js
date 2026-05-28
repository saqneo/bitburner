/**
 * Utility functions for deploying scripts across the network.
 */

/**
 * Deploys all scripts from /lib/, /util/, and /hack/ to a list of hosts.
 * @param {NS} ns
 * @param {string[]} hosts - An array of hostnames to deploy the libraries to.
 * @returns {Promise<void>}
 */
export async function deployLibs(ns, hosts) {
    const remoteHosts = hosts.filter(h => h !== "home");
    if (remoteHosts.length === 0) return;

    // Use full list of home files and filter containing folder names to handle paths with or without leading slashes robustly
    const allFiles = ns.ls("home");
    const allLibs = allFiles.filter(f => 
        (f.includes('lib/') || f.includes('util/') || f.includes('hack/')) && 
        f.endsWith('.js')
    );

    ns.print(`Deployment: Found ${allLibs.length} scripts to deploy.`);
    if (allLibs.length === 0) {
        ns.print(`WARNING: No scripts found under lib/, util/, or hack/ directories on home!`);
        return;
    }

    for (const host of remoteHosts) {
        ns.print(`Deployment: Syncing scripts to ${host}...`);
        const success = await ns.scp(allLibs, host, "home");
        if (!success) {
            ns.print(`ERROR: Failed to scp scripts to ${host}!`);
        }
    }
}