/** @param {NS} ns */
export async function main(ns) {
    ns.tprint("=== STOCK SYSTEM DIAGNOSTICS ===");

    // 1. API Status
    const hasWse = ns.stock.hasWseAccount();
    const hasTix = ns.stock.hasTixApiAccess();
    const has4SData = hasTix && ns.stock.has4SData();
    const has4SAPI = has4SData && ns.stock.has4SDataTixApi();

    ns.tprint(`[API] WSE Account:      ${hasWse ? "OWNED" : "MISSING"}`);
    ns.tprint(`[API] TIX API:          ${hasTix ? "OWNED" : "MISSING"}`);
    ns.tprint(`[API] 4S Market Data:   ${has4SData ? "OWNED" : "MISSING"}`);
    ns.tprint(`[API] 4S TIX API:       ${has4SAPI ? "OWNED" : "MISSING"}`);

    // 2. Financials
    const cash = ns.getServerMoneyAvailable("home");
    ns.tprint(`[CASH] Money Available: $${cash.toLocaleString()}`);

    let nextUpgrade = "None";
    let cost = 0;
    if (!hasWse) { nextUpgrade = "WSE Account"; cost = 200000000; }
    else if (!hasTix) { nextUpgrade = "TIX API Access"; cost = 5000000000; }
    else if (!has4SData) { nextUpgrade = "4S Market Data"; cost = 1000000000; }
    else if (!has4SAPI) { nextUpgrade = "4S TIX API Access"; cost = 25000000000; }

    if (nextUpgrade !== "None") {
        const canAfford = cash >= cost;
        ns.tprint(`[UPGRADE] Next Needed:  ${nextUpgrade} (Cost: $${cost.toLocaleString()})`);
        ns.tprint(`[UPGRADE] Can Afford:   ${canAfford ? "YES" : "NO"}`);
    } else {
        ns.tprint("[UPGRADE] All stock upgrades purchased!");
    }

    // 3. Process Status
    const isTraderRunning = ns.scriptRunning("/util/stock-trader.js", "home");
    ns.tprint(`[PROCESS] Trader Running: ${isTraderRunning ? "YES" : "NO"}`);

    const freeRam = ns.getServerMaxRam("home") - ns.getServerUsedRam("home");
    const traderRam = ns.getScriptRam("/util/stock-trader.js") || 18.7;
    ns.tprint(`[RAM] Home Free RAM:    ${freeRam.toFixed(2)} GB`);
    ns.tprint(`[RAM] Trader RAM Cost:  ${traderRam.toFixed(2)} GB`);
    ns.tprint(`[RAM] Has enough RAM:   ${freeRam >= traderRam ? "YES" : "NO"}`);

    // 4. Try to dry-run purchase if affordable
    if (nextUpgrade !== "None" && cash >= cost) {
        ns.tprint("\n[DIAG] Attempting to launch purchase script directly...");
        const pid = ns.exec("/util/purchase-stock-api.js", "home", 1);
        if (pid > 0) {
            ns.tprint(`[DIAG] Purchase script executed successfully (PID: ${pid}). Check terminal logs!`);
        } else {
            ns.tprint("[DIAG] Failed to execute purchase script. Do you have enough free RAM on home?");
        }
    }
}
