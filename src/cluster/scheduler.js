import {Cluster} from './cluster.js'
import {HwgwServer} from '../hack/hwgw.js'
// import * as contract from '../lib/contract.js'
import * as hacknet from '../buy/hacknet.js'
import * as spread from '../hack/spread.js'
import * as hack from './hack.js'
import * as weaken from './weaken.js'
import * as server from '../buy/server.js'

/** @param {import('../..').NS} ns */
export async function main(ns) {
    //let grow_cluster = new Cluster(ns, 0.6, 'shard_grow')
    let hack_cluster = new Cluster(ns, 0.8, 'shard_hack')
    let weaken_cluster = new Cluster(ns, 0.2, 'shard_weaken')

    // The scheduler will run grow, hack, and weaken with their permitted cluster resources.
    let tasks = [
        {name: 'spread', task: spread.spread, args: [], when: Date.now()},
        //{name: 'contract', task: contract.findContracts, args: [], when: Date.now()},
        {name: 'buyServer', task: server.buyServer, args: [], when: Date.now()},
        {name: 'hacknet', task: hacknet.buyHacknet, args: [], when: Date.now()},
        {name: 'weaken', task: weaken.deploy, args: [weaken_cluster], when: Date.now()},
        {name: 'hack', task: hack.deploy, args: [hack_cluster], when: Date.now()},
        //{name: 'grow', task: grow.deploy, args: [grow_cluster], when: Date.now()},
    ]

    let added_hwgw = false
    tasks.push({name: 'print', task: printTasksPeriodic, args: [tasks], when: Date.now()})
    while (true) {
        let now = Date.now()
        if (!added_hwgw && ns.fileExists('Formulas.exe')) {
            added_hwgw = true
            let i = 0
            tasks.push({name: `hwgw${i}`, task: 'deploy', args: [], when: Date.now(), instance: new HwgwServer(ns, 'home', i)},)
            i++
            ns.getPurchasedServers().forEach((host) => {
                tasks.push({name: `hwgw${i}`, task: 'deploy', args: [], when: Date.now(), instance: new HwgwServer(ns, host, i)},)
                i++
            })
        }
        // Sleep until the next task is ready. Built-in 1s delay to avoid quick reschedule loops due to time estimation errors.
        if (now < tasks[0].when) {
            let sleep_for = Math.min(11000, tasks[0].when - now)
            if (sleep_for > 10000) {
                // This can be any cluster shard, see function comment.
                share(ns)
                //weaken_cluster.share(ns)
            }
            await ns.sleep(sleep_for)
            continue
        } else {
            // Yield thread in case it's slammed with tasks.
            await ns.sleep(1)
        }

        // Get the front task and run it, and schedule it again with its projected completion time.
        let task = tasks.shift()
        let task_times = []
        if (task.instance) {
            task_times = task.instance[task.task](ns)
        } else {
            task_times = task.task(ns, ...task.args)
        }
        if (!task_times || task_times.length == 0) {
            if (tasks.some((task_other) => task_other.name == task.name)) {
                // Task will already be run again later. Release this extra copy.
                continue
            }

            // Default to 1 minute if there is no return value.
            task_times = [60 * 1 * 1000]
        }

        task_times.forEach((t) => {
            tasks.push({name: task.name, task: task.task, args: task.args, when: t + now, instance: task.instance})
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
        if (tasks[i].name == tasks[i+1].name && tasks[ref_index].when - tasks[i].when < 12000) {
            continue
        }

        tasks.splice(i+1, ref_index - (i+1))

        // Still compress the task if it's close so we can take advantage of share.
        if (tasks[ref_index].when - tasks[i].when < 12000) {
            tasks[i].when = tasks[ref_index].when
        }
        ref_index = i
    }
}

/** @param {import('../..').NS} ns */
function share(ns) {
    let script = 'hack/share.js'
    ns.getPurchasedServers().concat('home').forEach((host) => {
        let available_ram = ns.getServerMaxRam(host) - ns.getServerUsedRam(host)
        let script_ram = ns.getScriptRam(script)
        let threads = Math.floor(available_ram / script_ram)
        if (threads > 0) {
            ns.tprint(`Sharing ${host} with ${threads} threads.`)
            ns.scp(script, host)
            ns.exec(script, host, threads)
        }
    })
}