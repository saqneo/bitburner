import { spread } from '/hack/spread.js';
import { getAllNodes } from '/lib/map.js';
import { killAll } from '/lib/process.js';
import { checkTransition } from '/lib/progression.js';
import { smartScp, smartExec, deployLibs } from '/lib/deploy.js';
import { TICK_RATE_MS } from '/lib/constants.js';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.print("Stage: EARLY GAME started.");

    const SCRIPT_NAME = "hack/early-hack.js";

    while (true) {
        // 1. Spread & Deploy
        spread(ns);
        const hosts = getAllNodes(ns);
        await smartScp(ns, SCRIPT_NAME, hosts);
        await deployLibs(ns, hosts); // Deploy all libs and utils
        smartExec(ns, SCRIPT_NAME, hosts);

        // --- 2. Infrastructure Management ---
        await delegateServerPurchasesAndUpgrades(ns, SCRIPT_NAME);
        await delegateHacknetUpgrades(ns, SCRIPT_NAME);
        
        // --- 3. State Transition Check ---
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
 * Delegates server purchasing to a remote host.
 * @param {NS} ns
 * @param {string} SCRIPT_NAME - The script to kill to make RAM available.
 */
async function delegateServerPurchasesAndUpgrades(ns, SCRIPT_NAME) {
    const taskScriptName = '/util/purchase-server.js';
    await delegateTask(ns, SCRIPT_NAME, taskScriptName);
}

/**
 * Delegates hacknet upgrades to a remote host.
 * @param {NS} ns
 * @param {string} SCRIPT_NAME - The script to kill to make RAM available.
 */
async function delegateHacknetUpgrades(ns, SCRIPT_NAME) {
    const taskScriptName = '/util/upgrade-hacknet.js';
    await delegateTask(ns, SCRIPT_NAME, taskScriptName);
}

/**
 * A generic function to delegate a task to a remote host to save RAM on home.
 * Assumes the script and its dependencies are already on the target host.
 * @param {NS} ns
 * @param {string} SCRIPT_NAME - The script to kill on the remote host for RAM.
 * @param {string} taskScriptName - The script to execute on the remote host.
 */
async function delegateTask(ns, SCRIPT_NAME, taskScriptName) {
    // Ram cost of the task script itself, plus its direct dependencies
    // Note: this is a simplification. We assume dependencies are in /lib/
    const ramForTask = ns.getScriptRam(taskScriptName) 
                     + ns.getScriptRam(taskScriptName.replace('/util/', '/lib/'));


    const potentialHosts = getAllNodes(ns)
        .filter(h => h !== 'home' && ns.hasRootAccess(h) && ns.getServerMaxRam(h) >= 16)
        .sort((a,b) => ns.getServerMaxRam(b) - ns.getServerMaxRam(a));

    let taskHost = null;
    for (const host of potentialHosts) {
        if ((ns.getServerMaxRam(host) - ns.getServerUsedRam(host)) >= ramForTask) {
            taskHost = host;
            break;
        }
    }

    if (taskHost) {
        let scriptPid = -1;
        const procs = ns.ps(taskHost);
        for (const proc of procs) {
            if (proc.filename === SCRIPT_NAME) {
                ns.kill(proc.pid);
                scriptPid = proc.pid;
            }
        }
        
        while(ns.isRunning(scriptPid)) {
             await ns.sleep(TICK_RATE_MS);
        }

        const pid = ns.exec(taskScriptName, taskHost, 1);
        if (pid > 0) {
            while(ns.isRunning(pid)) {
                await ns.sleep(TICK_RATE_MS);
            }
        } else {
            ns.print(`WARN: Failed to run ${taskScriptName} on '${taskHost}'.`);
        }
    }
}