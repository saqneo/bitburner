/** @param {NS} ns */
export function getAllNodes(ns) {
    let adjacent = new Set(ns.scan())
    let visited = new Set(['home'])
    
    // Initial scan from home
    adjacent.forEach(node => visited.add(node))

    // Iterative BFS to find all nodes
    for (const node of visited) {
        let neighbors = ns.scan(node)
        for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
                visited.add(neighbor)
            }
        }
    }

    return [...visited]
}

/** @param {NS} ns */
export function getUnownedNodes(ns) {
    const allNodes = getAllNodes(ns);
    return allNodes.filter(node => 
        !node.startsWith('home') && 
        !node.startsWith('owned')
    );
}