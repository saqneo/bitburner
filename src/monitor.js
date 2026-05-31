import { getAllNodes } from '/lib/map.js';
import { getRamStats, getProcessStats, getContractCount } from '/lib/hud.js';
import { renderHud, cleanupHudSection } from '/lib/hud-dom.js';
import { getStartupStage } from '/lib/progression.js';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    
    // Graceful cleanup of our top HUD section when script exits
    ns.atExit(() => {
        cleanupHudSection("swarm");
    });
    
    ns.print("System Monitor initialized. Output redirected to Top Bar HUD.");

    // Initialize rolling history state for income and XP tracking
    let prevMoney = ns.getServerMoneyAvailable("home");
    let prevXP = ns.getPlayer().exp.hacking;

    const moneyHistory = [];
    const xpHistory = [];
    const WINDOW_SIZE = 15; // 15-second rolling average

    while (true) {
        const stage = getStartupStage(ns);
        const nodes = getAllNodes(ns);
        const ramStats = getRamStats(ns, nodes);
        const procStats = getProcessStats(ns, nodes);
        const contractCount = getContractCount(ns, nodes);

        const currentMoney = ns.getServerMoneyAvailable("home");
        const currentXP = ns.getPlayer().exp.hacking;

        // Deltas (ignore negative money deltas from purchases)
        const moneyDelta = Math.max(0, currentMoney - prevMoney);
        const xpDelta = Math.max(0, currentXP - prevXP);

        moneyHistory.push(moneyDelta);
        xpHistory.push(xpDelta);
        if (moneyHistory.length > WINDOW_SIZE) moneyHistory.shift();
        if (xpHistory.length > WINDOW_SIZE) xpHistory.shift();

        prevMoney = currentMoney;
        prevXP = currentXP;

        // Calculate average per second
        const incomeRate = moneyHistory.reduce((a, b) => a + b, 0) / moneyHistory.length;
        const expRate = xpHistory.reduce((a, b) => a + b, 0) / xpHistory.length;

        let primaryTarget = null;
        if (procStats.topTarget) {
            primaryTarget = {
                name: procStats.topTarget,
                moneyCurr: ns.getServerMoneyAvailable(procStats.topTarget) || 0,
                moneyMax: ns.getServerMaxMoney(procStats.topTarget) || 0,
                secCurr: ns.getServerSecurityLevel(procStats.topTarget) || 0,
                secMin: ns.getServerMinSecurityLevel(procStats.topTarget) || 0
            };
        }

        // Store globally in window state
        window.customHudSwarm = {
            stage: stage.toUpperCase(),
            ramUsed: ramStats.used,
            ramMax: ramStats.max,
            threads: procStats.total,
            contracts: contractCount,
            hack: procStats.hack,
            grow: procStats.grow,
            weaken: procStats.weaken,
            topTargets: procStats.targets,
            primaryTarget: primaryTarget,
            incomeRate: incomeRate,
            expRate: expRate
        };

        // Render the unified horizontal HUD
        renderHud();

        // Real-time error diagnostic print
        if (window.customHudError) {
            ns.tprint(`Custom HUD ERROR: ${window.customHudError}`);
            window.customHudError = null; // Clear to avoid log spam
        }

        // 1Hz Refresh Rate
        await ns.sleep(1000);
    }
}