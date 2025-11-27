import * as cluster from '../lib/cluster.js'
import * as map from '../lib/map.js'
import * as diag from '../lib/diag.js'

/** @param {import('../..').NS} ns */
export function deploy(ns, deploy_script) {
  let id = ns.pid
  if (ns.args.length > 1) {
    id = ns.args[1]
  }

  let hacking_level = ns.getHackingLevel()
  let threads_launched = 0

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

  cluster.kill(ns, deploy_script)
  map.getHackNodes(ns).forEach((a) => {
    if (a == 'home' || ns.getServer(a).purchasedByPlayer) {
      return
    }

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

      ns.nuke(a)
    }

    // If the script we're trying to deploy is already running, kill it
    // for intermediate activities.
    ns.ps(a).forEach((p) => {
      ns.scriptKill(deploy_script, a)
    })

    if (ns.getServerMaxMoney(a) == 0) {
      return
    }

    let ram_available = ns.getServerMaxRam(a) - ns.getServerUsedRam(a)
    let ram_needed = ns.getScriptRam(deploy_script)
    let threads = Math.floor(ram_available / ram_needed)
    if (threads < 1) {
      ns.tprint(a + " requirement not met: threads=" + threads)
      return
    }

    ns.scp(deploy_script, a)
    let child = ns.exec(deploy_script, a, threads, id)
    threads_launched += threads

    if (threads < 32) {
      let desired_threads = 32 - threads
      if (cluster.getAvailableThreads(ns, deploy_script) >= desired_threads) {
        if (cluster.deploy(ns, a, deploy_script, desired_threads, id)) {
          threads_launched += desired_threads
          ns.tprint(`Host ${a} with ${desired_threads} remote threads.`)
        }
      }
    }
  })

  ns.tprint("Launched " + threads_launched + " copies of " + deploy_script + ".")
  diag.printHackNodeStats(ns)
}

/** @param {NS} ns */
export async function main(ns) {
  deploy(ns, ns.args[0])
}
