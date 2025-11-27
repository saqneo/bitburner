/** @param {import('../..').NS} ns */
export function getAllNodes(ns) {
    var adjacent = new Set(ns.scan())
    do {
      var pre_len = adjacent.size
      var to_add = []
      adjacent.forEach((a) => {
        to_add = to_add.concat(ns.scan(a))
      })
      to_add = to_add.concat([...adjacent])
      
      to_add.forEach((host) => {
        if (!adjacent.has(host)) {
          adjacent.add(host)
        }
      })
    } while(pre_len != adjacent.size)

    return [...adjacent]
}
  
/** @param {import('../..').NS} ns */
export function getHackNodes(ns) {
  return getAllNodes(ns).filter((host) => !isFriendlyServer(ns, host) && ns.hasRootAccess(host))
}

/** @param {import('../..').NS} ns */
function isFriendlyServer(ns, host) {
  let server = ns.getServer(host)
  return server.host == 'home' || server.purchasedByPlayer || !server.moneyMax
}