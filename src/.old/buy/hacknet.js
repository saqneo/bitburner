/** @param {import('../..').NS} ns */
export async function main(ns) {
  buyHacknet(ns)
}
  
/** @param {import('../..').NS} ns */
export function buyHacknet(ns) {
  let num_nodes = ns.hacknet.numNodes()
  const MAX_COST_FRACTION = 0.02 / num_nodes
  for (let n = 0; n < num_nodes; n++) {
    while (ns.getServerMoneyAvailable('home') > ns.hacknet.getLevelUpgradeCost(n) / MAX_COST_FRACTION) {
      if (!ns.hacknet.upgradeLevel(n)) {
        break
      }   
    }
  }

  for (let n = 0; n < num_nodes; n++) {
    while (ns.getServerMoneyAvailable('home') > ns.hacknet.getRamUpgradeCost(n) / MAX_COST_FRACTION) {
      if (!ns.hacknet.upgradeRam(n)) {
        break
      }
    }
  }

  for (let n = 0; n < num_nodes; n++) {
    while (ns.getServerMoneyAvailable('home') > ns.hacknet.getCoreUpgradeCost(n) / MAX_COST_FRACTION) {
      if (!ns.hacknet.upgradeCore(n)) {
        break
      }
    }
  }

  while (ns.getServerMoneyAvailable('home') > ns.hacknet.getPurchaseNodeCost() / MAX_COST_FRACTION) {
    if (ns.hacknet.purchaseNode() == -1) {
      break
    }
  }
}
