import { spread } from '/hack/spread.js';
import { getAllNodes } from '/lib/map.js';
import { killAll } from '/lib/process.js';
import { checkTransition } from '/lib/progression.js';
import { smartScp, smartExec } from '/lib/deploy.js';
import { TICK_RATE_MS } from '/lib/constants.js';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.print("Stage: EARLY GAME started.");

    // HACKING_PROGRAMS array and purchasing loop removed due to RAM concerns.
    // Programs will need to be purchased manually for now.
    // const HACKING_PROGRAMS = [...];
    // for (const program of HACKING_PROGRAMS) { ... }

    const SCRIPT_NAME = "hack/early-hack.js"; // SCRIPT_NAME is still used here

    while (true) {
        // 1. Spread: Gain root access where possible
        spread(ns);

        // 2. Deploy: Copy the script to all remote hosts
        const hosts = getAllNodes(ns); // Needs to get the full list to pass to smartScp and smartExec
        await smartScp(ns, SCRIPT_NAME, hosts);

        // 3. Deploy: Execute the script on all remote hosts
        smartExec(ns, SCRIPT_NAME, hosts);

        // --- 4. Server Purchase Logic ---
        await delegateServerPurchasesAndUpgrades(ns, SCRIPT_NAME);
        
        // --- State Transition Check ---
        const nextStage = checkTransition(ns, "early");
        if (nextStage) {
            ns.tprint(`SUCCESS: Early Game Goals Met. Transitioning to '${nextStage}'.`);
            
            killAll(ns);
            
            ns.write("/data/state.txt", nextStage, "w");
            ns.spawn("/daemon.js");
        }

        await ns.sleep(5000);
    }
}

/**
 * Finds a suitable remote host to run the server purchasing script,
 * kills the primary hacking script on it to free RAM, executes the purchase
 * script, and waits for it to finish. This is done to offload the RAM cost
 * from the home server.
 * @param {NS} ns
 * @param {string} SCRIPT_NAME - The name of the main hacking script (e.g., "hack/early-hack.js").
 */
async function delegateServerPurchasesAndUpgrades(ns, SCRIPT_NAME) {
    const purchaseScriptName = '/util/purchase-server.js';
    const libServers = '/lib/servers.js';
    const ramForPurchase = ns.getScriptRam(purchaseScriptName) + ns.getScriptRam(libServers);

    // Find a host with at least 16GB total RAM and enough free RAM to run the script
    const potentialHosts = getAllNodes(ns)
        .filter(h => h !== 'home' && ns.hasRootAccess(h) && ns.getServerMaxRam(h) >= 16)
        .sort((a,b) => ns.getServerMaxRam(b) - ns.getServerMaxRam(a));

    let purchaseHost = null;
    for (const host of potentialHosts) {
        if ((ns.getServerMaxRam(host) - ns.getServerUsedRam(host)) >= ramForPurchase) {
            purchaseHost = host;
            break;
        }
    }

    if (purchaseHost) {
        await ns.scp([purchaseScriptName, libServers], purchaseHost, "home");
        
        // Kill the hacking script on the host to free up RAM, using the cheaper kill(pid)
        let hack_script_pid = -1;
        const procs = ns.ps(purchaseHost);
        for (const proc of procs) {
            if (proc.filename === SCRIPT_NAME) {
                ns.kill(proc.pid);
                hack_script_pid = proc.pid
            }
        }
        
        // Wait for the script to be fully killed
        while(ns.isRunning(hack_script_pid)) {
             await ns.sleep(TICK_RATE_MS);
        }

        const pid = ns.exec(purchaseScriptName, purchaseHost, 1);
        if (pid > 0) {
            while(ns.isRunning(pid)) {
                await ns.sleep(TICK_RATE_MS);
            }
        } else {
            ns.print(`WARN: Failed to run server management on '${purchaseHost}'.`);
        }
    }
}