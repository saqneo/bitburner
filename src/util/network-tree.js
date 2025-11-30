/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    const startNode = "home";
    
    ns.tprint(`\nNetwork Tree & Backdoor Status:\n`);
    ns.tprint("home"); // Root
    
    const visited = new Set([startNode]);
    const actionableCommands = [];
    printTree(ns, startNode, "", visited, [startNode], actionableCommands);

    if (actionableCommands.length > 0) {
        ns.tprint("\u001b[36m[Pending Backdoors]\u001b[0m");
        // Print each command independently, ensuring start from home
        for (const cmd of actionableCommands) {
            ns.tprint(`\u001b[32mc home; ${cmd}\u001b[0m`);
        }
    }
}

/**
 * @param {NS} ns 
 * @param {string} node 
 * @param {string} prefix 
 * @param {Set<string>} visited 
 * @param {string[]} path 
 * @param {string[]} actionableCommands
 */
function printTree(ns, node, prefix, visited, path, actionableCommands) {
    // Filter neighbors: Not visited, Not purchased (owned- or explicit check)
    const neighbors = ns.scan(node).filter(n => {
        if (visited.has(n)) return false;
        // Optimization: Check name pattern first to avoid ns.getServer call if obvious
        if (n.startsWith('hacknet-node')) return false; // Assuming hacknet nodes are irrelevant too
        const server = ns.getServer(n);
        return !server.purchasedByPlayer;
    });
    
    // Sort neighbors alpha-insensitively
    neighbors.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

    // Determine player capabilities for 'Unavailable' reasons
    const playerHack = ns.getHackingLevel();
    let portOpeners = 0;
    if (ns.fileExists("BruteSSH.exe", "home")) portOpeners++;
    if (ns.fileExists("FTPCrack.exe", "home")) portOpeners++;
    if (ns.fileExists("relaySMTP.exe", "home")) portOpeners++;
    if (ns.fileExists("HTTPWorm.exe", "home")) portOpeners++;
    if (ns.fileExists("SQLInject.exe", "home")) portOpeners++;

    for (let i = 0; i < neighbors.length; i++) {
        const child = neighbors[i];
        visited.add(child);

        const isLast = i === neighbors.length - 1;
        const marker = isLast ? "└── " : "├── ";
        
        const server = ns.getServer(child);
        let lineOutput = "";

        // Servers that require a backdoor for Factions or Ending
        const FACTION_SERVERS = new Set([
            "CSEC",           // CyberSec
            "avmnite-02h",    // NiteSec
            "I.I.I.I",        // The Black Hand
            "run4theh111z",   // BitRunners
            "w0r1d_d43m0n",   // BitNode Completion
            "fulcrumassets"   // Fulcrum Secret Technologies
        ]);
        
        // --- STATE LOGIC ---
        
        if (server.backdoorInstalled) {
            // 1. Backdoor Installed: Default color
            lineOutput = `${child} (Completed)`; 
        } 
        else if (server.hasAdminRights && playerHack >= server.requiredHackingSkill) {
            // 2. Available
            if (FACTION_SERVERS.has(child)) {
                // Special Server: Show Command and Collect
                const newPath = [...path, child];
                const cmd = newPath.slice(1).map(n => `c ${n}`).join("; ");
                const fullCmd = `${cmd}; backdoor`;
                
                lineOutput = `\u001b[32m${fullCmd}\u001b[0m`;
                actionableCommands.push(fullCmd);
            } else {
                // Standard Server: Show Name (Default color)
                lineOutput = `${child} (Backdoor Available)`; 
            }
        } 
        else {
            // 3. Unavailable: Red, Name + Reasons
            const reasons = [];
            if (playerHack < server.requiredHackingSkill) {
                reasons.push(`Hack ${server.requiredHackingSkill}`);
            }
            if (server.numOpenPortsRequired > portOpeners) {
                reasons.push(`Ports ${server.numOpenPortsRequired}`);
            }
            
            if (reasons.length === 0 && !server.hasAdminRights) {
                // Needs Nuke
                reasons.push("Need Root Access");
            }
            
            const reasonStr = reasons.length > 0 ? `(Req: ${reasons.join(", ")})` : "";
            lineOutput = `\u001b[31m${child} ${reasonStr}\u001b[0m`;
        }

        // Print
        ns.tprint(`${prefix}${marker}${lineOutput}`);
        
        // Recurse
        const nextPrefix = prefix + (isLast ? "    " : "│   ");
        printTree(ns, child, nextPrefix, visited, [...path, child], actionableCommands);
    }
}