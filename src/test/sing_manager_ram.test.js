/** @param {NS} ns */
export async function main(ns) {
    ns.tprint("==================================================");
    ns.tprint("SINGULARITY SCRIPT RAM COST VERIFICATION");
    ns.tprint("==================================================");

    const scripts = [
        "/sing/manager.js",
        "/sing/join-factions.js",
        "/sing/buy-programs.js",
        "/sing/upgrade-home.js",
        "/sing/backdoor.js",
        "/sing/scan.js",
        "/sing/work.js",
        "/sing/buy-augs.js"
    ];

    let allOk = true;

    for (const script of scripts) {
        if (!ns.fileExists(script, "home")) {
            ns.tprint(`FAIL: ${script} does not exist on home!`);
            allOk = false;
            continue;
        }

        const ram = ns.getScriptRam(script, "home");
        
        // Assert limits if any
        if (script === "/sing/manager.js") {
            const limit = 4.5;
            if (ram > limit) {
                ns.tprint(`FAIL: ${script} consumes ${ram.toFixed(2)} GB (Limit: ${limit} GB)`);
                allOk = false;
            } else {
                ns.tprint(`PASS: ${script} consumes ${ram.toFixed(2)} GB`);
            }
        } else {
            ns.tprint(`INFO: ${script} consumes ${ram.toFixed(2)} GB`);
        }
    }

    ns.tprint("==================================================");
    if (allOk) {
        ns.tprint("VERIFICATION RESULT: ALL PASS");
    } else {
        ns.tprint("VERIFICATION RESULT: FAIL / WARNINGS");
    }
    ns.tprint("==================================================");
}
