/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    if (!ns.stock.hasWseAccount()) {
        const cash = ns.getServerMoneyAvailable("home");
        if (cash >= 200000000) {
            if (ns.stock.purchaseWseAccount()) {
                ns.tprint("Daemon: [Stock Info] Successfully purchased WSE Account programmatically!");
            }
        }
    }

    if (ns.stock.hasWseAccount() && !ns.stock.hasTixApiAccess()) {
        const cash = ns.getServerMoneyAvailable("home");
        if (cash >= 5000000000) {
            if (ns.stock.purchaseTixApi()) {
                ns.tprint("Daemon: [Stock Info] Successfully purchased TIX API Access programmatically!");
            }
        }
    }
}
