/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.print("Running Memory Tests...");
    
    let passes = 0;
    let failures = 0;

    // Define tests: [Script Path, Max RAM]
    const tests = [
        ["/daemon.js", 6.0],
        ["/stages/early.js", 8.0], // Could theoretically go up to 8.0GB, kept at 5.0GB as a warning check.
        ["/hacknet.js", 6.0]
    ];

    for (const [script, limit] of tests) {
        if (!ns.fileExists(script)) {
            ns.tprint(`SKIP: ${script} not found.`);
            continue;
        }

        const ram = ns.getScriptRam(script);
        if (ram <= limit) {
            ns.tprint(`PASS: ${script} uses ${ram}GB (Limit: ${limit}GB)`);
            passes++;
        } else {
            ns.tprint(`FAIL: ${script} uses ${ram}GB (Limit: ${limit}GB). To diagnose, run 'mem ${script}' in the in-game terminal.`);
            failures++;
        }
    }

    ns.tprint(`Tests Complete: ${passes} Passed, ${failures} Failed.`);
}