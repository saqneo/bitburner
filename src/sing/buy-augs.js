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
