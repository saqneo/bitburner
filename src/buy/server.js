/** @param {import('../..').NS} ns */
export async function main(ns) {
    buyServer(ns)
}

/** @param {import('../..').NS} ns */
export function buyServer(ns) {
    let server_size = 2**10
    while (ns.getServerMoneyAvailable('home') > ns.getPurchasedServerCost(server_size)) {
        if (ns.purchaseServer('q',server_size) == '') {
            break
        }
    }

    let current_money = ns.getServerMoneyAvailable('home')
    let max_upgrade_spend = 0.1 / ns.getPurchasedServers().length
    ns.getPurchasedServers().forEach((server) => {
        if (current_money * max_upgrade_spend > ns.getPurchasedServerUpgradeCost(server, ns.getServerMaxRam(server) * 2)) {
            ns.upgradePurchasedServer(server, ns.getServerMaxRam(server)*2)
        }
    })
}