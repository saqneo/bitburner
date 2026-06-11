/**
 * BFS to find the shortest path from a starting node (defaults to home) to target.
 * Does not use any Singularity functions.
 * @param {NS} ns
 * @param {string} target
 * @param {string} [start='home']
 * @returns {string[]|null} Array of hostnames representing the path (inclusive of start and target), or null if not found.
 */
export function getPath(ns, target, start = 'home') {
    if (start === target) return [start];
    
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
                queue.push([...currentPath, neighbor]);
            }
        }
    }

    return null;
}
