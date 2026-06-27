import { SING_HOME_UPGRADE_PCT } from '/lib/constants.js';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    // Accept an optional budget override as first arg (0.0 - 1.0).
    // The manager passes a higher budget during endgame.
    const budgetOverride = parseFloat(ns.args[0]);
    const upgradePct = (!isNaN(budgetOverride) && budgetOverride > 0)
        ? budgetOverride
        : (SING_HOME_UPGRADE_PCT || 0.10);

    const playerMoney = ns.getServerMoneyAvailable("home");
    const maxBudget = playerMoney * upgradePct;

    // 1. RAM Upgrade — keep buying as long as it's within budget
    try {
        let ramCost = ns.singularity.getUpgradeHomeRamCost();
        while (ramCost > 0 && ramCost <= maxBudget) {
            const oldRam = ns.getServerMaxRam("home");
            if (ns.singularity.upgradeHomeRam()) {
                const newRam = ns.getServerMaxRam("home");
                ns.tprint(`Singularity: Upgraded home RAM: ${oldRam}GB → ${newRam}GB (cost $${ns.format.number(ramCost)})`);
                ramCost = ns.singularity.getUpgradeHomeRamCost();
            } else {
                break;
            }
        }
    } catch (e) {
        ns.print(`Error checking/upgrading RAM: ${e}`);
    }

    // 2. Core Upgrade — keep buying as long as it's within budget
    try {
        let coreCost = ns.singularity.getUpgradeHomeCoresCost();
        while (coreCost > 0 && coreCost <= maxBudget) {
            const oldCores = ns.getServer("home").cpuCores;
            if (ns.singularity.upgradeHomeCores()) {
                const newCores = ns.getServer("home").cpuCores;
                ns.tprint(`Singularity: Upgraded home Cores: ${oldCores} → ${newCores} (cost $${ns.format.number(coreCost)})`);
                coreCost = ns.singularity.getUpgradeHomeCoresCost();
            } else {
                break;
            }
        }
    } catch (e) {
        ns.print(`Error checking/upgrading Cores: ${e}`);
    }
}
