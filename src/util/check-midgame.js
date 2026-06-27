import { getAllNodes } from '/lib/map.js';

/** @param {NS} ns */
export async function main(ns) {
    const targetScript = "/stages/midgame.js";
    const isRunning = ns.isRunning(targetScript, "home");
    const statusFile = "/data/midgame-status.json";
    
    ns.tprint("\n=== MIDGAME PIPELINE STATUS ===");
    ns.tprint(`Orchestrator ${targetScript} running: ${isRunning ? "YES" : "NO"}`);
    
    // 1. Print Active Pipelines Table
    if (ns.fileExists(statusFile)) {
        try {
            const status = JSON.parse(ns.read(statusFile));
            const pipelines = Object.entries(status.pipelines);
            
            if (pipelines.length > 0) {
                // Sort targets alphabetically
                pipelines.sort((a, b) => a[0].localeCompare(b[0]));
                
                ns.tprint("\nTarget Pipelines & Landing Schedules:");
                ns.tprint("---------------------------------------------------------------");
                ns.tprint(`| ${"Target Server".padEnd(20)} | ${"Status".padEnd(12)} | ${"Next Landing".padEnd(18)} |`);
                ns.tprint("---------------------------------------------------------------");
                for (const [target, data] of pipelines) {
                    let statusStr = "Pipelining";
                    let landingStr = `${(data.timeLeftMs / 1000).toFixed(1)}s`;
                    if (data.isPrepping) {
                        statusStr = "Prepping";
                    }
                    if (data.nextLandingTime === 0) {
                        landingStr = "N/A (Prepping)";
                    }
                    ns.tprint(`| ${target.padEnd(20)} | ${statusStr.padEnd(12)} | ${landingStr.padEnd(18)} |`);
                }
                ns.tprint("---------------------------------------------------------------");
            } else {
                ns.tprint("\nNo targets currently active in harvest or prep pipelines.");
            }
        } catch (e) {
            ns.tprint(`ERROR reading midgame status file: ${e}`);
        }
    } else {
        ns.tprint("\nNo pipeline status file found yet (/data/midgame-status.json). Please wait a few seconds.");
    }
    
    // 2. Count active worker scripts in the cluster
    const nodes = getAllNodes(ns);
    let hackCount = 0;
    let growCount = 0;
    let weakenCount = 0;
    let shareCount = 0;
    
    for (const host of nodes) {
        if (!ns.hasRootAccess(host)) continue;
        const running = ns.ps(host);
        for (const proc of running) {
            if (proc.filename.endsWith("hack.js")) hackCount++;
            else if (proc.filename.endsWith("grow.js")) growCount++;
            else if (proc.filename.endsWith("weaken.js")) weakenCount++;
            else if (proc.filename.endsWith("share.js")) shareCount++;
        }
    }
    
    ns.tprint("\nActive worker processes across network:");
    ns.tprint(`  Hacks:   ${hackCount}`);
    ns.tprint(`  Grows:   ${growCount}`);
    ns.tprint(`  Weakens: ${weakenCount}`);
    ns.tprint(`  Shares:  ${shareCount}`);
    
    // 3. Print recent logs
    if (isRunning) {
        ns.tprint("\nRecent Orchestrator Logs:");
        const logs = ns.getScriptLogs(targetScript, "home");
        for (const log of logs.slice(-10)) {
            ns.tprint(`  ${log}`);
        }
    }
    ns.tprint("====================================\n");
}
