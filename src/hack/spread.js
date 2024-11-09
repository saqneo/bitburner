import * as map from '../lib/map.js'

/** @param {import('../..').NS} ns */
export function spread(ns) {
    let hacking_level = ns.getHackingLevel()

    let port_openers = new Set()
    if (ns.fileExists('BruteSSH.exe')) {
        port_openers.add(ns.brutessh)
    }
    if (ns.fileExists('FTPCrack.exe')) {
        port_openers.add(ns.ftpcrack)
    }
    if (ns.fileExists('relaySMTP.exe')) {
        port_openers.add(ns.relaysmtp)
    }
    if (ns.fileExists('HTTPWorm.exe')) {
        port_openers.add(ns.httpworm)
    }
    if (ns.fileExists('SQLInject.exe')) {
        port_openers.add(ns.sqlinject)
    }

    map.getAllNodes(ns).forEach((a) => {
        let required_hacking_level = ns.getServerRequiredHackingLevel(a)
        if (hacking_level < required_hacking_level) {
        return
        }

        if (!ns.hasRootAccess(a)) {
        let ports_required = ns.getServerNumPortsRequired(a)
        if (ports_required <= port_openers.size) {
            port_openers.forEach((o) => {
            o(a)
            })
        } else {
            ns.tprint(a + " requirement not met: getServerNumPortsRequired()=" + ports_required)
            return
        }

        ns.tprint(`Nuking ${a}.`)
        ns.nuke(a)
        }
    })
}

export async function main(ns) {
    spread(ns)
}