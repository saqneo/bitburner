import { updateCost } from '/lib/cost.js';

/**
 * Library functions for managing the hacknet array.
 * This version avoids using the ns.formulas API to keep RAM costs low.
 */

/**
 * Finds the single most cost-effective hacknet upgrade and performs it.
 * This includes purchasing new nodes or upgrading existing ones (level, RAM, cores).
 * @param {import('../..').NS} ns 
 * @returns {Promise<boolean>} - True if an action was taken, false otherwise.
 */
export async function manageHacknet(ns) {
    const money = ns.getServerMoneyAvailable("home");
    // Spend up to 5% of our current money, or 100% of it if money is below $100k
    // to kickstart early game hacknet income.
    let remainingBudget = money < 100000 ? money : money * 0.05;
    let upgradedAny = false;

    // Use a safety counter to avoid any infinite loop scenarios
    let loopSafety = 0;
    const maxUpgradesPerCycle = 1000;

    while (remainingBudget > 0 && loopSafety < maxUpgradesPerCycle) {
        loopSafety++;
        let bestUpgrade = { type: 'none', node: -1, cost: Infinity };
        const currentMoney = ns.getServerMoneyAvailable("home");
        // We cannot spend more than we have or what remains of our budget
        const limit = Math.min(remainingBudget, currentMoney);

        // --- 1. Evaluate purchasing a new node ---
        const purchaseCost = ns.hacknet.getPurchaseNodeCost();
        if (purchaseCost < bestUpgrade.cost && purchaseCost <= limit) {
            bestUpgrade = { type: 'purchase', cost: purchaseCost };
        }

        // --- 2. Evaluate upgrading existing nodes ---
        const numNodes = ns.hacknet.numNodes();
        for (let i = 0; i < numNodes; i++) {
            // Upgrade Level
            const levelCost = ns.hacknet.getLevelUpgradeCost(i, 1);
            if (levelCost < bestUpgrade.cost && levelCost <= limit) {
                bestUpgrade = { type: 'level', node: i, cost: levelCost };
            }

            // Upgrade RAM
            const ramCost = ns.hacknet.getRamUpgradeCost(i, 1);
            if (ramCost < bestUpgrade.cost && ramCost <= limit) {
                bestUpgrade = { type: 'ram', node: i, cost: ramCost };
            }

            // Upgrade Cores
            const coreCost = ns.hacknet.getCoreUpgradeCost(i, 1);
            if (coreCost < bestUpgrade.cost && coreCost <= limit) {
                bestUpgrade = { type: 'core', node: i, cost: coreCost };
            }
        }

        if (bestUpgrade.type === 'none') {
            break;
        }

        // --- 3. Perform the best action found ---
        let success = false;
        switch (bestUpgrade.type) {
            case 'purchase':
                success = ns.hacknet.purchaseNode() !== -1;
                if (success) {
                    ns.print(`SUCCESS: Purchased new hacknet node.`);
                    await updateCost(ns, 'hacknet', bestUpgrade.cost);
                }
                break;
            case 'level':
                success = ns.hacknet.upgradeLevel(bestUpgrade.node, 1);
                if (success) {
                    ns.print(`SUCCESS: Upgraded hacknet node ${bestUpgrade.node} level.`);
                    await updateCost(ns, 'hacknet', bestUpgrade.cost);
                }
                break;
            case 'ram':
                success = ns.hacknet.upgradeRam(bestUpgrade.node, 1);
                if (success) {
                    ns.print(`SUCCESS: Upgraded hacknet node ${bestUpgrade.node} RAM.`);
                    await updateCost(ns, 'hacknet', bestUpgrade.cost);
                }
                break;
            case 'core':
                success = ns.hacknet.upgradeCore(bestUpgrade.node, 1);
                if (success) {
                    ns.print(`SUCCESS: Upgraded hacknet node ${bestUpgrade.node} cores.`);
                    await updateCost(ns, 'hacknet', bestUpgrade.cost);
                }
                break;
        }

        if (success) {
            remainingBudget -= bestUpgrade.cost;
            upgradedAny = true;
        } else {
            // If the transaction failed, break to prevent infinite loops
            break;
        }
    }

    return upgradedAny;
}