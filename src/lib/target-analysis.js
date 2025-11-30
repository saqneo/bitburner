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
 * @param {NS} ns
 * @param {string} target
 * @returns {{script: string, threads: number}|null}
 */
export function getNextAction(ns, target) {
    const sec = ns.getServerSecurityLevel(target);
    const minSec = ns.getServerMinSecurityLevel(target);
    const money = ns.getServerMoneyAvailable(target);
    const maxMoney = ns.getServerMaxMoney(target);

    if (sec > minSec + 2) { // Allow small buffer
        return { script: "/hack/weaken.js", threads: Infinity };
    } else if (money < maxMoney * 0.95) {
        return { script: "/hack/grow.js", threads: Infinity };
    } else {
        // Hack 20% of CURRENT money (or max). 
        // hackAnalyze returns percent per thread (e.g., 0.001 for 0.1%)
        const percentPerThread = ns.hackAnalyze(target);
        if (percentPerThread > 0) {
            // Cap Hack to 20% to preserve longevity
            const threads = Math.floor(0.20 / percentPerThread);
            if (threads > 0) {
                return { script: "/hack/hack.js", threads: threads };
            }
        }
    }
    return null;
}