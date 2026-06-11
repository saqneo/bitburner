/** @param {NS} ns */
export async function main(ns) {
    const logs = ns.getScriptLogs("/sing/manager.js");
    ns.tprint("--------------------------------------------------");
    ns.tprint("RECENT LOGS OF /sing/manager.js:");
    for (const log of logs.slice(-30)) {
        ns.tprint(log);
    }
    ns.tprint("--------------------------------------------------");
    
    // Also read state to see if B&A is joined
    const stateFile = "/data/sing-state.json";
    if (ns.fileExists(stateFile)) {
        const state = JSON.parse(ns.read(stateFile));
        ns.tprint(`B&A Joined in State: ${"Bachman & Associates" in state.factions}`);
        if (state.factions["Bachman & Associates"]) {
            ns.tprint(`B&A Rep: ${state.factions["Bachman & Associates"].rep}`);
        }
        ns.tprint(`Current work target according to last scan: ${JSON.stringify(ns.singularity.getCurrentWork())}`);
    }
}
