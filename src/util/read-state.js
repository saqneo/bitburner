/** @param {NS} ns */
export async function main(ns) {
    const file = "/data/sing-state.json";
    if (ns.fileExists(file)) {
        const content = ns.read(file);
        ns.tprint("--------------------------------------------------");
        ns.tprint("CONTENT OF /data/sing-state.json:");
        ns.tprint(content);
        ns.tprint("--------------------------------------------------");
    } else {
        ns.tprint("ERROR: File not found: " + file);
    }
}
