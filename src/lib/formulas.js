/** @param {import('../..').NS} ns */
export async function main(ns) {

}

/** @param {import('../..').NS} ns */
export function shouldUseFormulas(ns) {
    return ns.fileExists('Formulas.exe') && ns.getServer('home').moneyAvailable > 2**32
}