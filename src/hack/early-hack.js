/** @param {NS} ns */
export async function main(ns) {
    const target = ns.args[0] || ns.getHostname();
    const attacker = ns.getHostname();

    // Aggressive early-game hack to jumpstart money accumulation
    if (ns.getServerMoneyAvailable("home") < 1_000_000_000 && Math.random() < 0.1) {
        ns.print(`[${attacker} -> ${target}] Aggressively hacking for quick cash.`);
        await ns.hack(target);
        return;
    }

    const moneyThresh = ns.getServerMaxMoney(target) * 0.75;
    const securityThresh = ns.getServerMinSecurityLevel(target) + 5;

    if (ns.getServerSecurityLevel(target) > securityThresh) {
        ns.print(`[${attacker} -> ${target}] Weakening.`);
        await ns.weaken(target);
    } else if (ns.getServerMoneyAvailable(target) < moneyThresh) {
        ns.print(`[${attacker} -> ${target}] Growing.`);
        await ns.grow(target);
    } else {
        ns.print(`[${attacker} -> ${target}] Hacking.`);
        await ns.hack(target);
    }
}