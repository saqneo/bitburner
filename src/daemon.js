/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    
    // Define the state file path
    const STATE_FILE = "/data/state.txt";
    let state = "early"; // Default bootstrap state

    // Read the current state if the file exists
    if (ns.fileExists(STATE_FILE)) {
        const content = ns.read(STATE_FILE).trim();
        if (content) {
            state = content;
        }
    }

    const script = `/stages/${state}.js`;
    
    // Service Launching (if RAM permits)
    // Hacknet Manager (Service) - Requires ~4GB
    // Only run if we have > 12GB RAM (e.g., 16GB+) to ensure we don't starve the stage script.
    if (ns.getServerMaxRam("home") > 12 && ns.fileExists("/hacknet.js") && !ns.isRunning("/hacknet.js", "home")) {
        ns.print("Daemon: Launching Hacknet Manager (Service)...");
        ns.exec("/hacknet.js", "home");
    }

    // Spawn the Stage
    if (ns.fileExists(script)) {
        ns.tprint(`Daemon: Spawning stage '${state}' (${script})...`);
        ns.spawn(script);
    } else {
        ns.tprint(`Daemon ERROR: Stage script '${script}' not found! Defaulting to 'early'.`);
        if (state !== 'early' && ns.fileExists('/stages/early.js')) {
             ns.spawn('/stages/early.js');
        }
    }
}