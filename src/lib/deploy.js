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

    const libFiles = ns.ls("home", "/lib/").filter(f => f.endsWith('.js'));
    const utilFiles = ns.ls("home", "/util/").filter(f => f.endsWith('.js'));
    const hackFiles = ns.ls("home", "/hack/").filter(f => f.endsWith('.js'));
    const allLibs = [...libFiles, ...utilFiles, ...hackFiles];

    for (const host of remoteHosts) {
        await ns.scp(allLibs, host, "home");
    }
}