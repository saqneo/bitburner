/** @param {NS} ns */
export async function updateCost(ns, key, cost) {
    const filename = `/tmp/cost-${key}.txt`;
    ns.write(filename, JSON.stringify(cost), "w");
    
    if (ns.getHostname() !== 'home') {
        await ns.scp(filename, 'home');
    }
}

/** @param {NS} ns */
export function getCost(ns, key) {
    const file = `/tmp/cost-${key}.txt`;
    if (!ns.fileExists(file, 'home')) return 0; // Always check home for the source of truth
    return parseFloat(ns.read(file));
}