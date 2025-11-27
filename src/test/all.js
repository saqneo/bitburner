/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.print("Running All Tests...");

    const testDir = "/test";
    const files = ns.ls("home", testDir);
    
    let testScripts = files.filter(f => f.endsWith(".js") && f !== "/test/all.js");

    if (testScripts.length === 0) {
        ns.tprint("No tests found in /test/");
        return;
    }

    ns.tprint(`Found ${testScripts.length} test suites: ${testScripts.join(", ")}`);

    for (const script of testScripts) {
        ns.tprint(`\n--- Executing ${script} ---`);
        const pid = ns.run(script);
        if (pid === 0) {
            ns.tprint(`ERROR: Failed to start ${script}. Check RAM usage.`);
        } else {
            while (ns.isRunning(pid)) {
                await ns.sleep(100);
            }
        }
    }
    
    ns.tprint("\nAll tests finished.");
}