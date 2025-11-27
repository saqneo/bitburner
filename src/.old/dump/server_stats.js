import * as map from '../lib/map.js'
import * as grow from '../cluster/grow.js'
import * as hack from '../cluster/hack.js'

/** @param {import('../..').NS} ns */
export async function main(ns) {
    map.getHackNodes(ns).forEach((host) => {
        if (ns.hasRootAccess(host) && !ns.args[0] || host == ns.args[0]) {
            ns.tprint(`-----`)
            ns.tprint(`Hostname: ${host}`)
            ns.tprint(`-----`)
            ns.tprint(`Rooted: ${ns.hasRootAccess(host)}`)
            ns.tprint(`Money: ${Math.floor(ns.getServerMoneyAvailable(host))} of ${Math.floor(ns.getServerMaxMoney(host))}`)
            ns.tprint(`Security: ${Math.floor(ns.getServerSecurityLevel(host))} > ${Math.floor(ns.getServerMinSecurityLevel(host))}`)
            ns.tprint(`-----`)
            let grow_parameters = grow.getGrowParameters(ns, host)
            ns.tprint(`Grow value: ${grow_parameters.value} in ${Math.floor(grow_parameters.hack_time/1000)}s.`)
            let hack_parameters = hack.getHackParameters(ns, host)
            ns.tprint(`Hack value: ${hack_parameters.value} in ${Math.floor(hack_parameters.hack_time/1000)}s.`)
            ns.tprint(`-----`)
            ns.tprint(`Money: ${ns.getServerMoneyAvailable(host)} of ${ns.getServerMaxMoney(host)}.`)
        }
    })
}