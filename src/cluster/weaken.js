import {Cluster} from './cluster.js'
import * as map from '../lib/map.js'
import * as hwgw from '../hack/hwgw.js'

/** @param {import('../..').NS} ns */
export async function main(ns) {
    let cluster = new Cluster(ns, 0.9)
    if (ns.args[0]) {
        ns.tprint(`${cluster.deploy(ns, Infinity, 'hack/weaken.js', ns.args[0])}`)
        return
    }
    while (true) {
        let sleep_for = deploy(ns, cluster)
        await ns.sleep(Math.max(...sleep_for))
    }
}

/** @param {import('../..').NS} ns */
export function deploy(ns, cluster) {
    // Sort hosts by how much money could be generated per thread-second, descending.
    const WEAKEN_MULTIPLIER = 1.1
    let values = []
    let hosts = map.getHackNodes(ns);
    let forbidden = hwgw.getHackNodesByValue(ns).slice(0, ns.getPurchasedServers().length + 1)
    hosts.forEach((host) => {
        if (forbidden.some(e => host == e)) {
            return
        }
        pushIfValuable(ns, host, values)
    })
    values.sort((a, b) => b.value - a.value)

    // Schedule as many as possible until the cluster rejects it.
    let script = 'hack/weaken.js'
    let times = deployCommon(ns, cluster, values, script)

    // If nothing ran, say we are ready to run again. Let the scheduler handle the rest.
    return times
}

function deployCommon(ns, cluster, values, script, when = Date.now()) {
    let times = []
    let total_deployed = 0
    let total_hosts = []
    for (const i of values) {
        let deployed = cluster.deploy(ns, i.threads, script, i.host)

        if (deployed.total_deployed == 0) {
            continue
        }

        total_deployed += deployed.total_deployed
        total_hosts.push(i.host)

        if (deployed.total_deployed != i.threads) {
            // Didn't deploy everything, terminate early.
            break
        }

        if (deployed.deployed == 0) {
            continue
        }
        
        times.push(i.time)
    }

    if (total_hosts.length > 0) {
        ns.tprint(`Cluster ${cluster.name} has ${total_deployed} threads of ${script} across [${total_hosts}]. `)
    }

    return times
}

/** @param {import('../..').NS} ns */
export function getWeakenParameters(ns, host) {
    let threads = (ns.getServerSecurityLevel(host) - ns.getServerMinSecurityLevel(host)) / ns.weakenAnalyze(1)
    let weaken_time = ns.getWeakenTime(host)
    return {host: host, threads: Math.ceil(threads), time: weaken_time, value: 1/weaken_time}
}

/** @param {import('../..').NS} ns */
function pushIfValuable(ns, host, values) {
    if (ns.getServerSecurityLevel(host) > ns.getServerMinSecurityLevel(host)) {
        values.push(getWeakenParameters(ns, host))
    }
}
