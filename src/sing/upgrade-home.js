import { SING_HOME_UPGRADE_PCT } from '/lib/constants.js';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    const playerMoney = ns.getServerMoneyAvailable("home");
    const upgradePct = SING_HOME_UPGRADE_PCT || 0.10;
    const maxBudget = playerMoney * upgradePct;

    // 1. RAM Upgrade
    try {
        const ramCost = ns.singularity.getUpgradeHomeRamCost();
        if (ramCost > 0 && ramCost <= maxBudget) {
            const oldRam = ns.getServerMaxRam("home");
            if (ns.singularity.upgradeHomeRam()) {
                const newRam = ns.getServerMaxRam("home");
                ns.tprint(`Singularity: Upgraded home RAM from ${oldRam}GB to ${newRam}GB`);
            }
        }
    } catch (e) {
        ns.print(`Error checking/upgrading RAM: ${e}`);
    }

    // 2. Core Upgrade
    try {
        const coreCost = ns.singularity.getUpgradeHomeCoresCost();
        if (coreCost > 0 && coreCost <= maxBudget) {
            if (ns.singularity.upgradeHomeCores()) {
                ns.tprint(`Singularity: Upgraded home Cores`);
            }
        }
    } catch (e) {
        ns.print(`Error checking/upgrading Cores: ${e}`);
    }
}
