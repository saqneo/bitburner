/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    const cash = ns.getServerMoneyAvailable("home");

    // 1. Purchase WSE Account ($200M)
    if (!ns.stock.hasWseAccount()) {
        if (cash >= 200000000) {
            if (ns.stock.purchaseWseAccount()) {
                ns.tprint("Daemon: [Stock Info] Successfully purchased WSE Account programmatically!");
            }
        }
    }

    // 2. Purchase TIX API Access ($5B)
    if (ns.stock.hasWseAccount() && !ns.stock.hasTixApiAccess()) {
        if (cash >= 5000000000) {
            if (ns.stock.purchaseTixApi()) {
                ns.tprint("Daemon: [Stock Info] Successfully purchased TIX API Access programmatically!");
            }
        }
    }

    // 3. Purchase 4S Market Data ($1B)
    if (ns.stock.hasTixApiAccess() && !ns.stock.has4SData()) {
        if (cash >= 1000000000) {
            if (ns.stock.purchase4SMarketData()) {
                ns.tprint("Daemon: [Stock Info] Successfully purchased 4S Market Data Access programmatically!");
            }
        }
    }

    // 4. Purchase 4S TIX API Access ($25B)
    if (ns.stock.has4SData() && !ns.stock.has4SDataTixApi()) {
        if (cash >= 25000000000) {
            if (ns.stock.purchase4SMarketDataTixApi()) {
                ns.tprint("Daemon: [Stock Info] Successfully purchased 4S Market API Access programmatically!");
            }
        }
    }
}
