import { CITY_FACTIONS, CITY_FACTION_GROUPS } from '/lib/constants.js';

/** Group names for readable logging. */
const GROUP_LABELS = ["Western (Sector-12, Aevum)", "Eastern (Chongqing, New Tokyo, Ishima)", "Volhaven"];

/**
 * Money requirements to trigger city faction invites.
 * The player must be in the city AND have at least this much money.
 */
const CITY_MONEY_REQ = {
    "Sector-12": 15e6,
    "Aevum": 40e6,
    "Chongqing": 20e6,
    "New Tokyo": 20e6,
    "Ishima": 30e6,
    "Volhaven": 50e6
};

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    const joinedFactions = new Set(ns.getPlayer().factions);
    const ownedAugs = new Set(ns.singularity.getOwnedAugmentations(true));
    const citySet = new Set(CITY_FACTIONS);

    // Determine which city faction group(s) we've already committed to
    const committedGroups = new Set();
    for (const faction of joinedFactions) {
        if (citySet.has(faction)) {
            for (let i = 0; i < CITY_FACTION_GROUPS.length; i++) {
                if (CITY_FACTION_GROUPS[i].includes(faction)) {
                    committedGroups.add(i);
                }
            }
        }
    }

    if (committedGroups.size > 0) {
        const labels = [...committedGroups].map(i => GROUP_LABELS[i]).join(", ");
        ns.print(`City faction group(s) already committed: ${labels}`);
    }

    let joinedAny = false;

    // === SECTION 1: Process existing invitations ===
    const invites = ns.singularity.checkFactionInvitations();

    if (invites.length > 0) {
        ns.tprint(`Singularity: Evaluating ${invites.length} faction invite(s): ${invites.join(", ")}`);

        for (const faction of invites) {
            // Non-city factions: always accept
            if (!citySet.has(faction)) {
                if (ns.singularity.joinFaction(faction)) {
                    ns.tprint(`Singularity: ✓ Joined '${faction}' (non-city, always accept)`);
                    joinedAny = true;
                }
                continue;
            }

            // City faction: find which group it belongs to
            const groupIndex = CITY_FACTION_GROUPS.findIndex(g => g.includes(faction));
            const groupLabel = GROUP_LABELS[groupIndex] || `Group ${groupIndex}`;

            // If we've already joined a faction from a DIFFERENT group, skip.
            if (committedGroups.size > 0 && !committedGroups.has(groupIndex)) {
                ns.tprint(`Singularity: ✗ Skipping '${faction}' — conflicts with committed group. ` +
                           `'${faction}' is ${groupLabel}, but we're committed to ${[...committedGroups].map(i => GROUP_LABELS[i]).join(", ")}.`);
                continue;
            }

            // Check if this faction has any unowned non-NFG augs worth joining for.
            let hasUsefulAugs = false;
            let totalAugs = 0;
            let unownedAugs = [];
            try {
                const augNames = ns.singularity.getAugmentationsFromFaction(faction);
                totalAugs = augNames.length;
                for (const aug of augNames) {
                    if (aug !== "NeuroFlux Governor" && !ownedAugs.has(aug)) {
                        hasUsefulAugs = true;
                        unownedAugs.push(aug);
                    }
                }
            } catch (e) {
                // If we can't check, err on the side of joining
                hasUsefulAugs = true;
                ns.tprint(`Singularity: ⚠ Could not scan '${faction}' augs (${e}), joining defensively.`);
            }

            if (!hasUsefulAugs) {
                // Also check what the OTHER groups have, so the user understands the tradeoff
                const otherGroupInfo = [];
                for (let i = 0; i < CITY_FACTION_GROUPS.length; i++) {
                    if (i === groupIndex) continue;
                    let groupUnowned = 0;
                    for (const otherFaction of CITY_FACTION_GROUPS[i]) {
                        if (joinedFactions.has(otherFaction)) continue;
                        try {
                            const otherAugs = ns.singularity.getAugmentationsFromFaction(otherFaction);
                            for (const aug of otherAugs) {
                                if (aug !== "NeuroFlux Governor" && !ownedAugs.has(aug)) {
                                    groupUnowned++;
                                }
                            }
                        } catch (e) { /* ignore */ }
                    }
                    if (groupUnowned > 0) {
                        otherGroupInfo.push(`${GROUP_LABELS[i]}: ${groupUnowned} unowned`);
                    }
                }

                const otherGroupStr = otherGroupInfo.length > 0
                    ? ` Other groups still have augs: [${otherGroupInfo.join("; ")}]`
                    : " No other city groups have unowned augs either.";

                ns.tprint(`Singularity: ✗ Skipping '${faction}' — all ${totalAugs} unique augs already owned. ` +
                           `Preserving exclusivity.${otherGroupStr}`);
                continue;
            }

            // Accept the invite
            if (ns.singularity.joinFaction(faction)) {
                ns.tprint(`Singularity: ✓ Joined city faction '${faction}' (${groupLabel}) — ` +
                           `${unownedAugs.length} unowned aug(s): ${unownedAugs.slice(0, 5).join(", ")}` +
                           `${unownedAugs.length > 5 ? ` ...+${unownedAugs.length - 5} more` : ""}`);
                joinedAny = true;
                joinedFactions.add(faction);
                committedGroups.add(groupIndex);
            }
        }
    }

    // === SECTION 2: Proactive city faction travel ===
    // Travel to cities to trigger faction invites for factions with unowned augs.
    // Only attempts travel when we meet the city's money requirement, which naturally
    // gates this to mid/late game (lowest threshold is $15M for Sector-12).
    const stateFile = "/data/sing-state.json";
    let state = null;
    if (ns.fileExists(stateFile)) {
        try { state = JSON.parse(ns.read(stateFile)); } catch (e) { /* ignore */ }
    }

    if (state && state.unjoinedCityFactions) {
        const money = ns.getServerMoneyAvailable("home");

        const travelCandidates = [];
        for (const factionName in state.unjoinedCityFactions) {
            // Skip if we already joined this faction (possibly earlier this tick)
            if (joinedFactions.has(factionName)) continue;

            const info = state.unjoinedCityFactions[factionName];
            if (info.unownedCount === 0) continue;

            // Only travel if we meet the money threshold for the invite
            const moneyReq = CITY_MONEY_REQ[factionName] || 50e6;
            if (money < moneyReq) continue;

            // Check exclusivity — don't travel for conflicting groups
            const groupIndex = CITY_FACTION_GROUPS.findIndex(g => g.includes(factionName));
            if (committedGroups.size > 0 && !committedGroups.has(groupIndex)) continue;

            travelCandidates.push({
                name: factionName,
                unownedCount: info.unownedCount,
                groupIndex
            });
        }

        // Sort by most unowned augs first
        travelCandidates.sort((a, b) => b.unownedCount - a.unownedCount);

        for (const candidate of travelCandidates) {
            const player = ns.getPlayer();
            // Travel to the city if not already there
            if (player.city !== candidate.name) {
                if (!ns.singularity.travelToCity(candidate.name)) {
                    ns.print(`Could not travel to ${candidate.name}.`);
                    continue;
                }
                ns.tprint(`Singularity: Traveled to ${candidate.name} to trigger faction invite (${candidate.unownedCount} unowned augs).`);
            }

            // Brief wait for game to process the location change
            await ns.sleep(200);

            // Check if invite appeared
            const newInvites = ns.singularity.checkFactionInvitations();
            if (newInvites.includes(candidate.name)) {
                if (ns.singularity.joinFaction(candidate.name)) {
                    ns.tprint(`Singularity: ✓ Joined city faction '${candidate.name}' after traveling (${candidate.unownedCount} unowned augs).`);
                    joinedAny = true;
                    joinedFactions.add(candidate.name);
                    committedGroups.add(candidate.groupIndex);
                }
            } else {
                ns.print(`No invite for ${candidate.name} after traveling. May need higher stats or money.`);
            }
        }
    }

    if (joinedAny) {
        ns.write("/data/sing-joined-flag.txt", "true", "w");
    }
}
