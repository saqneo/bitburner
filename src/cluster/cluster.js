import * as map from '../lib/map.js'

/** @param {import('../..').NS ns} */
export async function main(ns) {
    ns.tprint(`Cluster Available RAM: ${getClusterMaxRam(ns) - getClusterUsedRam(ns)}GB of ${getClusterMaxRam(ns)}GB`)
}

/** @param {import('../..').NS ns} */
export function getClusterMaxRam(ns) {
    let max_ram = 0
    getClusterHosts(ns).forEach((host) => {
        max_ram += ns.getServerMaxRam(host)
    })
    return max_ram
}

/** @param {import('../..').NS ns} */
function getPurchasedServerRam(ns) {
    let total_ram = 0
    ns.getPurchasedServers().forEach((host) => {
        total_ram += ns.getServer(host).maxRam
    })
    return total_ram
}

/** @param {import('../..').NS ns} */
function getClusterUsedRam(ns) {
    let used_ram = 0
    getClusterHosts(ns).forEach((host) => {
        used_ram += ns.getServerUsedRam(host)
    })
    return used_ram
}

/** @param {import('../..').NS ns} */
function getClusterHosts(ns) {
    let hosts = map.getAllNodes(ns)
    let cluster_nodes = []
    hosts.forEach((host) => {
        // Don't include 'home' in the cluster if forumlas are unlocked and we have enough ram to sustain the cluster via purchased servers.
        if ((host == 'home' || ns.getServer(host).purchasedByPlayer) && ns.fileExists('Formulas.exe')) {
            return
        }

        if (ns.hasRootAccess(host)) {
            cluster_nodes.push(host)
        }
    })

    return cluster_nodes
}

export class Cluster {
    constructor(ns, usage_fraction, name) {
        this.usage_fraction = usage_fraction
        this.usage = []
        this.used = 0
        this.name = 'unnamed_cluster'
        if (name) {
            this.name = name
        }
    }

    /** @param {import('../..').NS ns} */
    refreshUsage(ns) {
        for (let i = this.usage.length - 1; i >=0; i--){
            if (!ns.isRunning(this.usage[i].pid, this.usage[i].host)) {
                this.used -= this.usage[i].ram
                this.usage.splice(i, 1)
            }
        }
    }

    /** @param {import('../..').NS ns} */
    share(ns) { 
        let script = 'hack/share.js'
        const script_ram = ns.getScriptRam('hack/share.js');

        // TODO: This is currently shared across the whole cluster and therefore needs to be used by the scheduler instead of a shard owner.
        let total_threads = 0
        ns.getPurchasedServers().forEach((host) => {
            let available_ram = ns.getServerMaxRam(host) - ns.getServerUsedRam(host)
            let threads = Math.floor(available_ram/script_ram)
            if (threads) {
                total_threads += threads
                ns.scp(script, host)
                ns.exec(script, host, threads)
            }
        })

        if (total_threads > 0) {
            ns.tprint(`Sharing cluster on ${total_threads} threads.`)
        }
    }

    /**
     * Deploys a script on the server with the specified number of threads.
     *
     * @param {import('../..').NS ns}
     * @param {string} script - The script being deployed. Should be lightweight.
     * @param {number} desired_threads - The desired number of threads to deploy to the cluster.  If insufficient RAM is available, will automatically try to deploy with fewer threads.
     * @returns {[number, number]} The number of threads which were deployed to the cluster by this invocation, and the number of total threads allocated to the task.
     */
    deploy(ns, threads_desired, script, ...script_args) {
        this.refreshUsage(ns)
        let adjusted_threads_desired = threads_desired
        // Check if anybody in the cluster is already running this task for this host and account for the currently deployed threads.
        let script_id = `${script} ${script_args}`
        this.usage.forEach((u) => {
            if (u.script_id == script_id) {
                adjusted_threads_desired -= u.threads
            }
        })
        let threads_deployed = 0;

        const script_ram = ns.getScriptRam(script);
        let threads_allowed = Math.min(Math.floor((this.usage_fraction * getClusterMaxRam(ns) - this.used) / script_ram), adjusted_threads_desired)

        if (script_ram === 0) {
            ns.tprint(`ERROR: Script ${script} not found or doesn't use RAM.`);
            return 0; // Return 0 if the script is invalid
        }
    
        for (const host of getClusterHosts(ns)) {
            // Might already be deployed, so check at the front of the loop.
            if (threads_deployed >= threads_allowed) {
                break
            }

            // Deploy as many threads as possible up to the requested amount.
            let available_ram = (ns.getServerMaxRam(host) - ns.getServerUsedRam(host))
            let deploy_threads = Math.min(Math.floor(available_ram / script_ram), threads_allowed - threads_deployed)
            if (deploy_threads == 0) {
                continue
            }

            // Copy, execute, and track the task.
            ns.scp(script, host)
            let pid = ns.exec(script, host, deploy_threads, ...script_args)
            threads_deployed += deploy_threads
            let ram_used = deploy_threads * script_ram
            this.usage.push({host: host, script_id: script_id, pid: pid, ram: ram_used, threads: deploy_threads})
            this.used += ram_used
        }
    
        // if (threads_deployed) {
        //     ns.tprint(`Deployed "${script_id}" with ${threads_deployed} of ${adjusted_threads_desired} desired instances.`)
        // }

        // Number deployed this time, and total number based on total desired.
        return {deployed: threads_deployed, total_deployed: threads_desired - (adjusted_threads_desired - threads_deployed)}
    }
}
