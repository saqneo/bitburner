/** @param {NS} ns */
export async function main(ns) {
    const stateFile = "/data/sing-state.json";
    const planFile = "/data/sing-purchase-plan.json";

    if (ns.fileExists(stateFile)) {
        ns.tprint("--- CURRENT STATE ---");
        const state = JSON.parse(ns.read(stateFile));
        ns.tprint(`Pending install count: ${state.pendingInstall.length} (${state.pendingInstall.join(", ")})`);
        ns.tprint(`Player money: $${ns.format.number(ns.getServerMoneyAvailable("home"))}`);
        
        // Let's run a dry run of calculatePrestigePlan logic
        ns.tprint("--- PRESTIGE PLAN DRY RUN ---");
        const prestigePlan = calculatePrestigePlan(ns, state);
        ns.tprint(`canPrestige: ${prestigePlan.canPrestige}`);
        ns.tprint(`reason: ${prestigePlan.reason}`);
        ns.tprint(`uniqueCount: ${prestigePlan.count}`);
        ns.tprint(`threshold: ${prestigePlan.threshold}`);
        ns.tprint(`plan size: ${prestigePlan.plan.length}`);
        ns.tprint(`plan details: ${prestigePlan.plan.map(p => `${p.name} (${p.faction})`).join(", ")}`);
    } else {
        ns.tprint("Error: State file not found.");
    }

    if (ns.fileExists(planFile)) {
        ns.tprint("--- LAST WRITTEN PLAN FILE ---");
        const plan = JSON.parse(ns.read(planFile));
        ns.tprint(`shouldInstall: ${plan.shouldInstall}`);
        ns.tprint(`plan items: ${plan.augs.map(a => `${a.name} (${a.faction})`).join(", ")}`);
    } else {
        ns.tprint("Plan file not found.");
    }
}

