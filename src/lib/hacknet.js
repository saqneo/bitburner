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
    const budget = money * 0.25; // Use 2% of available money for hacknet

    let bestUpgrade = { type: 'none', node: -1, cost: Infinity };

    // --- 1. Evaluate purchasing a new node ---
    const purchaseCost = ns.hacknet.getPurchaseNodeCost();
    if (purchaseCost < bestUpgrade.cost && purchaseCost <= budget) {
        bestUpgrade = { type: 'purchase', cost: purchaseCost };
    }

    // --- 2. Evaluate upgrading existing nodes ---
    const numNodes = ns.hacknet.numNodes();
    for (let i = 0; i < numNodes; i++) {
        // Upgrade Level
        const levelCost = ns.hacknet.getLevelUpgradeCost(i, 1);
        if (levelCost < bestUpgrade.cost && levelCost <= budget) {
            bestUpgrade = { type: 'level', node: i, cost: levelCost };
        }

        // Upgrade RAM
        const ramCost = ns.hacknet.getRamUpgradeCost(i, 1);
        if (ramCost < bestUpgrade.cost && ramCost <= budget) {
            bestUpgrade = { type: 'ram', node: i, cost: ramCost };
        }

        // Upgrade Cores
        const coreCost = ns.hacknet.getCoreUpgradeCost(i, 1);
        if (coreCost < bestUpgrade.cost && coreCost <= budget) {
            bestUpgrade = { type: 'core', node: i, cost: coreCost };
        }
    }

    // --- 3. Perform the best action found ---
    switch (bestUpgrade.type) {
        case 'purchase':
            ns.hacknet.purchaseNode();
            ns.print(`SUCCESS: Purchased new hacknet node.`);
            await updateCost(ns, 'hacknet', bestUpgrade.cost);
            return true;
        case 'level':
            ns.hacknet.upgradeLevel(bestUpgrade.node, 1);
            ns.print(`SUCCESS: Upgraded hacknet node ${bestUpgrade.node} level.`);
            await updateCost(ns, 'hacknet', bestUpgrade.cost);
            return true;
        case 'ram':
            ns.hacknet.upgradeRam(bestUpgrade.node, 1);
            ns.print(`SUCCESS: Upgraded hacknet node ${bestUpgrade.node} RAM.`);
            await updateCost(ns, 'hacknet', bestUpgrade.cost);
            return true;
        case 'core':
            ns.hacknet.upgradeCore(bestUpgrade.node, 1);
            ns.print(`SUCCESS: Upgraded hacknet node ${bestUpgrade.node} cores.`);
            await updateCost(ns, 'hacknet', bestUpgrade.cost);
            return true;
        case 'none':
        default:
            return false;
    }
}