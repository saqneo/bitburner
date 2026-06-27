import { SING_TICK_MS, SING_SCAN_INTERVAL_MS, SING_MIN_AUGS_TO_INSTALL, SING_FOCUS_DELAY_MS, SING_AUTO_INSTALL, SING_STALL_TIMEOUT_MS } from '/lib/constants.js';

/** Hacking-only factions — these only support 'hacking' work type. */
const HACKING_FACTIONS = new Set(["CyberSec", "NiteSec", "The Black Hand", "BitRunners", "Bachman & Associates"]);

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
    const failedWorkTargets = new Set(); // Factions that work.js couldn't execute this cycle
    let lastPlanCount = -1;
    let stallStartTime = Date.now();

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
            if (success) {
                lastScanTime = Date.now();
                failedWorkTargets.clear(); // Stats may have changed, allow retries
            }
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
        // Check if any faction still has unowned augs needing rep — if not, spend aggressively.
        const hasRepTargets = Object.values(state.factions).some(f =>
            f.augs.some(a => !a.owned && a.name !== "NeuroFlux Governor" && a.repReq > f.rep)
        );
        const upgradeInterval = hasRepTargets ? 60000 : 10000; // More frequent when nothing else to save for
        const upgradeBudget = hasRepTargets ? "" : "0.50";     // 50% budget when no rep targets

        if (now - lastUpgradeTime > upgradeInterval) {
            const success = await runTask("/sing/upgrade-home.js", upgradeBudget ? [upgradeBudget] : []);
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

        // 4. Donate to faction for NFG rep if all unique augs are owned
        await runTaskWait("/sing/donate.js");

        // 5. Decision Logic: Prestige or Work
        const stallDuration = Date.now() - stallStartTime;
        const prestigePlan = calculatePrestigePlan(ns, state, stallDuration);
        const hasRedPill = state.installedAugs.includes("The Red Pill");

        // Update stall tracking — reset timer when purchasable count changes
        if (prestigePlan.count !== lastPlanCount) {
            lastPlanCount = prestigePlan.count;
            stallStartTime = Date.now();
        }
        
        // Update HUD global state
        let reasonTag = prestigePlan.reason ? ` [${prestigePlan.reason}]` : "";
        let nextPrestigeText = prestigePlan.canPrestige 
            ? `READY! Buy ${prestigePlan.plan.length} augs${reasonTag}`
            : `${prestigePlan.count}/${prestigePlan.threshold} augs purchasable${prestigePlan.blocked > 0 ? ` (${prestigePlan.blocked} blocked)` : ""}${prestigePlan.donationUnlockAvailable ? " [donate-unlock pending]" : ""}`;
        
        // Append endgame hacking progress when Red Pill is installed
        if (hasRedPill) {
            const hackReq = state.worldDaemonHackReq || 0;
            const hackLvl = state.player?.skills?.hacking || 0;
            nextPrestigeText += ` | w0r1d: ${hackLvl}/${hackReq}`;
        }
            
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
            // Accumulate any work failures from previous ticks
            const failFlag = "/data/sing-work-fail.txt";
            if (ns.fileExists(failFlag)) {
                const failed = ns.read(failFlag).trim();
                if (failed) {
                    failedWorkTargets.add(failed);
                    ns.rm(failFlag);
                }
            }

            // No prestige triggered or auto-install is disabled, determine next work target
            let workTarget = determineWorkTarget(ns, state, failedWorkTargets);
            if (workTarget) {
                // Focus logic
                let shouldFocus = false;
                const hasFocusImplant = state.installedAugs && state.installedAugs.includes("Neuroreceptor Management Implant");
                if (!hasFocusImplant) {
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
                } else {
                    // If we have the focus implant, we never steal focus, but keep tracking target for consistency
                    if (workTarget.name !== lastWorkTarget || workTarget.type !== lastWorkType) {
                        lastWorkTarget = workTarget.name;
                        lastWorkType = workTarget.type;
                        lastWorkStartTime = Date.now();
                    }
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
 * @param {number} stallDurationMs - How long the purchasable count has been unchanged
 */
function calculatePrestigePlan(ns, state, stallDurationMs = 0) {
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

    // --- Dynamic threshold & Blocked augs detection ---
    
    // Build a map of all unique unowned augs across all joined factions
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

    // Helper to check if an augmentation is blocked (prereqs cannot be resolved)
    const blockedMemo = new Map();
    function isBlocked(augName) {
        if (ownedSet.has(augName)) return false;
        if (blockedMemo.has(augName)) return blockedMemo.get(augName);

        const aug = joinedAugsMap.get(augName);
        if (!aug) {
            // Prerequisite is not owned and not available in any joined faction
            return true;
        }

        // Temporarily mark as blocked to prevent infinite loops (should be a DAG anyway)
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

    // Calculate blocked count and identify unblocked unique remaining augs
    let blockedCount = 0;
    let uniqueRemaining = false;
    for (const [name, aug] of joinedAugsMap) {
        if (isBlocked(name)) {
            blockedCount++;
        } else {
            uniqueRemaining = true;
        }
    }

    // Also check unjoined city factions — if any have unowned augs, we're not truly done.
    // This prevents premature NFG-only prestige when we haven't explored all factions yet.
    if (!uniqueRemaining && state.unjoinedCityFactions) {
        for (const factionName in state.unjoinedCityFactions) {
            if (state.unjoinedCityFactions[factionName].unownedCount > 0) {
                uniqueRemaining = true;
                break;
            }
        }
    }

    // Count only unique (non-NeuroFlux Governor) augmentations towards the threshold
    const pendingUnique = state.pendingInstall.filter(a => a !== "NeuroFlux Governor").length;
    const planUnique = plan.filter(item => item.name !== "NeuroFlux Governor").length;
    const uniqueCount = pendingUnique + planUnique;

    // Dynamic threshold: min of requested minAugs or the total possible accessible augs
    const accessibleCount = joinedAugsMap.size - blockedCount;
    const maxPossible = accessibleCount + pendingUnique;
    const threshold = Math.max(1, Math.min(minAugs, maxPossible));

    // --- Donation-unlock prestige detection ---
    // Check if resetting would give any faction enough favor to unlock donations,
    // when that faction still has rep-gapped augs we can't buy yet.
    const favorToDonate = state.favorToDonate || 150;
    let donationUnlockAvailable = false;
    for (const factionName in state.factions) {
        const faction = state.factions[factionName];
        if (faction.favor >= favorToDonate) continue; // Already can donate
        const projectedFavor = faction.projectedFavor || (faction.favor + (faction.favorGain || 0));
        if (projectedFavor < favorToDonate) continue; // Reset wouldn't unlock donations
        const hasRepGap = faction.augs.some(a =>
            !a.owned && a.name !== "NeuroFlux Governor" && a.repReq > faction.rep
        );
        if (hasRepGap) {
            donationUnlockAvailable = true;
            break;
        }
    }

    // --- Stall detection ---
    const isStalling = stallDurationMs > (SING_STALL_TIMEOUT_MS || 1800000);

    // Initial prestige check based on unique (non-NFG) augmentations
    // This gate also controls whether NFG top-off is attempted below.
    const canPrestigeInitial = (uniqueCount >= threshold) || 
                               (!uniqueRemaining && uniqueCount > 0 && plan.length > 0) ||
                               (!uniqueRemaining && plan.length >= 10) ||
                               donationUnlockAvailable ||
                               isStalling;

    // Spend rest of wallet on NeuroFlux Governor if it is the only augment remaining
    // OR if we are already about to prestige (so leftover cash would be lost anyway).
    if (!uniqueRemaining || canPrestigeInitial) {
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

    // Recalculate canPrestige now that NFG levels may have been added
    const canPrestige = (uniqueCount >= threshold) || 
                        (!uniqueRemaining && uniqueCount > 0 && plan.length > 0) ||
                        (!uniqueRemaining && plan.length >= 10) ||
                        (donationUnlockAvailable && plan.length > 0) ||
                        (isStalling && plan.length > 0);

    // Determine the reason for prestige (for HUD/logging)
    let reason = "";
    if (canPrestige) {
        if (uniqueCount >= threshold) reason = "threshold";
        else if (!uniqueRemaining && uniqueCount > 0) reason = "complete";
        else if (!uniqueRemaining && plan.length >= 10) reason = "nfg-only";
        else if (donationUnlockAvailable) reason = "donation-unlock";
        else if (isStalling) reason = "stall";
    }

    return {
        canPrestige,
        count: uniqueCount,
        threshold,
        blocked: blockedCount,
        plan,
        reason,
        donationUnlockAvailable,
        isStalling
    };
}

/**
 * Determines what faction or company the player should work for.
 */
function determineWorkTarget(ns, state, skipFactions = new Set()) {
    // No special Red Pill override — normal priorities apply.
    // Red Pill persists across resets, so continuing to grind rep / buy augs is optimal.
    // Hacking XP grinding is handled by the smart fallback (Priority 3) when nothing else remains.

    // === PRIORITY 1: Bachman & Associates ===
    const bnaJoined = "Bachman & Associates" in state.factions;
    if (!skipFactions.has("Bachman & Associates") && !bnaJoined && state.player) {
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
            const city = state.player.city || "Sector-12";
            const money = ns.getServerMoneyAvailable("home");
            if (city === "Aevum" || money >= 200000) {
                return {
                    name: "Bachman & Associates",
                    type: "company"
                };
            }
        }
    } else if (!skipFactions.has("Bachman & Associates") && bnaJoined) {
        const bnaFaction = state.factions["Bachman & Associates"];
        // Skip B&A faction work if donations can handle rep gaps
        const favorToDonate = state.favorToDonate || 150;
        if (bnaFaction.favor < favorToDonate) {
            const bnaRep = bnaFaction.rep;
            const needsRep = bnaFaction.augs.some(aug => !aug.owned && aug.name !== "NeuroFlux Governor" && aug.repReq > bnaRep);
            if (needsRep) {
                return {
                    name: "Bachman & Associates",
                    type: "hacking"
                };
            }
        }
    }

    // === PRIORITY 2: Faction with smallest rep gap to next unowned aug ===
    let bestFaction = null;
    let minGap = Infinity;
    let bestWorkType = "hacking";
    const favorToDonate = state.favorToDonate || 150;

    for (const factionName in state.factions) {
        if (skipFactions.has(factionName)) continue;
        const faction = state.factions[factionName];

        // Skip factions that can accept donations — rep gaps handled by donate.js
        if (faction.favor >= favorToDonate) continue;

        for (const aug of faction.augs) {
            if (!aug.owned && aug.name !== "NeuroFlux Governor") {
                const gap = aug.repReq - faction.rep;
                if (gap > 0 && gap < minGap) {
                    minGap = gap;
                    bestFaction = factionName;
                }
            }
        }

        if (bestFaction === factionName) {
            bestWorkType = HACKING_FACTIONS.has(factionName) ? "hacking" : "field";
        }
    }

    if (bestFaction) {
        return {
            name: bestFaction,
            type: bestWorkType
        };
    }

    // === PRIORITY 3: Smart fallback ===
    // All joined factions are fully repped. Grind hacking XP at the best faction
    // to continue progressing while waiting for new faction invites or prestige.
    const xpFaction = findBestHackingFaction(state, skipFactions);
    if (xpFaction) {
        return { name: xpFaction, type: "hacking" };
    }

    // Absolute last resort — bootstrap stats/money in early game
    return {
        name: "Joe's Guns",
        type: "company"
    };
}

/**
 * Finds the joined hacking-compatible faction with the highest reputation.
 * Higher rep = better XP multiplier when doing hacking contracts.
 * Returns the faction name, or null if no suitable faction is joined.
 */
function findBestHackingFaction(state, skipFactions = new Set()) {
    let bestFaction = null;
    let bestRep = -1;

    for (const factionName in state.factions) {
        if (skipFactions.has(factionName)) continue;
        // Only consider factions that support hacking work
        if (!HACKING_FACTIONS.has(factionName)) continue;
        const rep = state.factions[factionName].rep;
        if (rep > bestRep) {
            bestRep = rep;
            bestFaction = factionName;
        }
    }

    return bestFaction;
}
