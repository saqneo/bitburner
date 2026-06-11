/** @param {NS} ns */
export async function main(ns) {
    ns.tprint("--------------------------------------------------");
    ns.tprint("INSPECTING ns.enums:");
    ns.tprint("--------------------------------------------------");
    
    if (ns.enums) {
        ns.tprint("ns.enums exists! Keys: " + Object.keys(ns.enums).join(", "));
        if (ns.enums.JobField) {
            ns.tprint("ns.enums.JobField exists! Keys/Values:");
            for (const key of Object.keys(ns.enums.JobField)) {
                ns.tprint(`  ${key}: ${ns.enums.JobField[key]}`);
            }
        } else {
            ns.tprint("ns.enums.JobField is UNDEFINED!");
        }
    } else {
        ns.tprint("ns.enums is UNDEFINED!");
    }
    ns.tprint("--------------------------------------------------");
}
