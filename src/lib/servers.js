import { updateCost } from '/lib/cost.js';

/**
 * Library functions for managing purchased servers.
 */

/**
 * Buys or upgrades servers based on available money.
 * Prioritizes buying new servers up to the limit, then upgrades the best-value server.
 * This runs in a loop to perform multiple purchases or upgrades in a single cycle.
 * @param {import('../..').NS} ns 
 * @returns {Promise<boolean>} - True if any server was bought or upgraded, false otherwise.
 */
export async function manageServers(ns) {
    const maxServers = ns.cloud.getServerLimit();
    const money = ns.getServerMoneyAvailable("home");
    
    // Fixed Initial Budget Rule: Calculate 50% of money ONCE at the start.
    // Deduct costs from this budget during the loop to avoid recursive wallet draining.
    let remainingBudget = money * 0.5; 
    let actionTaken = false;

    // Safety counter to prevent any potential infinite loops
    let loopSafety = 0;
    const maxUpgradesPerCycle = 100;

    while (remainingBudget > 0 && loopSafety < maxUpgradesPerCycle) {
        loopSafety++;
        const currentMoney = ns.getServerMoneyAvailable("home");
        const limit = Math.min(remainingBudget, currentMoney);

        // Fetch the fresh list of servers in each iteration to reflect updates
        const myServers = ns.cloud.getServerNames();

        // --- 1. Purchase new servers if under the limit ---
        if (myServers.length < maxServers) {
            let bestRam = 0;
            let bestCost = 0;
            // Check for affordable servers, from 1PB down to 8GB (2**20 down to 2**3)
            for (let i = 20; i >= 3; i--) { 
                const ram = 2 ** i;
                const cost = ns.cloud.getServerCost(ram);
                if (cost <= limit) {
                    bestRam = ram;
                    bestCost = cost;
                    break;
                }
            }
            
            if (bestRam > 0) {
                const hostname = ns.cloud.purchaseServer(`owned-${myServers.length}`, bestRam);
                if (hostname) {
                    ns.tprint(`SUCCESS: Purchased new server: ${hostname} (${ns.format.ram(bestRam)})`);
                    await updateCost(ns, 'server', bestCost);
                    remainingBudget -= bestCost;
                    actionTaken = true;
                    continue; // Re-evaluate in next iteration
                }
            }
        }

        // --- 2. Upgrade existing servers if at the limit (or if no new server was affordable) ---
        if (myServers.length > 0) {
            let bestUpgrade = { server: null, ram: 0, cost: Infinity, ratio: 0 };

            for (const server of myServers) {
                const currentRam = ns.getServerMaxRam(server);
                const maxRam = 2 ** 20; // 1PB RAM limit
                if (currentRam >= maxRam) continue;

                const nextRam = currentRam * 2;
                const cost = ns.cloud.getServerUpgradeCost(server, nextRam);

                if (cost <= limit) {
                    const ratio = (nextRam - currentRam) / cost; // RAM gain per dollar
                    if (ratio > bestUpgrade.ratio) {
                        bestUpgrade = { server, ram: nextRam, cost, ratio };
                    }
                }
            }

            if (bestUpgrade.server) {
                if (ns.cloud.upgradeServer(bestUpgrade.server, bestUpgrade.ram)) {
                    ns.tprint(`SUCCESS: Upgraded server ${bestUpgrade.server} to ${ns.format.ram(bestUpgrade.ram)}.`);
                    await updateCost(ns, 'server', bestUpgrade.cost);
                    remainingBudget -= bestUpgrade.cost;
                    actionTaken = true;
                    continue; // Re-evaluate in next iteration
                }
            }
        }

        // If no affordable actions were found or succeeded, break the loop
        break;
    }

    return actionTaken;
}
