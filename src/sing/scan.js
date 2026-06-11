/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    const player = ns.getPlayer();
    const joinedFactions = player.factions;
    const ownedAugs = ns.singularity.getOwnedAugmentations(true); // includes purchased
    const installedAugs = ns.singularity.getOwnedAugmentations(false); // only installed

    const state = {
        timestamp: Date.now(),
        factions: {},
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
        bnaEntryReqs: []
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
                owned: ownedAugs.includes(name)
            });
        }

        state.factions[faction] = {
            rep,
            favor,
            favorGain,
            augs
        };
    }

    // Write to state file
    ns.write("/data/sing-state.json", JSON.stringify(state, null, 2), "w");
    ns.print("Scan complete. State saved to /data/sing-state.json");
}
