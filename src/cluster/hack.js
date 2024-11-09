import {Cluster} from 'cluster.js'
import * as map from "../lib/map.js"
import * as grow from "./grow.js"

/** @param {import('../..').NS} ns */
export async function main(ns) {
    let cluster = new Cluster(ns, 0.9)
    if (ns.args[0]) {
        ns.tprint(`Using ${Math.floor(ns.getGrowTime(ns.args[0])/1000)}s across ${cluster.deploy(ns, Infinity, 'hack/grow.js', ns.args[0])} cluster hosts.`)
        return
    }

    while(true) {
        let sleep_for = deploy(ns, cluster)
        ns.sleep(sleep_for)
    }
}

/** @param {import('../..').NS} ns */
export function deploy(ns, cluster) {
    // Sort hosts by how much expected money would be generated per thread-second, descending.
    let values = []
    let hosts = map.getHackNodes(ns);
    hosts.forEach((host) => {
        let money_available = ns.getServerMoneyAvailable(host)

        // Only include servers where hacking doesn't deplete.
        if (money_available >= 0.9 * ns.getServerMaxMoney(host) && ns.hackAnalyzeChance(host) > 0) {
            values.push(getHackParameters(ns, host))
        }
    })
    values.sort((a, b) => b.value - a.value)

    // Schedule as many as possible until the cluster rejects it.
    let hack_times = []
    let script = 'hack/hack.js'
    let followup_script = 'hack/weaken.js'
    let total_deployed = 0
    let total_hosts = []
    for (const i of values) {
        let deployed = cluster.deploy(ns, i.threads, script, i.host)

        if (deployed.total_deployed == 0) {
            break
        }

        total_deployed += deployed.total_deployed
        total_hosts.push(i.host)

        if (deployed.deployed == 0) {
            continue
        }

        // Try to weaken to account for the grow. This could fail and we don't care because the weaken thread will take care of it eventually.
        let time_for_weaken = ns.getWeakenTime(i.host)
        let threads_for_weaken = ns.hackAnalyzeSecurity(deployed.deployed, i.host) / ns.weakenAnalyze(1)
        let weakened = cluster.deploy(ns, Math.ceil(threads_for_weaken), followup_script, i.host, Math.max(0, i.hack_time - time_for_weaken))

        // Only factor in the weakening time if it was actually deployed.
        if (weakened.deployed > 0) {
            hack_times.push(Math.max(i.hack_time, time_for_weaken))
        } else {
            hack_times.push(i.hack_time)
        }
        // TODO: Terminate early if we can. Currently this conflicts with partial deployment and logic which detects existing deployments.
    }

    if (total_hosts.length > 0) {
        ns.tprint(`Cluster ${cluster.name} has ${total_deployed} threads of ${script} across [${total_hosts}]. `)
    }
    // Fall back to grow if there is no node to hack.
    // TODO: Optimize for second place in case grow() is already running.
    return hack_times.concat(grow.deploy(ns, cluster, true))
}

/** @param {import('../..').NS} ns */
export function getHackParameters(ns, host) {
    let HACK_MULTIPLE = 0.4
    let money_available = ns.getServerMoneyAvailable(host)
    let threads = Math.ceil(HACK_MULTIPLE / ns.hackAnalyze(host))
    let hack_time = ns.getHackTime(host)
    let hack_chance = ns.hackAnalyzeChance(host)
    return {host: host, threads: Math.ceil(threads), hack_time: hack_time, value: money_available*hack_chance/threads/hack_time}
}