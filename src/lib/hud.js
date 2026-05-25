
import { getAllNodes } from '/lib/map.js';

const COLORS = {
    RESET: "\u001b[0m",
    GOLD: "\u001b[33;1m",
    CYAN: "\u001b[36;1m",
    GREEN: "\u001b[32;1m",
    RED: "\u001b[31;1m",
    BLUE: "\u001b[34;1m",
    WHITE: "\u001b[37;1m",
    BRIGHT_BLACK: "\u001b[30;1m",
};

/**
 * Updates the custom HUD in the script's log window.
 * @param {NS} ns
 * @param {Object} context - Extra data to display.
 */
export function updateHud(ns, context = {}) {
    const nodes = getAllNodes(ns);
    const ramStats = getRamStats(ns, nodes);
    const procStats = getProcessStats(ns, nodes);
    const contractCount = getContractCount(ns, nodes);
    const money = ns.getServerMoneyAvailable("home");
    
    ns.clearLog();
    const width = 60;
    const hr = COLORS.BRIGHT_BLACK + "=".repeat(width) + COLORS.RESET;
    
    // --- HEADER ---
    ns.print(hr);
    ns.print(`${COLORS.GOLD} BITBURNER SWARM :: ${context.stage || 'UNKNOWN'}${COLORS.RESET}`);
    ns.print(`${COLORS.WHITE} Cash: ${COLORS.GREEN}$${ns.format.number(money, 2)}${COLORS.RESET} | ${COLORS.CYAN}Contracts: ${contractCount}${COLORS.RESET}`);
    ns.print(hr);

    // --- RAM & THREADS ---
    const ramPct = (ramStats.used / ramStats.max) * 100;
    ns.print(`${COLORS.CYAN} NETWORK RAM  ${COLORS.RESET} ${drawBar(ramStats.used, ramStats.max, 25, COLORS.CYAN)} ${ramPct.toFixed(1)}%`);
    ns.print(` Usage        ${ns.format.ram(ramStats.used)} / ${ns.format.ram(ramStats.max)}`);
    ns.print(` Threads      ${COLORS.WHITE}${ns.format.number(procStats.total, 2)} active workers${COLORS.RESET}`);
    ns.print("");

    // --- OPERATIONS (Columnar) ---
    const col1 = 10, col2 = 30;
    ns.print(`${COLORS.BRIGHT_BLACK}${ "TYPE".padEnd(col1) } ${ "DISTRIBUTION".padEnd(col2) } ${ "COUNT" }${COLORS.RESET}`);
    
    ns.print(`${COLORS.RED}${ " Hack".padEnd(col1)}${COLORS.RESET} ${drawBar(procStats.hack, procStats.total, col2-2, COLORS.RED)} ${ns.format.number(procStats.hack, 1).padStart(8)}`);
    ns.print(`${COLORS.GREEN}${ " Grow".padEnd(col1)}${COLORS.RESET} ${drawBar(procStats.grow, procStats.total, col2-2, COLORS.GREEN)} ${ns.format.number(procStats.grow, 1).padStart(8)}`);
    ns.print(`${COLORS.BLUE}${ " Weaken".padEnd(col1)}${COLORS.RESET} ${drawBar(procStats.weaken, procStats.total, col2-2, COLORS.BLUE)} ${ns.format.number(procStats.weaken, 1).padStart(8)}`);
    ns.print(hr);

    // --- SWARM FOCUS (Top 5 Targets) ---
    ns.print(`${COLORS.GOLD} SWARM FOCUS (Top 5 Targets)${COLORS.RESET}`);
    if (procStats.targets.length > 0) {
        for (let i = 0; i < Math.min(5, procStats.targets.length); i++) {
            const t = procStats.targets[i];
            const pct = (t.threads / procStats.total) * 100;
            ns.print(` ${ (i+1) }. ${t.name.padEnd(18)} : ${ns.format.number(t.threads, 2).padStart(8)} threads (${pct.toFixed(1)}%)`);
        }
    } else {
        ns.print(`${COLORS.BRIGHT_BLACK} No active targets detected.${COLORS.RESET}`);
    }
    ns.print(hr);

    // --- PRIMARY TARGET DETAIL ---
    const primary = context.target || procStats.topTarget;
    if (primary) {
        const server = ns.getServer(primary);
        const secCurr = server.hackDifficulty, secMin = server.minDifficulty;
        const monCurr = server.moneyAvailable, monMax = server.moneyMax;
        const monPct = (monCurr / monMax) * 100;

        ns.print(`${COLORS.GOLD} PRIMARY TARGET: ${COLORS.WHITE}${primary}${COLORS.RESET}`);
        ns.print(` Security : ${secCurr.toFixed(2)} / ${secMin.toFixed(2)}`);
        ns.print(` Money    : $${ns.format.number(monCurr, 2)} (${monPct.toFixed(1)}%)`);
        ns.print(`            ${drawBar(monCurr, monMax, width - 15, COLORS.GREEN)}`);
    }
    ns.print(hr);
}

function getRamStats(ns, nodes) {
    let max = 0, used = 0;
    for (const node of nodes) {
        if (node === "home" || node.startsWith("owned-")) {
            max += ns.getServerMaxRam(node);
            used += ns.getServerUsedRam(node);
        }
    }
    return { max, used };
}

function getProcessStats(ns, nodes) {
    let hack = 0, grow = 0, weaken = 0, total = 0;
    const targetCounts = {};
    for (const node of nodes) {
        const processes = ns.ps(node);
        for (const proc of processes) {
            let isWorker = false;
            if (proc.filename.endsWith("hack.js") && !proc.filename.includes("early-hack")) {
                hack += proc.threads; isWorker = true;
            } else if (proc.filename.endsWith("grow.js")) {
                grow += proc.threads; isWorker = true;
            } else if (proc.filename.endsWith("weaken.js") || proc.filename.includes("early-hack")) {
                weaken += proc.threads; isWorker = true;
            }

            if (isWorker) {
                total += proc.threads;
                if (proc.args.length > 0) {
                    const t = proc.args[0];
                    targetCounts[t] = (targetCounts[t] || 0) + proc.threads;
                }
            }
        }
    }
    const targets = Object.entries(targetCounts)
        .map(([name, threads]) => ({ name, threads }))
        .sort((a, b) => b.threads - a.threads);
    return { hack, grow, weaken, total, topTarget: targets.length > 0 ? targets[0].name : null, targets };
}

function getContractCount(ns, nodes) {
    let count = 0;
    for (const node of nodes) {
        count += ns.ls(node).filter(f => f.endsWith('.cct')).length;
    }
    return count;
}

function drawBar(current, max, width, color) {
    if (max === 0) return "[" + ".".repeat(width) + "]";
    const ratio = Math.min(1, current / max);
    const fillLen = Math.floor(ratio * width);
    const emptyLen = width - fillLen;
    return `[${color}${"|".repeat(fillLen)}${COLORS.BRIGHT_BLACK}${".".repeat(emptyLen)}${COLORS.RESET}]`;
}
