import { CITY_FACTIONS } from '/lib/constants.js';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    const player = ns.getPlayer();
    const joinedFactions = player.factions;
    const ownedAugs = ns.singularity.getOwnedAugmentations(true); // includes purchased
    const installedAugs = ns.singularity.getOwnedAugmentations(false); // only installed
    const ownedSet = new Set(ownedAugs);

    const state = {
        timestamp: Date.now(),
        factions: {},
        favorToDonate: ns.getFavorToDonate(),
        ownedAugs: ownedAugs,
        installedAugs: installedAugs,
        pendingInstall: ownedAugs.filter(a => !installedAugs.includes(a)),
        player: {
            skills: {
                hacking: player.skills.hacking,
                strength: player.skills.strength,
                defense: player.skills.defense,
                dexterity: player.skills.dexterity,
                agility: player.skills.agility,
                charisma: player.skills.charisma
            },
            jobs: player.jobs,
            city: player.city
        },
        bnaEntryReqs: [],
        unjoinedCityFactions: {},
        worldDaemonHackReq: 0
    };

    // Query Bachman & Associates entry job requirements dynamically
    try {
        const positions = ns.singularity.getCompanyPositions("Bachman & Associates");
        for (const pos of positions) {
            const info = ns.singularity.getCompanyPositionInfo("Bachman & Associates", pos);
            if (info.requiredReputation === 0) {
                state.bnaEntryReqs.push({
                    hacking: info.requiredSkills.hacking || 0,
                    charisma: info.requiredSkills.charisma || 0,
                    strength: info.requiredSkills.strength || 0,
                    defense: info.requiredSkills.defense || 0,
                    dexterity: info.requiredSkills.dexterity || 0,
                    agility: info.requiredSkills.agility || 0
                });
            }
        }
    } catch (e) {
        ns.print(`Error scanning B&A job requirements: ${e}`);
    }

    // Scan joined factions
    for (const faction of joinedFactions) {
        const rep = ns.singularity.getFactionRep(faction);
        const favor = ns.singularity.getFactionFavor(faction);
        const favorGain = ns.singularity.getFactionFavorGain(faction);
        const augNames = ns.singularity.getAugmentationsFromFaction(faction);

        const augs = [];
        for (const name of augNames) {
            const price = ns.singularity.getAugmentationPrice(name);
            const repReq = ns.singularity.getAugmentationRepReq(name);
            const prereqs = ns.singularity.getAugmentationPrereq(name);
            const stats = ns.singularity.getAugmentationStats(name);

            augs.push({
                name,
                price,
                repReq,
                prereqs,
                stats,
                owned: ownedSet.has(name)
            });
        }

        state.factions[faction] = {
            rep,
            favor,
            favorGain,
            projectedFavor: favor + favorGain,
            augs
        };
    }

    // Scan unjoined city factions — count unowned non-NFG augs for strategic join decisions
    const joinedSet = new Set(joinedFactions);
    for (const cityFaction of CITY_FACTIONS) {
        if (joinedSet.has(cityFaction)) continue;
        try {
            const augNames = ns.singularity.getAugmentationsFromFaction(cityFaction);
            const unownedAugs = augNames.filter(
                name => name !== "NeuroFlux Governor" && !ownedSet.has(name)
            );
            state.unjoinedCityFactions[cityFaction] = {
                totalAugs: augNames.length,
                unownedCount: unownedAugs.length,
                unownedNames: unownedAugs
            };
        } catch (e) {
            // Faction may not exist in this bitnode
            ns.print(`Could not scan unjoined city faction ${cityFaction}: ${e}`);
        }
    }

    // Get w0r1d_d43m0n required hacking level for endgame tracking
    try {
        if (ns.serverExists("w0r1d_d43m0n")) {
            state.worldDaemonHackReq = ns.getServerRequiredHackingLevel("w0r1d_d43m0n");
        }
    } catch (e) {
        ns.print(`Could not query w0r1d_d43m0n: ${e}`);
    }

    // Write to state file
    ns.write("/data/sing-state.json", JSON.stringify(state, null, 2), "w");
    ns.print("Scan complete. State saved to /data/sing-state.json");
}
