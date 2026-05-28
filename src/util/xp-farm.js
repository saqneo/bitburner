/** @param {NS} ns */
export async function main(ns) {
    const target = ns.args[0] || "joesguns";
    const script = "/hack/weaken.js";
    const ramCost = ns.getScriptRam(script);
    
    ns.disableLog("ALL");
    ns.tprint(`Starting hyper-XP-farmer on target: ${target}`);
    
    while (true) {
        const hosts = getRootedHosts(ns);
        let totalSpawned = 0;
        
        for (const host of hosts) {
            const maxRam = ns.getServerMaxRam(host);
            const usedRam = ns.getServerUsedRam(host);
            let available = maxRam - usedRam;
            
            // Leave a 128GB reserve on home for safety, but consume all other nodes completely
            if (host === "home") {
                available -= 128;
            }
            
            if (available < ramCost) continue;
            
            const threads = Math.floor(available / ramCost);
            if (threads > 0) {
                if (!ns.fileExists(script, host)) {
                    await ns.scp(script, host, "home");
                }
                const pid = ns.exec(script, host, threads, target);
                if (pid > 0) {
                    totalSpawned += threads;
                }
            }
        }
        
        if (totalSpawned > 0) {
            ns.print(`Polled network: Spawned ${totalSpawned.toLocaleString()} new Weaken threads.`);
        }
        
        // Wait 1 second before scanning for more free RAM
        await ns.sleep(1000);
    }
}

/** @param {NS} ns */
function getRootedHosts(ns) {
    const list = ["home"];
    for (let i = 0; i < list.length; i++) {
        const host = list[i];
        const scan = ns.scan(host);
        for (const child of scan) {
            if (!list.includes(child)) {
                list.push(child);
            }
        }
    }
    return list.filter(h => ns.hasRootAccess(h));
}
