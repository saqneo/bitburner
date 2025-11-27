/** @param {import('../..').NS} ns */
export async function main(ns) {

}

/** @param {import('../..').NS} ns */
export function shouldUseFormulas(ns) {
    return ns.fileExists('Formulas.exe') && ns.getPlayer().money > 2**32
}