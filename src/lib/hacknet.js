/** @param {NS} ns */
export async function upgradeHacknet(ns) {
    // Maximum percentage of current money to spend on a single upgrade/node
    const currentMoney = ns.getServerMoneyAvailable("home");
    const numNodes = ns.hacknet.numNodes();
    
    // Budget scales down as more nodes are acquired.
    const DYNAMIC_BUDGET_FACTOR = 0.2 / Math.max(1, numNodes); 
    const budget = currentMoney * DYNAMIC_BUDGET_FACTOR; 

    let cheapest = {
        cost: Infinity,
        type: null, // 'node', 'level', 'ram', 'core'
        index: -1
    };

    // 1. Check cost of a new node
    const nodeCost = ns.hacknet.getPurchaseNodeCost();
    if (nodeCost < cheapest.cost) {
        cheapest.cost = nodeCost;
        cheapest.type = 'node';
    }

    // 2. Check upgrades for all existing nodes
    for (let i = 0; i < numNodes; i++) {
        const levelCost = ns.hacknet.getLevelUpgradeCost(i, 1);
        const ramCost = ns.hacknet.getRamUpgradeCost(i, 1);
        const coreCost = ns.hacknet.getCoreUpgradeCost(i, 1);

        if (levelCost < cheapest.cost) {
            cheapest.cost = levelCost;
            cheapest.type = 'level';
            cheapest.index = i;
        }
        if (ramCost < cheapest.cost) {
            cheapest.cost = ramCost;
            cheapest.type = 'ram';
            cheapest.index = i;
        }
        if (coreCost < cheapest.cost) {
            cheapest.cost = coreCost;
            cheapest.type = 'core';
            cheapest.index = i;
        }
    }

    // 3. Execute if affordable and within budget
    if (cheapest.type && cheapest.cost <= budget) {
        switch (cheapest.type) {
            case 'node':
                if (ns.hacknet.purchaseNode() !== -1) {
                    ns.print(`Purchased new Hacknet Node for ${ns.formatNumber(cheapest.cost)}`);
                }
                break;
            case 'level':
                if (ns.hacknet.upgradeLevel(cheapest.index, 1)) {
                    ns.print(`Upgraded Node ${cheapest.index} Level for ${ns.formatNumber(cheapest.cost)}`);
                }
                break;
            case 'ram':
                if (ns.hacknet.upgradeRam(cheapest.index, 1)) {
                    ns.print(`Upgraded Node ${cheapest.index} RAM for ${ns.formatNumber(cheapest.cost)}`);
                }
                break;
            case 'core':
                if (ns.hacknet.upgradeCore(cheapest.index, 1)) {
                    ns.print(`Upgraded Node ${cheapest.index} Core for ${ns.formatNumber(cheapest.cost)}`);
                }
                break;
        }
        return true; // Bought something
    }
    return false; // Nothing bought
}