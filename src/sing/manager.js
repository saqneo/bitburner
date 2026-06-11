import { SING_TICK_MS, SING_SCAN_INTERVAL_MS, SING_MIN_AUGS_TO_INSTALL, SING_FOCUS_DELAY_MS, SING_AUTO_INSTALL } from '/lib/constants.js';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    ns.tprint("Singularity: Manager initialized.");
    
    let lastScanTime = 0;
    let lastUpgradeTime = 0;
    let lastBackdoorTime = 0;
    let lastWorkTarget = "";
    let lastWorkType = "";
    let lastWorkStartTime = 0;
    let lastPrestigeNotify = 0;
    let activePid = 0;

    // Helper to run a task script serially
    async function runTask(script, args = []) {
        if (activePid > 0 && ns.isRunning(activePid)) {
            return false;
        }
        const ram = ns.getScriptRam(script, "home");
        
        let homeMax = ns.getServerMaxRam("home");
        let homeUsed = ns.getServerUsedRam("home");
        let homeFree = homeMax - homeUsed;

        if (homeFree < ram) {
            if (ns.scriptRunning("/util/share.js", "home")) {
                ns.print(`Manager: Killing /util/share.js to free up RAM for ${script}`);
                ns.kill("/util/share.js", "home");
                await ns.sleep(100);
                homeUsed = ns.getServerUsedRam("home");
                homeFree = homeMax - homeUsed;
            }
        }

        if (homeFree < ram) {
            ns.print(`Manager: Still low RAM. Killing workers on home to free up RAM for ${script}`);
            const workers = ["/hack/grow.js", "/hack/weaken.js", "/hack/hack.js"];
            for (const w of workers) {
                if (ns.scriptRunning(w, "home")) {
                    ns.kill(w, "home");
                }
            }
            await ns.sleep(100);
            homeUsed = ns.getServerUsedRam("home");
            homeFree = homeMax - homeUsed;
        }

        if (homeFree >= ram) {
            activePid = ns.exec(script, "home", 1, ...args);
            return activePid > 0;
        } else {
            ns.print(`Manager: Skipping ${script} due to low RAM (${ram.toFixed(1)} GB required, ${homeFree.toFixed(1)} GB free)`);
            return false;
        }
    }

    // Helper to run a task script and wait for completion
    async function runTaskWait(script, args = []) {
        if (activePid > 0 && ns.isRunning(activePid)) {
            while (ns.isRunning(activePid)) await ns.sleep(200);
        }
        
        const ram = ns.getScriptRam(script, "home");
        let homeMax = ns.getServerMaxRam("home");
        let homeUsed = ns.getServerUsedRam("home");
        let homeFree = homeMax - homeUsed;

        if (homeFree < ram) {
            if (ns.scriptRunning("/util/share.js", "home")) {
                ns.print(`Manager: Killing /util/share.js to free up RAM for ${script}`);
                ns.kill("/util/share.js", "home");
                await ns.sleep(100);
                homeUsed = ns.getServerUsedRam("home");
                homeFree = homeMax - homeUsed;
            }
        }

        if (homeFree < ram) {
            ns.print(`Manager: Still low RAM. Killing workers on home to free up RAM for ${script}`);
            const workers = ["/hack/grow.js", "/hack/weaken.js", "/hack/hack.js"];
            for (const w of workers) {
                if (ns.scriptRunning(w, "home")) {
                    ns.kill(w, "home");
                }
            }
            await ns.sleep(100);
            homeUsed = ns.getServerUsedRam("home");
            homeFree = homeMax - homeUsed;
        }

        if (homeFree >= ram) {
            activePid = ns.exec(script, "home", 1, ...args);
            if (activePid > 0) {
                while (ns.isRunning(activePid)) await ns.sleep(200);
                return true;
            }
        }
        return false;
    }

    // Main Manager Loop
    while (true) {
        // 1. Ensure state file exists and is scanned
        const stateFile = "/data/sing-state.json";
        const now = Date.now();
        
        if (!ns.fileExists(stateFile) || (now - lastScanTime > SING_SCAN_INTERVAL_MS)) {
            ns.print("Manager: Running state scan...");
            const success = await runTaskWait("/sing/scan.js");
            if (success) lastScanTime = Date.now();
        }

        // Check if a task is currently running
        if (activePid > 0 && ns.isRunning(activePid)) {
            await ns.sleep(SING_TICK_MS);
            continue;
        }

        // Parse state
        let state = null;
        try {
            if (ns.fileExists(stateFile)) {
                state = JSON.parse(ns.read(stateFile));
            }
        } catch (e) {
            ns.print(`Manager: Error reading state file: ${e}`);
        }

        if (!state) {
            await ns.sleep(SING_TICK_MS);
            continue;
        }

        await runTask("/sing/join-factions.js");
        
        // Wait briefly for join-factions to complete before program check
        if (activePid > 0 && ns.isRunning(activePid)) {
            while (ns.isRunning(activePid)) await ns.sleep(200);
        }

        // Trigger immediate scan if any faction was joined
        const joinedFlagFile = "/data/sing-joined-flag.txt";
        if (ns.fileExists(joinedFlagFile)) {
            ns.rm(joinedFlagFile);
            ns.print("Manager: Faction joined! Triggering immediate state scan...");
            await runTaskWait("/sing/scan.js");
            lastScanTime = Date.now();
            try {
                if (ns.fileExists(stateFile)) {
                    state = JSON.parse(ns.read(stateFile));
                }
            } catch (e) {
                ns.print(`Manager: Error re-reading state file: ${e}`);
            }
        }

        await runTask("/sing/buy-programs.js");
        if (activePid > 0 && ns.isRunning(activePid)) {
            while (ns.isRunning(activePid)) await ns.sleep(200);
        }

        // 3. Periodic upgrades and backdoors
        if (now - lastUpgradeTime > 60000) {
            const success = await runTask("/sing/upgrade-home.js");
            if (success) lastUpgradeTime = Date.now();
            
            if (activePid > 0 && ns.isRunning(activePid)) {
                while (ns.isRunning(activePid)) await ns.sleep(200);
            }
        }

        if (now - lastBackdoorTime > 60000) {
            const success = await runTask("/sing/backdoor.js");
            if (success) lastBackdoorTime = Date.now();

            if (activePid > 0 && ns.isRunning(activePid)) {
                while (ns.isRunning(activePid)) await ns.sleep(200);
            }
        }

        // 4. Decision Logic: Prestige or Work
        const prestigePlan = calculatePrestigePlan(ns, state);
        
        // Update HUD global state
        const nextPrestigeText = prestigePlan.canPrestige 
            ? `READY! Buy ${prestigePlan.count} augs`
            : `${prestigePlan.count}/${SING_MIN_AUGS_TO_INSTALL} augs purchasable`;
            
        eval("window").customHudSing = {
            active: true,
            currentWork: lastWorkTarget ? `${lastWorkTarget} (${lastWorkType})` : "Idle",
            pendingAugs: state.pendingInstall.length,
            availableAugs: prestigePlan.count,
            nextPrestige: nextPrestigeText,
            canPrestige: prestigePlan.canPrestige
        };

        let triggeredReset = false;
        if (prestigePlan.canPrestige) {
            // Write plan to file so the user can trigger it manually
            const planFile = {
                augs: prestigePlan.plan,
                shouldInstall: true
            };
            ns.write("/data/sing-purchase-plan.json", JSON.stringify(planFile, null, 2), "w");

            if (SING_AUTO_INSTALL) {
                ns.tprint(`Singularity: Prestige criteria met (${prestigePlan.count} augmentations ready). Executing automatic purchase and reset...`);
                // Execute buy script
                triggeredReset = await runTaskWait("/sing/buy-augs.js");
            } else {
                if (now - lastPrestigeNotify > 300000) {
                    ns.tprint(`Singularity: Prestige threshold met (${prestigePlan.count} augmentations ready to install). Auto-install is disabled. To buy and install them manually, run: run /sing/buy-augs.js`);
                    lastPrestigeNotify = now;
                }
            }
        }

        if (!triggeredReset) {
            // No prestige triggered or auto-install is disabled, determine next work target
            const workTarget = determineWorkTarget(ns, state);
            if (workTarget) {
                // Focus logic
                let shouldFocus = false;
                if (workTarget.name === lastWorkTarget && workTarget.type === lastWorkType) {
                    const elapsed = Date.now() - lastWorkStartTime;
                    if (elapsed > SING_FOCUS_DELAY_MS) {
                        shouldFocus = true;
                    }
                } else {
                    lastWorkTarget = workTarget.name;
                    lastWorkType = workTarget.type;
                    lastWorkStartTime = Date.now();
                }

                await runTask("/sing/work.js", [workTarget.name, workTarget.type, shouldFocus ? "true" : "false"]);
            } else {
                // No work needed, stop any current automated work to avoid locking focus
                if (lastWorkTarget !== "") {
                    await runTask("/sing/work.js", ["stop", "stop", "false"]);
                    lastWorkTarget = "";
                    lastWorkType = "";
                }
            }
        }

        await ns.sleep(SING_TICK_MS);
    }
}

