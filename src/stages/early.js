import { getAllNodes, getUnownedNodes } from '/lib/map.js';
import { killAll } from '/lib/process.js';
import { checkTransition } from '/lib/progression.js';
import { smartExec, deployLibs } from '/lib/deploy.js';
import { TICK_RATE_MS } from '/lib/constants.js';
import { spread } from '/hack/spread.js';
import { getCost } from '/lib/cost.js';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.print("Stage: EARLY GAME started.");

    const SCRIPT_NAME = "hack/early-hack.js";

    while (true) {
        // 1. Spread & Deploy
        spread(ns);
        const allHosts = getAllNodes(ns); // Used for deploying libs and utils to ALL rooted hosts
        await deployLibs(ns, allHosts); // Deploy all libs and utils
        await delegateHackScript(ns, SCRIPT_NAME); // Delegate hack script deployment and execution

        // --- 2. Infrastructure Management ---
        await delegateServerPurchasesAndUpgrades(ns, SCRIPT_NAME, allHosts);
        await delegateHacknetUpgrades(ns, SCRIPT_NAME, allHosts);
        await delegateContractSolving(ns, SCRIPT_NAME, allHosts);
        
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
 * Delegates the deployment and execution of the main hacking script to unowned hosts.
 * @param {NS} ns
 * @param {string} SCRIPT_NAME - The name of the main hacking script (e.g., "hack/early-hack.js").
 */
async function delegateHackScript(ns, SCRIPT_NAME) {
    const targetHosts = getUnownedNodes(ns);
    smartExec(ns, SCRIPT_NAME, targetHosts);
}

/**
 * Delegates server purchasing to a remote host.
 * @param {NS} ns
 * @param {string} SCRIPT_NAME - The script to kill to make RAM available.
 * @param {string[]} allHosts - List of all available hosts.
 */
async function delegateServerPurchasesAndUpgrades(ns, SCRIPT_NAME, allHosts) {
    // Prerequisite: Check if we have enough money to potentially buy/upgrade something.
    // We use the cost of the last purchase as a heuristic.
    const lastCost = getCost(ns, 'server') || 55000;
    if (ns.getServerMoneyAvailable("home") < lastCost) return;

    const taskScriptName = '/util/purchase-server.js';
    await delegateTask(ns, SCRIPT_NAME, taskScriptName, allHosts);
}

/**
 * Delegates hacknet upgrades to a remote host.
 * @param {NS} ns
 * @param {string} SCRIPT_NAME - The script to kill to make RAM available.
 * @param {string[]} allHosts - List of all available hosts.
 */
async function delegateHacknetUpgrades(ns, SCRIPT_NAME, allHosts) {
    // Prerequisite: Check if we have enough money for basic hacknet operations.
    // We use the cost of the last purchase as a heuristic.
    const lastCost = getCost(ns, 'hacknet') || 1000;
    if (ns.getServerMoneyAvailable("home") < lastCost) return;

    const taskScriptName = '/util/upgrade-hacknet.js';
    await delegateTask(ns, SCRIPT_NAME, taskScriptName, allHosts);
}

/**
 * Delegates contract solving to a remote host.
 * @param {NS} ns
 * @param {string} SCRIPT_NAME - The script to kill to make RAM available.
 * @param {string[]} allHosts - List of all available hosts.
 */
async function delegateContractSolving(ns, SCRIPT_NAME, allHosts) {
    // Prerequisite: Check for any contracts on the network
    const hasContracts = allHosts.some(host => ns.ls(host, ".cct").length > 0);
    
    if (!hasContracts) return;

    const taskScriptName = '/util/solve-contracts.js';
    await delegateTask(ns, SCRIPT_NAME, taskScriptName, allHosts);
}

/**
 * A generic function to delegate a task to a remote host to save RAM on home.
 * Assumes the script and its dependencies are already on the target host.
 * @param {NS} ns
 * @param {string} SCRIPT_NAME - The script to kill on the remote host for RAM.
 * @param {string} taskScriptName - The script to execute on the remote host.
 * @param {string[]} allHosts - List of all available hosts.
 */
async function delegateTask(ns, SCRIPT_NAME, taskScriptName, allHosts) {
    // Ram cost of the task script itself, plus its direct dependencies
    // Note: this is a simplification. We assume dependencies are in /lib/
    const ramForTask = ns.getScriptRam(taskScriptName) 
                     + ns.getScriptRam(taskScriptName.replace('/util/', '/lib/'));


    const potentialHosts = (allHosts || getAllNodes(ns))
        .filter(h => h !== 'home' && ns.hasRootAccess(h) && ns.getServerMaxRam(h) >= 16)
        .sort((a,b) => ns.getServerMaxRam(b));

    let taskHost = null;
    for (const host of potentialHosts) {
        if (ns.getServerMaxRam(host) >= ramForTask) {
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