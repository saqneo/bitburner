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
    
    if (ns.fileExists(script)) {
        ns.tprint(`Daemon: Spawning stage '${state}' (${script})...`);
        ns.spawn(script); // Use spawn as daemon exits immediately
    } else {
        ns.tprint(`Daemon ERROR: Stage script '${script}' not found! Defaulting to 'early'.`);
        if (state !== 'early' && ns.fileExists('/stages/early.js')) {
             ns.spawn('/stages/early.js'); // Fallback also uses spawn
        }
    }
}