/**
 * Calculates augmentations we can buy and whether we should prestige.
 */
function calculatePrestigePlan(ns, state) {
    const minAugs = SING_MIN_AUGS_TO_INSTALL || 20;
    let wallet = ns.getServerMoneyAvailable("home");
    let multiplier = 1.9 ** state.pendingInstall.length;

    // Collect all candidates we can buy
    const candidates = [];
    const ownedSet = new Set([...state.ownedAugs]);

    for (const factionName in state.factions) {
        const faction = state.factions[factionName];
        for (const aug of faction.augs) {
            // Skip already owned or already in candidates list
            if (ownedSet.has(aug.name) || aug.name === "NeuroFlux Governor") continue;
            
            // Check if we meet the reputation requirement
            if (faction.rep >= aug.repReq) {
                candidates.push({
                    name: aug.name,
                    basePrice: aug.price / multiplier, // approximate base price
                    repReq: aug.repReq,
                    prereqs: aug.prereqs,
                    faction: factionName
                });
            }
        }
    }

    // Sort candidates: B&A augmentations first, then by base price descending (approximate)
    candidates.sort((a, b) => {
        const aIsBna = a.faction === "Bachman & Associates";
        const bIsBna = b.faction === "Bachman & Associates";
        if (aIsBna && !bIsBna) return -1;
        if (!aIsBna && bIsBna) return 1;
        return b.basePrice - a.basePrice;
    });

    const plan = [];
    const plannedSet = new Set();

    // Helper to recursively add prereqs
    function addAugToPlan(aug) {
        if (plannedSet.has(aug.name)) return true;
        
        // Add prereqs first
        for (const prereqName of aug.prereqs) {
            if (!ownedSet.has(prereqName) && !plannedSet.has(prereqName)) {
                // Find candidate for prereq
                const prereqAug = candidates.find(c => c.name === prereqName);
                if (prereqAug) {
                    if (!addAugToPlan(prereqAug)) return false;
                } else {
                    // Prereq is not purchasable right now
                    return false;
                }
            }
        }

        // Calculate actual price with current multiplier
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

    // Greedily build plan
    for (const aug of candidates) {
        addAugToPlan(aug);
    }

    // Check if any unique (non-NFG) augmentations from our joined factions are still unowned
    let uniqueRemaining = false;
    for (const factionName in state.factions) {
        const faction = state.factions[factionName];
        for (const aug of faction.augs) {
            if (aug.name !== "NeuroFlux Governor" && !ownedSet.has(aug.name)) {
                uniqueRemaining = true;
                break;
            }
        }
        if (uniqueRemaining) break;
    }

    // Spend rest of wallet on NeuroFlux Governor ONLY if it is the ONLY augment remaining
    if (!uniqueRemaining) {
        let nfgAvailable = false;
        let nfgFaction = "";
        let nfgPrice = Infinity;
        let nfgRepReq = Infinity;

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
            let baseNfgPrice = nfgPrice / multiplier;
            while (true) {
                const actualPrice = baseNfgPrice * multiplier;
                if (wallet >= actualPrice) {
                    wallet -= actualPrice;
                    multiplier *= 1.9;
                    plan.push({ name: "NeuroFlux Governor", faction: nfgFaction });
                } else {
                    break;
                }
            }
        }
    }

    // Count only unique (non-NeuroFlux Governor) augmentations towards the threshold
    const pendingUnique = state.pendingInstall.filter(a => a !== "NeuroFlux Governor").length;
    const planUnique = plan.filter(item => item.name !== "NeuroFlux Governor").length;
    const uniqueCount = pendingUnique + planUnique;

    // We can prestige if we meet the unique augment threshold,
    // OR if we have bought all remaining unique augs (so NFG is the only one left) and bought at least one thing.
    const canPrestige = (uniqueCount >= minAugs) || (!uniqueRemaining && plan.length > 0);

    return {
        canPrestige,
        count: uniqueCount,
        plan
    };
}

