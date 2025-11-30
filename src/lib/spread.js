import * as map from '/lib/map.js'

/** 
 * Attempts to gain root access on all reachable servers.
 * @param {NS} ns 
 * @returns {boolean} True if at least one new server was nuked, False otherwise.
 */
export function spread(ns) {
    let hacking_level = ns.getHackingLevel()
    let port_openers = []

    // Check for available port opening programs
    if (ns.fileExists('BruteSSH.exe')) port_openers.push(ns.brutessh)
    if (ns.fileExists('FTPCrack.exe')) port_openers.push(ns.ftpcrack)
    if (ns.fileExists('relaySMTP.exe')) port_openers.push(ns.relaysmtp)
    if (ns.fileExists('HTTPWorm.exe')) port_openers.push(ns.httpworm)
    if (ns.fileExists('SQLInject.exe')) port_openers.push(ns.sqlinject)

    let targets = map.getAllNodes(ns)
    let nuked_count = 0
    for (const host of targets) {
        // Skip if we already have root access
        if (ns.hasRootAccess(host)) continue

        // Skip if we can't hack it yet
        if (hacking_level < ns.getServerRequiredHackingLevel(host)) continue

        // Check port requirements
        let ports_required = ns.getServerNumPortsRequired(host)
        if (ports_required <= port_openers.length) {
            // Open ports
            for (let i = 0; i < ports_required; i++) {
                port_openers[i](host)
            }
            // Nuke
            ns.nuke(host);
            ns.tprint(`Nuked '${host}'.`)
            nuked_count++
        }
    }
    
    if (nuked_count > 0) {
        ns.tprint(`Spread: Nuked ${nuked_count} new servers.`)
        return true;
    }
    
    return false;
}
