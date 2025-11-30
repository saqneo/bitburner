import { updateCost } from '/lib/cost.js';

/**
 * Library functions for managing purchased servers.
 */

/**
 * Buys or upgrades servers based on available money.
 * Prioritizes buying new servers up to the limit, then upgrades the best-value server.
 * @param {import('../..').NS} ns 
 * @returns {Promise<boolean>} - True if a server was bought or upgraded, false otherwise.
 */
export async function manageServers(ns) {
    const maxServers = ns.getPurchasedServerLimit();
    const myServers = ns.getPurchasedServers();
    const money = ns.getServerMoneyAvailable("home");
    const budget = money * 0.5; // Use 50% of available money for server infrastructure

    // --- 1. Purchase new servers if under the limit ---
    if (myServers.length < maxServers) {
        let bestRam = 0;
        let bestCost = 0;
        // Check for affordable servers, from 1PB down to 8GB
        for (let i = 20; i >= 3; i--) { 
            const ram = 2 ** i;
            const cost = ns.getPurchasedServerCost(ram);
            if (cost <= budget) {
                bestRam = ram;
                bestCost = cost;
                break;
            }
        }
        
        if (bestRam > 0) {
            const hostname = ns.purchaseServer(`owned-${myServers.length}`, bestRam);
            if (hostname) {
                ns.tprint(`SUCCESS: Purchased new server: ${hostname} (${ns.formatRam(bestRam)})`);
                await updateCost(ns, 'server', bestCost);
                return true;
            }
        }
    }

    // --- 2. Upgrade existing servers if at the limit (or if no new server was affordable) ---
    let bestUpgrade = { server: null, ram: 0, cost: Infinity, ratio: 0 };

    for (const server of myServers) {
        const currentRam = ns.getServerMaxRam(server);
        const maxRam = 2 ** 20; // 1PB RAM limit
        if (currentRam >= maxRam) continue;

        const nextRam = currentRam * 2;
        const cost = ns.getPurchasedServerUpgradeCost(server, nextRam);

        if (cost <= budget) {
            const ratio = (nextRam - currentRam) / cost; // RAM gain per dollar
            if (ratio > bestUpgrade.ratio) {
                bestUpgrade = { server, ram: nextRam, cost, ratio };
            }
        }
    }

    if (bestUpgrade.server) {
        if (ns.upgradePurchasedServer(bestUpgrade.server, bestUpgrade.ram)) {
            ns.tprint(`SUCCESS: Upgraded server ${bestUpgrade.server} to ${ns.formatRam(bestUpgrade.ram)}.`);
            await updateCost(ns, 'server', bestUpgrade.cost);
            return true;
        }
    }
    
    // ns.print("INFO: No affordable server actions found this cycle.");
    return false;
}
