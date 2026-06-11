/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    const invites = ns.singularity.checkFactionInvitations();
    let joinedAny = false;
    for (const faction of invites) {
        if (ns.singularity.joinFaction(faction)) {
            ns.tprint(`Singularity: Joined faction '${faction}'`);
            joinedAny = true;
        }
    }
    if (joinedAny) {
        ns.write("/data/sing-joined-flag.txt", "true", "w");
    }
}
