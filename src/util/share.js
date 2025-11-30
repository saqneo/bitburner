/** @param {NS} ns */
export async function main(ns) {
    // Basic loop to generate share power
    // RAM cost: 4GB (ns.share) + base
    while (true) {
        await ns.share();
    }
}
