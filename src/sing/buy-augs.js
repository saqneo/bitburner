/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    const planPath = "/data/sing-purchase-plan.json";
    if (!ns.fileExists(planPath)) {
        ns.tprint("ERROR: Singularity purchase plan file not found.");
        return;
    }

    let plan;
    try {
        plan = JSON.parse(ns.read(planPath));
    } catch (e) {
        ns.tprint(`ERROR: Failed to parse purchase plan: ${e}`);
        return;
    }

    if (!plan || !plan.augs || plan.augs.length === 0) {
        ns.tprint("Singularity: Purchase plan is empty. Nothing to buy.");
        return;
    }

    ns.tprint(`Singularity: Starting automated augmentation purchase of ${plan.augs.length} items...`);

    // 1. Kill stock trader to prevent it from buying stocks during prestige
    if (ns.scriptRunning("/util/stock-trader.js", "home")) {
        ns.tprint("Singularity: Killing stock-trader.js...");
        ns.kill("/util/stock-trader.js", "home");
        await ns.sleep(500); // Wait for scripts to terminate cleanly
    }

    // 2. Liquidate all stocks to reclaim cash
    try {
        const symbols = ns.stock.getSymbols();
        let liquidatedCount = 0;
        let liquidatedValue = 0;
        for (const sym of symbols) {
            const [sharesLong] = ns.stock.getPosition(sym);
            if (sharesLong > 0) {
                const sellPrice = ns.stock.sellStock(sym, sharesLong);
                if (sellPrice > 0) {
                    liquidatedCount++;
                    liquidatedValue += sharesLong * sellPrice;
                }
            }
        }
        if (liquidatedCount > 0) {
            ns.tprint(`Singularity: Liquidated ${liquidatedCount} stock positions for $${ns.format.number(liquidatedValue)}`);
        }
    } catch (e) {
        ns.print(`Could not liquidate stocks: ${e}`);
    }

    let purchasedCount = 0;

    for (const item of plan.augs) {
        ns.tprint(`Singularity: Purchasing '${item.name}' from '${item.faction}'...`);
        if (ns.singularity.purchaseAugmentation(item.faction, item.name)) {
            ns.tprint(`SUCCESS: Purchased '${item.name}'`);
            purchasedCount++;
        } else {
            ns.tprint(`WARNING: Failed to purchase '${item.name}'`);
        }
    }

    ns.tprint(`Singularity: Purchased ${purchasedCount}/${plan.augs.length} augmentations in this cycle.`);

    if (plan.shouldInstall && purchasedCount > 0) {
        ns.tprint("--------------------------------------------------");
        ns.tprint("CRITICAL: AUTOMATIC PRESTIGE (SOFT RESET) INITIATED.");
        ns.tprint("Callback script: /daemon.js");
        ns.tprint("--------------------------------------------------");
        
        // Let user see the console output briefly
        await ns.sleep(3000);
        
        ns.singularity.installAugmentations("/daemon.js");
    } else {
        ns.tprint("Singularity: Augmentations purchased. No reset triggered.");
    }
}
