/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    const target = ns.args[0];
    const type = ns.args[1]; // "hacking" | "field" | "security" | "company" | "stop"
    const shouldFocus = ns.args[2] === "true" || ns.args[2] === true;

    if (!target || target === "stop" || type === "stop") {
        ns.singularity.stopAction();
        ns.print("Stopped current action.");
        return;
    }

    // Check current work
    const current = ns.singularity.getCurrentWork();
    let alreadyDoingWork = false;

    if (current) {
        if (type === "company" && current.type === "COMPANY" && current.companyName === target) {
            alreadyDoingWork = true;
        } else if (current.type === "FACTION" && current.factionName === target && current.factionWorkType === type) {
            alreadyDoingWork = true;
        }
    }

    if (alreadyDoingWork) {
        if (shouldFocus && !ns.singularity.isFocused()) {
            ns.singularity.setFocus(true);
            ns.print(`Already working. Forcing focus ON (AFK mode).`);
        } else {
            ns.print(`Already working. Current focus respected.`);
        }
        return;
    }

    // Stop current action first to switch tasks cleanly
    if (current) {
        ns.singularity.stopAction();
    }

    if (type === "company") {
        const companyCities = {
            "Bachman & Associates": "Aevum",
            "ECorp": "Aevum",
            "Fulcrum Technologies": "Aevum",
            "Clarke Martell": "Volhaven",
            "NWO": "Volhaven",
            "OmniTek": "Volhaven",
            "KuaiGong International": "Chongqing",
            "Joe's Guns": "Sector-12",
            "Four Sigma": "Sector-12",
            "MegaCorp": "Sector-12",
            "Blade Industries": "Sector-12"
        };

        const requiredCity = companyCities[target];
        const player = ns.getPlayer();
        if (requiredCity && player.city !== requiredCity) {
            const travelCost = 200000;
            if (ns.getServerMoneyAvailable("home") >= travelCost) {
                if (ns.singularity.travelToCity(requiredCity)) {
                    ns.tprint(`Singularity: Traveled to ${requiredCity} to work at ${target}`);
                } else {
                    ns.tprint(`ERROR: Failed to travel to ${requiredCity}`);
                    return;
                }
            } else {
                ns.tprint(`WARNING: Cannot work at ${target} because we are in ${player.city} and cannot afford to travel to ${requiredCity}.`);
                return;
            }
        }

        // Try to apply first (promotions or initial hiring) using all JobField enum members.
        // Corporate companies use software/business/IT/security, but simpler employers
        // like Joe's Guns only offer employee/part-time/waiter positions.
        const fields = [
            ns.enums.JobField.software,
            ns.enums.JobField.business,
            ns.enums.JobField.it,
            ns.enums.JobField.security,
            ns.enums.JobField.agent,
            ns.enums.JobField.employee,
            ns.enums.JobField.partTime,
            ns.enums.JobField.waiter
        ];
        for (const field of fields) {
            try {
                const job = ns.singularity.applyToCompany(target, field);
                if (job) {
                    ns.print(`Singularity: Applied to ${target} in ${field} field. Job: ${job}`);
                    break; // Got a job, stop trying other fields
                }
            } catch (e) {
                // Ignore failure on specific fields
            }
        }
        
        // Verify we actually hold a job here now
        const playerJobs = ns.getPlayer().jobs;
        if (target in playerJobs) {
            if (ns.singularity.workForCompany(target, shouldFocus)) {
                ns.tprint(`Singularity: Started working at ${target} (${playerJobs[target]})`);
            } else {
                ns.tprint(`ERROR: Failed to start work at ${target} despite holding job '${playerJobs[target]}'`);
            }
        } else {
            ns.tprint(`WARNING: Cannot work at ${target} — applied to all job fields but none accepted. Player may not meet any position requirements.`);
        }
    } else {
        // Faction work
        if (ns.singularity.workForFaction(target, type, shouldFocus)) {
            ns.tprint(`Singularity: Started working for Faction ${target} (${type})`);
            ns.rm("/data/sing-work-fail.txt");
        } else {
            // Try other work types if the requested one is not available
            const fallbacks = ["hacking", "field", "security"];
            let success = false;
            for (const f of fallbacks) {
                if (f !== type) {
                    if (ns.singularity.workForFaction(target, f, shouldFocus)) {
                        ns.tprint(`Singularity: Started fallback work for Faction ${target} (${f})`);
                        success = true;
                        ns.rm("/data/sing-work-fail.txt");
                        break;
                    }
                }
            }
            if (!success) {
                ns.tprint(`WARNING: Cannot work for Faction '${target}' — stats too low after reset? Signaling manager to fall back.`);
                ns.write("/data/sing-work-fail.txt", target, "w");
            }
        }
    }
}
