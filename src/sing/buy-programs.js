/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    // Buy TOR Router first
    ns.singularity.purchaseTor();

    // List of programs in priority order
    const priority = [
        "BruteSSH.exe",
        "FTPCrack.exe",
        "relaySMTP.exe",
        "HTTPWorm.exe",
        "SQLInject.exe",
        "AutoLink.exe",
        "DeepscanV1.exe",
        "DeepscanV2.exe",
        "ServerProfiler.exe",
        "Formulas.exe"
    ];

    try {
        const available = ns.singularity.getDarkwebPrograms();
        const playerMoney = ns.getServerMoneyAvailable("home");

        for (const prog of priority) {
            if (available.includes(prog) && !ns.fileExists(prog, "home")) {
                const cost = ns.singularity.getDarkwebProgramCost(prog);
                if (playerMoney >= cost) {
                    if (ns.singularity.purchaseProgram(prog)) {
                        ns.tprint(`Singularity: Purchased darkweb program '${prog}'`);
                    }
                }
            }
        }
    } catch (e) {
        // Safe check if darkweb is not available/unlocked yet
    }
}
