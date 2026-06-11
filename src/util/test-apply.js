/** @param {NS} ns */
export async function main(ns) {
    const company = "Bachman & Associates";
    const fields = [
        ns.enums.JobField.software,
        ns.enums.JobField.business,
        ns.enums.JobField.it,
        ns.enums.JobField.security
    ];

    ns.tprint("--------------------------------------------------");
    ns.tprint(`TESTING APPLICATION TO ${company}`);
    ns.tprint("--------------------------------------------------");

    const player = ns.getPlayer();
    ns.tprint(`Player stats: Hacking=${player.skills.hacking}, Charisma=${player.skills.charisma}, City=${player.city}, Money=${player.money}`);

    // Try to travel first to make sure we are in Aevum
    if (player.city !== "Aevum") {
        ns.tprint("Player is not in Aevum. Traveling to Aevum first...");
        if (ns.singularity.travelToCity("Aevum")) {
            ns.tprint("SUCCESS: Traveled to Aevum.");
        } else {
            ns.tprint("FAIL: Could not travel to Aevum.");
        }
    }

    for (const field of fields) {
        try {
            const job = ns.singularity.applyToCompany(company, field);
            ns.tprint(`applyToCompany(${field}) returned: ${job}`);
        } catch (e) {
            ns.tprint(`applyToCompany(${field}) THREW ERROR: ${e}`);
        }
    }

    ns.tprint(`Current player jobs dictionary: ${JSON.stringify(ns.getPlayer().jobs)}`);
    ns.tprint("--------------------------------------------------");
}