// Mirror the calculatePrestigePlan function from manager.js for dry-run
function calculatePrestigePlan(ns, state) {
    const minAugs = 20;
    const SING_MIN_AUGS_PRESTIGE = 15;
    let wallet = ns.getServerMoneyAvailable("home");
    let multiplier = 1.9 ** state.pendingInstall.length;

    const candidates = [];
    const ownedSet = new Set([...state.ownedAugs]);

    for (const factionName in state.factions) {
        const faction = state.factions[factionName];
        for (const aug of faction.augs) {
            if (ownedSet.has(aug.name) || aug.name === "NeuroFlux Governor") continue;
            if (faction.rep >= aug.repReq) {
                candidates.push({
                    name: aug.name,
                    basePrice: aug.price / multiplier,
                    repReq: aug.repReq,
                    prereqs: aug.prereqs,
                    faction: factionName
                });
            }
        }
    }

    candidates.sort((a, b) => {
        const aIsBna = a.faction === "Bachman & Associates";
        const bIsBna = b.faction === "Bachman & Associates";
        if (aIsBna && !bIsBna) return -1;
        if (!aIsBna && bIsBna) return 1;
        return b.basePrice - a.basePrice;
    });

    const plan = [];
    const plannedSet = new Set();

    function addAugToPlan(aug) {
        if (plannedSet.has(aug.name)) return true;
        for (const prereqName of aug.prereqs) {
            if (!ownedSet.has(prereqName) && !plannedSet.has(prereqName)) {
                const prereqAug = candidates.find(c => c.name === prereqName);
                if (prereqAug) {
                    if (!addAugToPlan(prereqAug)) return false;
                } else {
                    return false;
                }
            }
        }
        const actualPrice = aug.basePrice * multiplier;
        if (wallet >= actualPrice) {
            wallet -= actualPrice;
            multiplier *= 1.9;
            plan.push({ name: aug.name, faction: aug.faction });
            plannedSet.add(aug.name);
            return true;
        }
        return false;
    }

    for (const aug of candidates) {
        addAugToPlan(aug);
    }

    const joinedAugsMap = new Map();
    for (const factionName in state.factions) {
        const faction = state.factions[factionName];
        for (const aug of faction.augs) {
            if (aug.name === "NeuroFlux Governor") continue;
            if (!ownedSet.has(aug.name) && !joinedAugsMap.has(aug.name)) {
                joinedAugsMap.set(aug.name, {
                    name: aug.name,
                    prereqs: aug.prereqs || [],
                    faction: factionName
                });
            }
        }
    }

    let blockedCount = 0;
    let uniqueRemaining = false;
    
    const blockedMemo = new Map();
    function isBlocked(augName) {
        if (ownedSet.has(augName)) return false;
        if (blockedMemo.has(augName)) return blockedMemo.get(augName);
        const aug = joinedAugsMap.get(augName);
        if (!aug) return true;
        blockedMemo.set(augName, true);
        for (const prereq of aug.prereqs) {
            if (isBlocked(prereq)) {
                blockedMemo.set(augName, true);
                return true;
            }
        }
        blockedMemo.set(augName, false);
        return false;
    }

    for (const [name, aug] of joinedAugsMap) {
        if (isBlocked(name)) {
            blockedCount++;
        } else {
            uniqueRemaining = true;
        }
    }

    if (!uniqueRemaining && state.unjoinedCityFactions) {
        for (const factionName in state.unjoinedCityFactions) {
            if (state.unjoinedCityFactions[factionName].unownedCount > 0) {
                uniqueRemaining = true;
                break;
            }
        }
    }

    const pendingUnique = state.pendingInstall.filter(a => a !== "NeuroFlux Governor").length;
    const planUnique = plan.filter(item => item.name !== "NeuroFlux Governor").length;
    const uniqueCount = pendingUnique + planUnique;

    const accessibleCount = joinedAugsMap.size - blockedCount;
    const maxPossible = accessibleCount + pendingUnique;
    const threshold = Math.max(1, Math.min(minAugs, maxPossible));

    const favorToDonate = state.favorToDonate || 150;
    let donationUnlockAvailable = false;
    for (const factionName in state.factions) {
        const faction = state.factions[factionName];
        if (faction.favor >= favorToDonate) continue;
        const projectedFavor = faction.projectedFavor || (faction.favor + (faction.favorGain || 0));
        if (projectedFavor < favorToDonate) continue;
        const hasRepGap = faction.augs.some(a =>
            !a.owned && a.name !== "NeuroFlux Governor" && a.repReq > faction.rep
        );
        if (hasRepGap) {
            donationUnlockAvailable = true;
            break;
        }
    }

    const isStalling = false; // We can't query stall time here easily

    if (!uniqueRemaining || (uniqueCount >= threshold) || donationUnlockAvailable || isStalling) {
        let nfgRepReq = Infinity;
        let nfgPrice = Infinity;
        let nfgFaction = "";
        let nfgAvailable = false;

        for (const factionName in state.factions) {
            const faction = state.factions[factionName];
            const nfg = faction.augs.find(a => a.name === "NeuroFlux Governor");
            if (nfg && faction.rep >= nfg.repReq) {
                if (nfg.price < nfgPrice) {
                    nfgPrice = nfg.price;
                    nfgRepReq = nfg.repReq;
                    nfgFaction = factionName;
                    nfgAvailable = true;
                }
            }
        }

        if (nfgAvailable) {
            let nfgRep = nfgRepReq;
            const uniqueMultiplier = 1.9 ** planUnique;
            let nfgPriceScaled = nfgPrice * uniqueMultiplier;
            const faction = state.factions[nfgFaction];

            while (true) {
                if (faction.rep < nfgRep) {
                    break;
                }
                if (wallet >= nfgPriceScaled) {
                    wallet -= nfgPriceScaled;
                    plan.push({ name: "NeuroFlux Governor", faction: nfgFaction });
                    nfgRep *= 1.14;
                    nfgPriceScaled *= (1.14 * 1.9);
                } else {
                    break;
                }
            }
        }
    }

    const totalInstallCount = plan.length + state.pendingInstall.length;
    const minPrestigeCount = SING_MIN_AUGS_PRESTIGE || 15;
    let canPrestige = false;

    if (totalInstallCount >= minPrestigeCount) {
        if (uniqueCount > 0) {
            canPrestige = (uniqueCount >= threshold) || 
                          (!uniqueRemaining && plan.length > 0) ||
                          (donationUnlockAvailable && plan.length > 0);
        } else {
            canPrestige = true;
        }
    }

    let reason = "";
    if (canPrestige) {
        if (uniqueCount >= threshold) reason = "threshold";
        else if (uniqueCount > 0 && !uniqueRemaining) reason = "complete";
        else if (uniqueCount === 0) reason = "nfg-only";
        else if (donationUnlockAvailable) reason = "donation-unlock";
    }

    return {
        canPrestige,
        count: uniqueCount,
        threshold,
        plan,
        reason
    };
}
