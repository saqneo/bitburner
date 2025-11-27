/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.print("Hacknet automation script started.");

    while (true) {
        const currentMoney = ns.getServerMoneyAvailable("home");
        const numNodes = ns.hacknet.numNodes();
        // Budget scales down as more nodes are acquired, making spending more conservative.
        // Use Math.max(1, numNodes) to avoid division by zero when numNodes is 0.
        // The factor 0.02 is taken from the old script's MAX_COST_FRACTION.
        const DYNAMIC_BUDGET_FACTOR = 0.2 / Math.max(1, numNodes); 
        const budget = currentMoney * DYNAMIC_BUDGET_FACTOR; 
        let purchased = false;

        // track the best option found
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
            let success = false;
            switch (cheapest.type) {
                case 'node':
                    if (ns.hacknet.purchaseNode() !== -1) {
                        success = true;
                        ns.print(`Purchased new Hacknet Node for ${ns.formatNumber(cheapest.cost)}`);
                    }
                    break;
                case 'level':
                    if (ns.hacknet.upgradeLevel(cheapest.index, 1)) {
                        success = true;
                        ns.print(`Upgraded Node ${cheapest.index} Level for ${ns.formatNumber(cheapest.cost)}`);
                    }
                    break;
                case 'ram':
                    if (ns.hacknet.upgradeRam(cheapest.index, 1)) {
                        success = true;
                        ns.print(`Upgraded Node ${cheapest.index} RAM for ${ns.formatNumber(cheapest.cost)}`);
                    }
                    break;
                case 'core':
                    if (ns.hacknet.upgradeCore(cheapest.index, 1)) {
                        success = true;
                        ns.print(`Upgraded Node ${cheapest.index} Core for ${ns.formatNumber(cheapest.cost)}`);
                    }
                    break;
            }

            if (success) {
                purchased = true;
            }
        }

        // 4. Loop control
        if (purchased) {
            // If we bought something, try to buy again immediately (with a tiny yield)
            await ns.sleep(10);
        } else {
            // If nothing affordable, wait a bit before checking again
            await ns.sleep(1000);
        }
    }
}