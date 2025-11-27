/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    // If no target argument is provided, default to hacking the current host.
    const target = ns.args[0] || ns.getHostname(); 
    
    const moneyThresh = ns.getServerMaxMoney(target) * 0.90;
    const securityThresh = ns.getServerMinSecurityLevel(target) + 2;

    while(true) {
        if (ns.getServerSecurityLevel(target) > securityThresh) {
            await ns.weaken(target);
        } else if (ns.getServerMoneyAvailable(target) < moneyThresh) {
            await ns.grow(target);
        } else {
            await ns.hack(target);
        }
    }
}