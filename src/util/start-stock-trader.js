/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    // 1. Check WSE and TIX API ownership.
    // If they are missing, run the heavy transient purchase script to buy them if cash permits.
    const cash = ns.getServerMoneyAvailable("home");
    const hasWse = ns.stock.hasWseAccount();
    const hasTix = ns.stock.hasTixApiAccess();
    const has4SData = hasTix && ns.stock.has4SData();
    const has4SAPI = has4SData && ns.stock.has4SDataTixApi();

    const needWse = !hasWse;
    const needTix = hasWse && !hasTix;
    const need4SData = hasTix && !has4SData;
    const need4SAPI = has4SData && !has4SAPI;

    const canAffordWse = cash >= 200000000;
    const canAffordTix = cash >= 5000000000;
    const canAfford4SData = cash >= 1000000000;
    const canAfford4SAPI = cash >= 25000000000;

    const shouldRunPurchaser = (needWse && canAffordWse) || 
                               (needTix && canAffordTix) || 
                               (need4SData && canAfford4SData) || 
                               (need4SAPI && canAfford4SAPI);

    if (shouldRunPurchaser) {
        if (!ns.scriptRunning("/util/purchase-stock-api.js", "home")) {
            ns.tprint("Daemon: [Stock Info] Starting transient purchase helper '/util/purchase-stock-api.js'...");
            ns.exec("/util/purchase-stock-api.js", "home", 1);
        }
    }

    // Exit early if basic APIs required to run the trader are missing
    if (!hasWse || !hasTix) {
        if (!canAffordWse && needWse) {
            ns.print("Daemon: [Stock Info] Automated stock trading is offline. WSE Account ($200m) is required.");
        }
        return;
    }

    // 2. Check if the stock trader is already running
    if (ns.scriptRunning("/util/stock-trader.js", "home")) {
        // Silently exit if it's already active to avoid log spam
        return;
    }

    // 3. Check if home has enough RAM to spawn the trader
    const freeRam = ns.getServerMaxRam("home") - ns.getServerUsedRam("home");
    const traderRam = ns.getScriptRam("/util/stock-trader.js") || 18.7;

    if (freeRam >= traderRam) {
        ns.tprint("Daemon: Automatically launching automated stock trader ('/util/stock-trader.js')...");
        ns.exec("/util/stock-trader.js", "home", 1);
    } else {
        ns.tprint(`Daemon: [Stock Info] Home does not have enough free RAM (${traderRam.toFixed(2)} GB) to start the trader automatically right now.`);
    }
}