/**
 * Determines what faction or company the player should work for.
 */
function determineWorkTarget(ns, state) {
    // 1. Check if we need to work at Bachman & Associates to unlock its faction
    const bnaJoined = "Bachman & Associates" in state.factions;
    if (!bnaJoined && state.player) {
        const jobs = state.player.jobs || {};
        const skills = state.player.skills || {};
        const hasJob = "Bachman & Associates" in jobs;
        const hacking = skills.hacking || 0;
        const charisma = skills.charisma || 0;
        
        let qualified = false;
        if (state.bnaEntryReqs && state.bnaEntryReqs.length > 0) {
            for (const req of state.bnaEntryReqs) {
                if (hacking >= (req.hacking || 0) &&
                    charisma >= (req.charisma || 0) &&
                    (skills.strength || 0) >= (req.strength || 0) &&
                    (skills.defense || 0) >= (req.defense || 0) &&
                    (skills.dexterity || 0) >= (req.dexterity || 0) &&
                    (skills.agility || 0) >= (req.agility || 0)) {
                    qualified = true;
                    break;
                }
            }
        } else {
            // Fallback if no scanned data is available yet
            qualified = hacking >= 225;
        }
        
        if (hasJob || qualified) {
            // B&A is in Aevum. If we are in another city, we must be able to afford the $200k travel cost
            const city = state.player.city || "Sector-12";
            const money = ns.getServerMoneyAvailable("home");
            if (city === "Aevum" || money >= 200000) {
                return {
                    name: "Bachman & Associates",
                    type: "company"
                };
            }
        }
    } else if (bnaJoined) {
        // If B&A faction is joined, prioritize grinding its rep until we meet all B&A aug requirements
        const bnaFaction = state.factions["Bachman & Associates"];
        const bnaRep = bnaFaction.rep;
        const needsRep = bnaFaction.augs.some(aug => !aug.owned && aug.name !== "NeuroFlux Governor" && aug.repReq > bnaRep);
        if (needsRep) {
            return {
                name: "Bachman & Associates",
                type: "hacking"
            };
        }
    }

    // 2. Faction Work: Find the faction with the smallest reputation gap to unlock its next aug
    let bestFaction = null;
    let minGap = Infinity;
    let bestWorkType = "hacking";

    for (const factionName in state.factions) {
        const faction = state.factions[factionName];
        let factionHasUnownedAugs = false;

        for (const aug of faction.augs) {
            if (!aug.owned) {
                factionHasUnownedAugs = true;
                const gap = aug.repReq - faction.rep;
                if (gap > 0 && gap < minGap) {
                    minGap = gap;
                    bestFaction = factionName;
                }
            }
        }

        // Determine best work type for this faction if selected
        if (bestFaction === factionName) {
            // CyberSec, NiteSec, Black Hand, BitRunners, Bachman & Associates only support Hacking work.
            // Other factions might support field/security work.
            if (["CyberSec", "NiteSec", "The Black Hand", "BitRunners", "Bachman & Associates"].includes(factionName)) {
                bestWorkType = "hacking";
            } else {
                bestWorkType = "field"; // default fallback for other factions
            }
        }
    }

    if (bestFaction) {
        return {
            name: bestFaction,
            type: bestWorkType
        };
    }

    // 3. Fallback: Work at Joe's Guns to bootstrap stats/money at early game
    return {
        name: "Joe's Guns",
        type: "company"
    };
}
