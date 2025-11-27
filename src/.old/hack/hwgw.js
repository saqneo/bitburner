import * as map from '../lib/map.js'
import * as formulas from '../lib/formulas.js'
/** @param {import('../..').NS} ns */
export async function main(ns) {
    new HwgwServer(ns, 'home', 0).deploy(ns)
}

export class HwgwServer {
    constructor(ns, host, target_index) {
        this.host = host
        this.index = target_index
        this.server_mutable = ns.getServer(host)
        this.cores = this.server_mutable.cores
    }

    /** @param {import('../..').NS} ns */
    deploy(ns) {
        if (!formulas.shouldUseFormulas(ns)) {
            return
        }

        let sorted_values = getHackNodesByValue(ns)
        let target = sorted_values[this.index]

        if (!target) {
            // No targets, try again when they might have been nuked.
            return [60 * 1 * 1000]
        }

        let top_n = 1
        // sorted_values.splice(1)
        sorted_values = [target]
        let max_time = 0
        sorted_values.forEach((host) => {
            max_time = Math.max(max_time, getCycleTime(ns, host).total_time)
        })

    
        let incremental_delay = 50
        let base_delay = 0
        for (let j = 0; j < top_n; j++) {
            if (!sorted_values[j]) {
                break
            }

            //  target = sorted_values[j]
            console.log(target)
            console.log(ns.getServer(target).hackDifficulty)
            let cost = this.getCycleCost(ns, target)
            let time = getCycleTime(ns, target)
            let threads = getCycleThreads(ns, target)
            let initializing = false

            let available_ram = ns.getServerMaxRam(this.host) - ns.getServerUsedRam(this.host)
            let i = 0
            for (; i < available_ram / cost && i < 100; i++) {
                let server = ns.getServer(target)
                let hack_delay = base_delay
                // If weaken_time will be within 200ms of hack_time, wait.
                let hweaken_delay = Math.max(time.hack_time - time.weaken_time + incremental_delay, 0) + base_delay
                // If grow_time will be within 200ms of the previous period, wait.
                let grow_delay = Math.max(Math.max(time.hack_time, time.weaken_time) - time.grow_time + 2*incremental_delay, 0) + base_delay
                // If weaken_time will be within 200ms of the previous period, wait. This will always be true.
                let gweaken_delay = Math.max(Math.max(Math.max(time.hack_time, time.weaken_time), time.grow_time) - time.weaken_time + 3*incremental_delay, 0) + base_delay
                // Don't hack unless the server is grown to max.
                console.log(server.hackDifficulty)
                console.log(server.minDifficulty)
                console.log(threads.hack_threads)
                console.log(threads.hweak_threads)
                console.log(threads.grow_threads)
                console.log(threads.gweak_threads)
                if (server.moneyAvailable > server.moneyMax * .95 && server.hackDifficulty < server.minDifficulty * 1.1) {
                    ns.exec('hack/hack.js', this.host, threads.hack_threads, target, hack_delay)
                } else {
                    initializing = true
                }
                ns.exec('hack/weaken.js', this.host, threads.hweak_threads, target, hweaken_delay)
                ns.exec('hack/grow.js', this.host, threads.grow_threads, target, grow_delay)
                ns.exec('hack/weaken.js', this.host, threads.gweak_threads, target, gweaken_delay)
                base_delay += 4*incremental_delay
                if (initializing) {
                    if (i > 100) {
                        break
                    }
                }
            }

            if (i > 0) {
                ns.tprint(`HWGW: Using ${this.host} to ${initializing ? 'initialize' : 'attack'} ${target} ${i} times in ${Math.floor((max_time + base_delay)/1000)}s.`)
            }
        }

        return [ max_time + base_delay ]
    }

    /** @param {import('../..').NS} ns */
    getCycleCost(ns, host) {
        let threads = getCycleThreads(ns, host, this.cores)
        return threads.grow_threads * ns.getScriptRam('hack/grow.js') + threads.hack_threads * ns.getScriptRam('hack/weaken.js') + (threads.gweak_threads + threads.hweak_threads) * ns.getScriptRam('weaken.js')
    }
}

/** @param {import('../..').NS} ns */
export function getHackNodesByValue(ns) {
    if (!formulas.shouldUseFormulas(ns)) {
        return []
    }
    let result = map.getHackNodes(ns).map((host) => {
        return { host: host, value: getCycleValue(ns, host) }
    }).sort((a, b) => b.value - a.value).map((a) => a.host)
    return result
}

/** @param {import('../..').NS} ns */
function getCycleValue(ns, host) {
    let server = ns.getServer(host)
    server.hackDifficulty = server.minDifficulty

    let total_time = getCycleTime(ns, host).total_time
    let total_threads = getCycleThreads(ns, host, 1).total_threads

    return server.moneyMax / (total_time * total_threads)
}

/** @param {import('../..').NS} ns */
function getCycleThreads(ns, host, cores) {
    let player = ns.getPlayer()
    let server = ns.getServer(host)
    let HACK_AMOUNT = 0.4
    server.moneyAvailable = server.moneyMax * (1 - HACK_AMOUNT)
    server.hackDifficulty = server.minDifficulty
    let grow_threads = ns.formulas.hacking.growThreads(server, player, server.moneyMax, cores) // Overgrow.

    server.moneyAvailable = server.moneyMax
    let hack_threads = Math.floor(HACK_AMOUNT / ns.formulas.hacking.hackPercent(server, player)) // Don't overhack.
    let gweak_threads = Math.ceil(ns.growthAnalyzeSecurity(grow_threads, null, cores) / ns.weakenAnalyze(1, cores)) // Overweaken after grow.
    let hweak_threads = Math.ceil(ns.hackAnalyzeSecurity(hack_threads) / ns.weakenAnalyze(1, cores)) // Overweaken after hack.
    return { total_threads: grow_threads + hack_threads + gweak_threads + hweak_threads, grow_threads: grow_threads, hack_threads: hack_threads, gweak_threads: gweak_threads, hweak_threads: hweak_threads }
}

/** @param {import('../..').NS} ns */
function getCycleTime(ns, host) {
    let player = ns.getPlayer()
    let server = ns.getServer(host)

    server.hackDifficulty = server.minDifficulty
    let grow_time = ns.formulas.hacking.growTime(server, player)
    let weaken_time = ns.formulas.hacking.weakenTime(server, player)
    let hack_time = ns.formulas.hacking.hackTime(server, player)

    return { total_time: Math.max(grow_time, weaken_time, hack_time), grow_time: grow_time, weaken_time: weaken_time, hack_time: hack_time }
}