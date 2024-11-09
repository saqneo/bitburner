/** @param {import('../..').NS} ns */
export async function main(ns) {
    if (ns.args[1]) {
        await ns.sleep(ns.args[1])
    }

    await ns.weaken(ns.args[0])
}