/**
 * Donates money to factions to gain reputation.
 * 
 * Two modes:
 * 1. Gap-closing: Donates to any faction with favor >= donation threshold that has
 *    unowned augs with rep requirements above current rep. Closes the gap so augs
 *    become purchasable this run.
 * 2. NFG top-off: When all unique augs are owned, donates for NeuroFlux Governor rep.
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

    // === MODE 1: Gap-closing donations ===
    // Find factions that can accept donations and have unowned augs needing rep
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
                gap: maxRepNeeded - faction.rep
            });
        }
    }

    // Sort by smallest gap first (quickest wins)
    gapFactions.sort((a, b) => a.gap - b.gap);

    for (const gf of gapFactions) {
        const remaining = totalBudget - spent;
        if (remaining < 1e6) break;

        // Estimate donation needed: gap / 225 * 1e6 (rough baseline without multipliers)
        const estimatedNeeded = (gf.gap / 225) * 1e6;
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

    // Fresh read after possible gap-closing donations earlier
    const currentRep = ns.singularity.getFactionRep(bestFaction);
    const neededRep = nfg.repReq;
    if (currentRep >= neededRep) return;

    const repGap = neededRep - currentRep;
    const remaining = totalBudget - spent;
    const estimatedNeeded = (repGap / 225) * 1e6;
    const donationAmount = Math.min(remaining, estimatedNeeded);

    if (donationAmount < 1e6) return;

    const success = ns.singularity.donateToFaction(bestFaction, donationAmount);
    if (success) {
        const newRep = ns.singularity.getFactionRep(bestFaction);
        const repGained = newRep - currentRep;
        ns.tprint(`Singularity: Donated $${ns.format.number(donationAmount)} to ${bestFaction} for NFG rep. Rep: ${ns.format.number(currentRep)} → ${ns.format.number(newRep)} (+${ns.format.number(repGained)})`);
    }
}
