/** @param {NS} ns */
export async function main(ns) {
    const target = ns.args[0];

    if (!target) {
        ns.tprint("ERROR: Please specify a target server name.");
        ns.tprint("Usage: run util/path.js <target_hostname>");
        return;
    }

    if (!ns.serverExists(target)) {
        ns.tprint(`ERROR: Server '${target}' does not exist.`);
        return;
    }

    const start = ns.getHostname();
    if (start === target) {
        ns.tprint("You are already on the target server.");
        return;
    }

    const path = findPath(ns, start, target);

    if (!path) {
        ns.tprint(`ERROR: Could not find a path from '${start}' to '${target}'.`);
        return;
    }

    // Visual Output
    ns.tprint("\n" + path.join(" -> "));

    // Command Output (Copy-paste friendly)
    // 'home' is usually the starting point for terminal usage, but if running from elsewhere,
    // the connect string logic still holds relative to current.
    // Note: The first element is the current node, so we skip it for the connect string.
    const connectString = path.slice(1).map(node => `c ${node}`).join("; ");
    
    ns.tprint(`\n\u001b[32m${connectString};\u001b[0m\n`);
    
    // If Singularity is available in the future, we could auto-connect, 
    // but for now we just provide the string.
}

/**
 * BFS to find the shortest path between two nodes.
 * @param {NS} ns
 * @param {string} start
 * @param {string} target
 * @returns {string[]|null} Array of hostnames representing the path, or null if not found.
 */
function findPath(ns, start, target) {
    const queue = [[start]];
    const visited = new Set([start]);

    while (queue.length > 0) {
        const currentPath = queue.shift();
        const node = currentPath[currentPath.length - 1];

        if (node === target) {
            return currentPath;
        }

        const neighbors = ns.scan(node);
        for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
                visited.add(neighbor);
                // Create new path extending the current one
                queue.push([...currentPath, neighbor]);
            }
        }
    }

    return null;
}
