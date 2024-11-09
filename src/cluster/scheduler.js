import {Cluster} from './cluster.js'
import * as contract from '../lib/contract.js'
import * as hacknet from '../buy/hacknet.js'
import * as server from '../buy/server.js'
import * as spread from '../hack/spread.js'
import * as grow from './grow.js'
import * as hack from './hack.js'
import * as weaken from './weaken.js'
/** @param {import('../..').NS} ns */
export async function main(ns) {
    //let grow_cluster = new Cluster(ns, 0.6, 'shard_grow')
    let hack_cluster = new Cluster(ns, 0.8, 'shard_hack')
    let weaken_cluster = new Cluster(ns, 0.1, 'shard_weaken')

    // The scheduler will run grow, hack, and weaken with their permitted cluster resources.
    let tasks = [
        {name: 'spread', task: spread.spread, args: [], when: Date.now()},
        {name: 'contract', task: contract.findContracts, args: [], when: Date.now()},
        {name: 'buyServer', task: server.buyServer, args: [], when: Date.now()},
        {name: 'hacknet', task: hacknet.buyHacknet, args: [], when: Date.now()},
        {name: 'weaken', task: weaken.deploy, args: [weaken_cluster], when: Date.now()},
        {name: 'hack', task: hack.deploy, args: [hack_cluster], when: Date.now()},
        //{name: 'grow', task: grow.deploy, args: [grow_cluster], when: Date.now()},
    ]

    tasks.push({name: 'print', task: printTasksPeriodic, args: [tasks], when: Date.now()})
    while (true) {
        let now = Date.now()

        // Sleep until the next task is ready. Built-in 1s delay to avoid quick reschedule loops due to time estimation errors.
        if (now < tasks[0].when) {
            let sleep_for = Math.min(11000, tasks[0].when - now)
            if (sleep_for > 10000) {
                share(ns)
            }
            await ns.sleep(sleep_for)
            continue
        }

        // Get the front task and run it, and schedule it again with its projected completion time.
        let task = tasks.shift()
        let task_times = task.task(ns, ...task.args)
        if (!task_times || task_times.length == 0) {
            if (tasks.some((task_other) => task_other.name == task.name)) {
                // Task will already be run again later. Release this extra copy.
                continue
            }

            // Default to 1 minute if there is no return value.
            task_times = [60 * 1 * 1000]
        }

        task_times.forEach((t) => {
            tasks.push({name: task.name, task: task.task, args: task.args, when: t + now})
        })

        // Put the task back into sorted order.
        tasks.sort((a, b) => {
            return a.when - b.when
        })

        compressTasks(ns, tasks)
    }
}

function printTasksPeriodic(ns, tasks) {
    let now = Date.now()
    ns.tprint(`Waiting for tasks in [${tasks.map((t) => Math.floor((t.when - now) / 1000))}] seconds.`)
}

function compressTasks(ns, tasks) {
    let ref_index = tasks.length - 1
    for (let i = tasks.length - 2; i >= 0; i--) {
        // Don't add a preceding task if the same task is within 10 seconds.
        if (tasks[i].name == tasks[i+1].name && tasks[ref_index].when - tasks[i].when < 10000) {
            continue
        }

        tasks.splice(i+1, ref_index - (i+1))
        ref_index = i
    }
}

/** @param {import('../..').NS} ns */
function share(ns) {
    let script = 'hack/share.js'
    let available_ram = ns.getServerMaxRam(ns.getServer().hostname) - ns.getServerUsedRam(ns.getServer().hostname)
    let script_ram = ns.getScriptRam(script)
    let threads = Math.floor(available_ram / script_ram)
    if (threads > 0) {
        ns.tprint(`${script} with ${threads} threads.`)
        ns.run(script, threads)
    }
}