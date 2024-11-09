import {Cluster} from 'cluster.js'
import * as map from "../lib/map.js"

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
export function deploy(ns, cluster, prioritize_short = false) {
    // Sort hosts by how much expected money would be generated per thread-second, descending.
    let values = []
    let hosts = map.getHackNodes(ns);
    hosts.forEach((host) => {
        let money_available = ns.getServerMoneyAvailable(host)

        // Only include servers where growth does something.
        if (money_available * 1.1 <= ns.getServerMaxMoney(host)) {
            values.push(getGrowParameters(ns, host))
        }
    })

    if (prioritize_short) {
        values.sort((a,b) => {
            a.grow_time - b.grow_time
        })
    } else {
        values.sort((a, b) => b.value - a.value)
    }

    // Schedule as many as possible until the cluster rejects it.
    let grow_times = []
    let script = 'hack/grow.js'
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
        let threads_for_weaken = ns.growthAnalyzeSecurity(deployed.deployed, i.host) / ns.weakenAnalyze(1)
        let weakened = cluster.deploy(ns, Math.ceil(threads_for_weaken), followup_script, i.host, Math.max(0, i.grow_time - time_for_weaken))

        // Only factor in the weakening time if it was actually deployed.
        if (weakened.deployed > 0) {
            grow_times.push(Math.max(i.grow_time, time_for_weaken))
        } else {
            grow_times.push(i.grow_time)
        }
        // TODO: Terminate early if we can. Currently this conflicts with partial deployment and logic which detects existing deployments.
    }

    if (total_hosts.length > 0) {
        ns.tprint(`Cluster ${cluster.name} has ${total_deployed} threads of ${script} across [${total_hosts}]. `)
    }

    // If nothing ran, say we are ready to run again. Let the scheduler handle the rest.
    return grow_times
}

/** @param {import('../..').NS} ns */
export function getGrowParameters(ns, host) {
    let money_available = ns.getServerMoneyAvailable(host)
    let threads = ns.growthAnalyze(host, ns.getServerMaxMoney(host)/Math.max(1, ns.getServerMoneyAvailable(host)))
    let grow_time = ns.getGrowTime(host)
    let hack_chance = ns.hackAnalyzeChance(host)
    return {host: host, threads: Math.ceil(threads), grow_time: grow_time, value: money_available*hack_chance/threads/grow_time}
}