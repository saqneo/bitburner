/**
 * Selects the best targets based on Score (Money * Chance / Time).
 * @param {NS} ns
 * @param {string[]} hosts 
 * @returns {string[]} Sorted list of targets
 */
export function getRankedTargets(ns, hosts) {
    const playerHack = ns.getHackingLevel();
    const targets = [];

    for (const host of hosts) {
        if (host === 'home' || host.startsWith('owned-')) continue;
        if (!ns.hasRootAccess(host)) continue;
        if (ns.getServerRequiredHackingLevel(host) > playerHack) continue;
        if (ns.getServerMaxMoney(host) <= 0) continue;
        
        // EV Calculation
        const money = ns.getServerMaxMoney(host);
        // Note: Uses current security, slightly inaccurate for ranking but fine
        const time = ns.getHackTime(host); 
        const chance = ns.hackAnalyzeChance(host);

        if (time === 0) continue;
        
        const score = (money * chance) / time;
        
        targets.push({ id: host, score: score });
    }

    return targets.sort((a, b) => b.score - a.score).map(t => t.id);
}

/**
 * Determines the next action (Hack, Grow, or Weaken) for a target.
 * NOTE: This is the lightweight early-game version. It returns a single action
 * and does NOT bundle compensating Weakens (to stay within daemon's 8GB RAM budget).
 * The midgame batcher handles bundling with its own logic.
 * @param {NS} ns
 * @param {string} target
 * @returns {{script: string, threads: number}|null}
 */
export function getNextAction(ns, target) {
    const server = ns.getServer(target);
    const sec = server.hackDifficulty;
    const minSec = server.minDifficulty;
    const money = server.moneyAvailable;
    const maxMoney = server.moneyMax;

    // A. WEAKEN: If security is too high, prioritize weakening.
    // 0.05 is the amount one thread reduces security by.
    if (sec > minSec + 0.1) { 
        const amountToReduce = sec - minSec;
        const threadsNeeded = Math.ceil(amountToReduce / 0.05);
        return { script: "/hack/weaken.js", threads: threadsNeeded };
    } 

    // B. GROW: If money is low, prioritize growing.
    if (money < maxMoney * 0.90) {
        // Calculate required multiplier to reach 100% money.
        const multiplier = maxMoney / Math.max(money, 1);
        const threadsNeeded = Math.ceil(ns.growthAnalyze(target, multiplier));
        return { script: "/hack/grow.js", threads: threadsNeeded };
    }

    // C. HACK: If security is low and money is high, perform a hack.
    // Hack 20% of CURRENT money.
    const percentPerThread = ns.hackAnalyze(target);
    if (percentPerThread > 0) {
        // Cap Hack to 20% to preserve target sustainability.
        const threads = Math.floor(0.20 / percentPerThread);
        if (threads > 0) {
            return { script: "/hack/hack.js", threads: threads };
        }
    }

    return null;
}