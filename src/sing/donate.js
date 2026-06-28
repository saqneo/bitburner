/**
 * Donates money to factions to gain reputation.
 * 
 * Two modes:
 * 1. Gap-closing: Donates to any faction with favor >= donation threshold that has
 *    unowned augs with rep requirements above current rep. Closes the gap so augs
 *    become purchasable this run.
 * 2. NFG top-off: When all unique augs are owned, donates for NeuroFlux Governor rep
 *    up to the maximum levels we can afford with our budget (or at least 15 levels to trigger prestige).
 * 
 * Uses up to 50% of current wallet per donation cycle across all factions.
 * 
 * Usage: run /sing/donate.js
 * 
 * @param {NS} ns
 */
export async function main(ns) {
    ns.disableLog("ALL");

    const stateFile = "/data/sing-state.json";
    if (!ns.fileExists(stateFile)) {
        ns.print("No state file found.");
        return;
    }

    let state;
    try {
        state = JSON.parse(ns.read(stateFile));
    } catch (e) {
        ns.print(`Error reading state: ${e}`);
        return;
    }

    const ownedSet = new Set(state.ownedAugs);
    const favorThreshold = state.favorToDonate || ns.getFavorToDonate();
    const totalBudget = ns.getServerMoneyAvailable("home") * 0.50;
    let spent = 0;

    const player = ns.getPlayer();
    const playerMult = player.mults.faction_rep || 1.0;

    // === MODE 1: Gap-closing donations ===
    const gapFactions = [];
    for (const factionName in state.factions) {
        const faction = state.factions[factionName];
        if (faction.favor < favorThreshold) continue;

        // Find the highest rep requirement among unowned non-NFG augs
        let maxRepNeeded = 0;
        for (const aug of faction.augs) {
            if (aug.name === "NeuroFlux Governor") continue;
            if (ownedSet.has(aug.name)) continue;
            if (aug.repReq > faction.rep && aug.repReq > maxRepNeeded) {
                maxRepNeeded = aug.repReq;
            }
        }

        if (maxRepNeeded > 0) {
            gapFactions.push({
                name: factionName,
                currentRep: faction.rep,
                targetRep: maxRepNeeded,
                gap: maxRepNeeded - faction.rep,
                favor: faction.favor
            });
        }
    }

    // Sort by smallest gap first (quickest wins)
    gapFactions.sort((a, b) => a.gap - b.gap);

    for (const gf of gapFactions) {
        const remaining = totalBudget - spent;
        if (remaining < 1e6) break;

        // Calculate actual rep gain per million dollars:
        // Donation formula: $1,000,000 = 225 rep (base) * player_multiplier * favor_multiplier
        const favorMult = 1 + gf.favor / 100;
        const repPerMillion = 225 * playerMult * favorMult;
        const estimatedNeeded = (gf.gap / repPerMillion) * 1e6;

        const donationAmount = Math.min(remaining, estimatedNeeded);
        if (donationAmount < 1e6) continue;

        const success = ns.singularity.donateToFaction(gf.name, donationAmount);
        if (success) {
            const newRep = ns.singularity.getFactionRep(gf.name);
            const repGained = newRep - gf.currentRep;
            spent += donationAmount;
            ns.tprint(`Singularity: Donated $${ns.format.number(donationAmount)} to ${gf.name} for aug rep. Rep: ${ns.format.number(gf.currentRep)} → ${ns.format.number(newRep)} (+${ns.format.number(repGained)})`);
        } else {
            ns.print(`WARNING: Donation to ${gf.name} failed.`);
        }
    }

    // === MODE 2: NFG top-off ===
    // Only proceed if all unique (non-NFG) augs from joined factions are owned
    let allUniqueOwned = true;
    for (const factionName in state.factions) {
        const faction = state.factions[factionName];
        for (const aug of faction.augs) {
            if (aug.name !== "NeuroFlux Governor" && !ownedSet.has(aug.name)) {
                allUniqueOwned = false;
                break;
            }
        }
        if (!allUniqueOwned) break;
    }

    if (!allUniqueOwned) return;

    // Find best faction for NFG donation (highest favor = best rep/dollar)
    let bestFaction = null;
    let bestFavor = -1;
    for (const factionName in state.factions) {
        const faction = state.factions[factionName];
        const hasNfg = faction.augs.some(a => a.name === "NeuroFlux Governor");
        if (!hasNfg) continue;
        if (faction.favor >= favorThreshold && faction.favor > bestFavor) {
            bestFavor = faction.favor;
            bestFaction = factionName;
        }
    }

    if (!bestFaction) return;

    const faction = state.factions[bestFaction];
    const nfg = faction.augs.find(a => a.name === "NeuroFlux Governor");
    if (!nfg) return;

    // Simulate how many levels of NFG we can afford with our budget,
    // and identify the reputation needed for that target level.
    const remainingBudget = totalBudget - spent;
    let wallet = remainingBudget;
    const currentRep = ns.singularity.getFactionRep(bestFaction);
    
    let nfgPriceScaled = nfg.price; // nfg.price already includes pending unique aug multiplier
    let nfgRep = nfg.repReq;
    
    let simulatedCount = 0;
    let lastAffordableRep = currentRep;
    
    while (true) {
        if (wallet >= nfgPriceScaled) {
            wallet -= nfgPriceScaled;
            simulatedCount++;
            lastAffordableRep = nfgRep;
            
            // NFG price and reputation scale by 1.14x per level
            nfgPriceScaled *= (1.14 * 1.9);
            nfgRep *= 1.14;
        } else {
            break;
        }
    }
    
    // Ensure we target at least the reputation for 15 levels of NFG (prestige threshold)
    // so we don't get stuck below the minimum prestige count.
    const pendingInstallCount = state.pendingInstall.length;
    const minNFGs = Math.max(1, 15 - pendingInstallCount);
    if (simulatedCount < minNFGs) {
        let tempRep = nfg.repReq;
        for (let i = 1; i < minNFGs; i++) {
            tempRep *= 1.14;
        }
        if (tempRep > lastAffordableRep) {
            lastAffordableRep = tempRep;
        }
    }

    if (currentRep < lastAffordableRep) {
        const repGap = lastAffordableRep - currentRep;
        const favorMult = 1 + faction.favor / 100;
        const repPerMillion = 225 * playerMult * favorMult;
        const estimatedNeeded = (repGap / repPerMillion) * 1e6;
        
        const donationAmount = Math.min(remainingBudget, estimatedNeeded);
        if (donationAmount >= 1e6) {
            const success = ns.singularity.donateToFaction(bestFaction, donationAmount);
            if (success) {
                const newRep = ns.singularity.getFactionRep(bestFaction);
                const repGained = newRep - currentRep;
                ns.tprint(`Singularity: Donated $${ns.format.number(donationAmount)} to ${bestFaction} for NFG rep. Target: ${ns.format.number(lastAffordableRep)}. Rep: ${ns.format.number(currentRep)} → ${ns.format.number(newRep)} (+${ns.format.number(repGained)})`);
            }
        }
    }
}
