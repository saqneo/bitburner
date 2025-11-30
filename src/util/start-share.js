/** @param {NS} ns */
export async function main(ns) {
    const SHARE_SCRIPT = "/util/share.js";
    const RAM_BUFFER = 32; // Keep 32GB free for other operations/daemon
    const SCRIPT_COST = ns.getScriptRam(SHARE_SCRIPT);

    // 1. Calculate available RAM
    const maxRam = ns.getServerMaxRam("home");
    const usedRam = ns.getServerUsedRam("home");
    
    // Check if share is already running to account for its RAM
    let currentThreads = 0;
    if (ns.scriptRunning(SHARE_SCRIPT, "home")) {
        const running = ns.getRunningScript(SHARE_SCRIPT, "home");
        currentThreads = running.threads;
    }

    // Effective free RAM includes the RAM currently used by share.js
    const effectiveFree = (maxRam - usedRam) + (currentThreads * SCRIPT_COST);
    
    // Calculate max potential threads
    const available = effectiveFree - RAM_BUFFER;
    const maxThreads = Math.floor(available / SCRIPT_COST);

    // 2. Update if significant change available
    // Only restart if we can gain +10% threads or if not running
    if (maxThreads > 0) {
        if (currentThreads === 0 || maxThreads > currentThreads * 1.1) {
            if (currentThreads > 0) {
                ns.kill(SHARE_SCRIPT, "home");
            }
            ns.exec(SHARE_SCRIPT, "home", maxThreads);
            ns.tprint(`Share-Manager: Updated share power to ${maxThreads} threads.`);
        }
    }
}
