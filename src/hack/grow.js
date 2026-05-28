/** @param {NS} ns */
export async function main(ns) {
    const target = ns.args[0];
    const delay = ns.args[2] || 0;
    if (delay > 0) {
        await ns.sleep(delay);
    }
    await ns.grow(target);
}