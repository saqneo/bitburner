/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    // 1. Attempt programmatic purchase of WSE Account if missing
    if (!ns.stock.hasWseAccount()) {
        const cash = ns.getServerMoneyAvailable("home");
        if (cash >= 200000000) {
            if (ns.stock.purchaseWseAccount()) {
                ns.tprint("Daemon: [Stock Info] Successfully purchased WSE Account programmatically!");
            }
        } else {
            ns.tprint("Daemon: [Stock Info] Automated stock trading is offline. WSE Account ($200m) is required.");
            return;
        }
    }

    // 2. Attempt programmatic purchase of TIX API Access if WSE is owned but TIX is missing
    if (!ns.stock.hasTixApiAccess()) {
        const cash = ns.getServerMoneyAvailable("home");
        if (cash >= 5000000000) {
            if (ns.stock.purchaseTixApi()) {
                ns.tprint("Daemon: [Stock Info] Successfully purchased TIX API Access programmatically!");
            }
        } else {
            ns.tprint("Daemon: [Stock Info] Automated stock trading is offline. TIX API Access ($5b) is required.");
            return;
        }
    }

    // 3. Check if the stock trader is already running
    if (ns.scriptRunning("/util/stock-trader.js", "home")) {
        // Silently exit if it's already active to avoid log spam
        return;
    }

    // 4. Check if home has enough RAM to spawn the trader
    const freeRam = ns.getServerMaxRam("home") - ns.getServerUsedRam("home");
    const traderRam = ns.getScriptRam("/util/stock-trader.js") || 18.7;

    if (freeRam >= traderRam) {
        ns.tprint("Daemon: Automatically launching automated stock trader ('/util/stock-trader.js')...");
        ns.exec("/util/stock-trader.js", "home", 1);
    } else {
        ns.tprint(`Daemon: [Stock Info] Home does not have enough free RAM (${traderRam.toFixed(2)} GB) to start the trader automatically right now.`);
    }
}
