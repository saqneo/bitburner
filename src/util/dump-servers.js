import { getAllNodes } from '/lib/map.js';

/** @param {NS} ns **/
export async function main(ns) {
    const nodes = getAllNodes(ns);
    
    let totalMaxRam = 0;
    let totalUsedRam = 0;
    let rootedCount = 0;
    let unrootedCount = 0;
    let backdooredCount = 0;
    
    const serverDetails = [];
    const activeScripts = [];

    for (const host of nodes) {
        const maxRam = ns.getServerMaxRam(host);
        const usedRam = ns.getServerUsedRam(host);
        const hasRoot = ns.hasRootAccess(host);
        const backdoor = ns.getServer(host).backdoorInstalled;
        const reqHacking = ns.getServerRequiredHackingLevel(host);

        if (hasRoot) {
            rootedCount++;
            // Exclude home's reserved RAM if we want, but let's count raw RAM first
            totalMaxRam += maxRam;
            totalUsedRam += usedRam;
        } else {
            unrootedCount++;
        }

        if (backdoor) {
            backdooredCount++;
        }

        // Get running scripts on this server
        const running = ns.ps(host);
        const scriptInfos = [];
        for (const proc of running) {
            const scriptRam = ns.getScriptRam(proc.filename, host);
            const totalProcRam = scriptRam * proc.threads;
            scriptInfos.push({
                pid: proc.pid,
                filename: proc.filename,
                args: proc.args,
                threads: proc.threads,
                ramPerThread: scriptRam,
                totalRam: totalProcRam
            });
            activeScripts.push({
                host,
                pid: proc.pid,
                filename: proc.filename,
                args: proc.args,
                threads: proc.threads,
                totalRam: totalProcRam
            });
        }

        serverDetails.push({
            hostname: host,
            maxRam,
            usedRam,
            freeRam: maxRam - usedRam,
            hasRoot,
            backdoorInstalled: backdoor,
            requiredHacking: reqHacking,
            runningScripts: scriptInfos
        });
    }

    // Sort details by hostname or RAM
    serverDetails.sort((a, b) => b.maxRam - a.maxRam);

    // Save to JSON
    const dumpPath = "/data/server-dump.json";
    await ns.write(dumpPath, JSON.stringify({
        timestamp: Date.now(),
        summary: {
            totalNodes: nodes.length,
            rootedNodes: rootedCount,
            unrootedNodes: unrootedCount,
            backdooredNodes: backdooredCount,
            totalMaxRamGB: totalMaxRam,
            totalUsedRamGB: totalUsedRam,
            freeRamGB: totalMaxRam - totalUsedRam,
            ramUtilizationPercent: totalMaxRam > 0 ? (totalUsedRam / totalMaxRam * 100).toFixed(2) : "0.00"
        },
        servers: serverDetails
    }, null, 2), "w");

    // Print summary to terminal
    ns.tprint("\n=== SERVER STATE DUMP ===");
    ns.tprint(`Total Nodes Scanned: ${nodes.length}`);
    ns.tprint(`Rooted Nodes (Admin): ${rootedCount} / Unrooted: ${unrootedCount}`);
    ns.tprint(`Backdoor Installed: ${backdooredCount}`);
    ns.tprint(`Network RAM (Rooted Nodes):`);
    ns.tprint(`  Max:  ${ns.format.ram(totalMaxRam)}`);
    ns.tprint(`  Used: ${ns.format.ram(totalUsedRam)} (${(totalMaxRam > 0 ? (totalUsedRam / totalMaxRam * 100) : 0).toFixed(1)}% usage)`);
    ns.tprint(`  Free: ${ns.format.ram(totalMaxRam - totalUsedRam)}`);
    ns.tprint(`Detailed server dump written to: ${dumpPath}`);
    
    // Print top active scripts summary
    ns.tprint("\nActive Scripts summary (by RAM consumed):");
    activeScripts.sort((a, b) => b.totalRam - a.totalRam);
    const topScripts = activeScripts.slice(0, 15);
    for (const s of topScripts) {
        ns.tprint(`  [${s.host}] ${s.filename} (t=${s.threads}, RAM=${ns.format.ram(s.totalRam)}) - Args: ${JSON.stringify(s.args)}`);
    }
    if (activeScripts.length > 15) {
        ns.tprint(`  ... and ${activeScripts.length - 15} more script processes.`);
    }
    ns.tprint("=========================\n");
}
