import { getPath } from '/lib/sing-utils.js';

/** @param {NS} ns */
export async function main(ns) {
    ns.tprint("==================================================");
    ns.tprint("SINGULARITY UTILS (PATHFINDER) TEST");
    ns.tprint("==================================================");

    // Test 1: Path to home (should return just ['home'])
    const pathHome = getPath(ns, "home", "home");
    if (pathHome && pathHome.length === 1 && pathHome[0] === "home") {
        ns.tprint("PASS: Path to self resolves correctly.");
    } else {
        ns.tprint(`FAIL: Path to self returned: ${JSON.stringify(pathHome)}`);
    }

    // Test 2: Path to CSEC (or other known early node)
    const targets = ["CSEC", "foodnstuff", "n00dles"];
    let testedNode = "";
    for (const t of targets) {
        if (ns.serverExists(t)) {
            testedNode = t;
            break;
        }
    }

    if (testedNode) {
        const path = getPath(ns, testedNode);
        if (path && path.length > 0 && path[0] === "home" && path[path.length - 1] === testedNode) {
            ns.tprint(`PASS: Path to '${testedNode}' resolved: ${path.join(" -> ")}`);
            
            // Verify path connections
            let valid = true;
            for (let i = 0; i < path.length - 1; i++) {
                const scanResult = ns.scan(path[i]);
                if (!scanResult.includes(path[i+1])) {
                    ns.tprint(`FAIL: Invalid connection in path: ${path[i]} is not connected to ${path[i+1]}`);
                    valid = false;
                    break;
                }
            }
            if (valid) {
                ns.tprint("PASS: Path connections verified.");
            }
        } else {
            ns.tprint(`FAIL: Failed to resolve path to '${testedNode}'. Got: ${JSON.stringify(path)}`);
        }
    } else {
        ns.tprint("SKIP: Could not find early target servers (CSEC/foodnstuff/n00dles) to test pathfinding.");
    }

    ns.tprint("==================================================");
}
