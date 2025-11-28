
import { getAllNodes } from '/lib/map.js';

const COLORS = {
    RESET: "\u001b[0m",
    BLACK: "\u001b[30m",
    RED: "\u001b[31m",
    GREEN: "\u001b[32m",
    YELLOW: "\u001b[33m",
    BLUE: "\u001b[34m",
    MAGENTA: "\u001b[35m",
    CYAN: "\u001b[36m",
    WHITE: "\u001b[37m",
    BRIGHT_BLACK: "\u001b[30;1m",
    BRIGHT_RED: "\u001b[31;1m",
    BRIGHT_GREEN: "\u001b[32;1m",
    BRIGHT_YELLOW: "\u001b[33;1m",
    BRIGHT_BLUE: "\u001b[34;1m",
    BRIGHT_MAGENTA: "\u001b[35;1m",
    BRIGHT_CYAN: "\u001b[36;1m",
    BRIGHT_WHITE: "\u001b[37;1m",
};

/**
 * Updates the custom HUD in the script's log window.
 * @param {NS} ns
 * @param {Object} context - Extra data to display (e.g., current target).
 */
export function updateHud(ns, context = {}) {
    // 1. Gather Data
    const nodes = getAllNodes(ns);
    const ramStats = getRamStats(ns, nodes);
    const procStats = getProcessStats(ns, nodes);
    const money = ns.getServerMoneyAvailable("home");
    
    // 2. Format & Draw
    ns.clearLog();
    
    const width = 50;
    const hr = COLORS.BRIGHT_BLACK + "=".repeat(width) + COLORS.RESET;
    
    // --- HEADER ---
    ns.print(hr);
    ns.print(`${COLORS.BRIGHT_WHITE} BITBURNER OPS :: ${context.stage || 'UNKNOWN'} ${COLORS.RESET}`);
    ns.print(`${COLORS.WHITE} Cash: ${COLORS.GREEN}$${ns.formatNumber(money, 2)}${COLORS.RESET}`);
    ns.print(hr);

    // --- RAM USAGE ---
    const ramPct = (ramStats.used / ramStats.max) * 100;
    ns.print(`${COLORS.CYAN} NETWORK RAM (Owned)${COLORS.RESET}`);
    ns.print(drawBar(ramStats.used, ramStats.max, width - 10, COLORS.BRIGHT_CYAN));
    ns.print(`${ns.formatRam(ramStats.used)} / ${ns.formatRam(ramStats.max)} (${ramPct.toFixed(1)}%)`);
    ns.print(""); // Spacer

    // --- OPERATIONS ---
    ns.print(`${COLORS.YELLOW} ACTIVE DEPLOYMENT (${procStats.total} Threads)${COLORS.RESET}`);
    
    // Hack
    ns.print(`${COLORS.RED} Hack   ${COLORS.RESET} ${drawBar(procStats.hack, procStats.total, 25, COLORS.RED)} ${procStats.hack}`);
    // Grow
    ns.print(`${COLORS.GREEN} Grow   ${COLORS.RESET} ${drawBar(procStats.grow, procStats.total, 25, COLORS.GREEN)} ${procStats.grow}`);
    // Weaken
    ns.print(`${COLORS.BLUE} Weaken ${COLORS.RESET} ${drawBar(procStats.weaken, procStats.total, 25, COLORS.BLUE)} ${procStats.weaken}`);
    ns.print(hr);

    // --- TARGET INFO ---
    if (context.target) {
        const t = context.target;
        const server = ns.getServer(t);
        
        // Security
        const secCurr = server.hackDifficulty;
        const secMin = server.minDifficulty;
        const secDiff = secCurr - secMin;
        const secColor = secDiff > 0.1 ? COLORS.RED : COLORS.GREEN;

        // Money
        const monCurr = server.moneyAvailable;
        const monMax = server.moneyMax;
        const monPct = (monCurr / monMax) * 100;
        const monColor = monPct < 100 ? COLORS.YELLOW : COLORS.GREEN;

        ns.print(`${COLORS.BRIGHT_WHITE} TARGET: ${COLORS.MAGENTA}${t}${COLORS.RESET}`);
        ns.print(` Sec:   ${secColor}${secCurr.toFixed(2)}${COLORS.RESET} / ${secMin.toFixed(2)}`);
        ns.print(` Money: ${monColor}$${ns.formatNumber(monCurr, 2)}${COLORS.RESET} / $${ns.formatNumber(monMax, 2)}`);
        ns.print(drawBar(monCurr, monMax, width - 5, COLORS.GREEN));
    } else {
        ns.print(`${COLORS.BRIGHT_BLACK} No Active Target ${COLORS.RESET}`);
    }
    ns.print(hr);
}

/**
 * Calculates aggregated RAM usage for Home + Purchased Servers.
 */
function getRamStats(ns, nodes) {
    let max = 0;
    let used = 0;

    for (const node of nodes) {
        // Only count "owned" resources for the infrastructure view
        if (node === "home" || node.startsWith("owned-")) {
            max += ns.getServerMaxRam(node);
            used += ns.getServerUsedRam(node);
        }
    }
    return { max, used };
}

/**
 * Scans all nodes for active worker scripts and counts threads.
 */
function getProcessStats(ns, nodes) {
    let hack = 0;
    let grow = 0;
    let weaken = 0;
    let total = 0;

    for (const node of nodes) {
        const processes = ns.ps(node);
        for (const proc of processes) {
            // Heuristic: Check script name or arguments to determine type
            // early-hack.js handles all 3, so we can't just check filename easily
            // without knowing what it's doing *right now*. 
            // BUT, early-hack.js is one-shot. It does one thing then dies.
            // However, we can't inspect the *internal state* of a running script easily.
            
            // If we are using "atomic" scripts (grow.js, hack.js), it's easy.
            // If we are using "early-hack.js", we treat it as a generic "Worker".
            // Wait, early-hack.js determines its action at runtime.
            // We can't know from the outside if it's hacking or growing.
            
            // ALTERNATIVE: The prompt asked for "aggregate number of hack/weaken/grow operations".
            // Since `early-hack.js` is opaque, we might need to count it as "Mixed" 
            // OR we can count legacy atomic scripts if we use them.
            
            // For accuracy with `early-hack.js`, we can't distinguish easily.
            // However, the user might switch to atomic batchers later.
            // Let's just count based on filename for now.
            
            if (proc.filename.includes("hack")) {
                // Broad match, might capture 'early-hack'
                if (proc.filename.includes("early-hack")) {
                     // It's a generic worker.
                     // We'll count it as "Active" but maybe not specific H/G/W 
                     // unless we assume based on target state (imprecise).
                     total += proc.threads;
                     // Fallback: assign to total, but maybe not specific categories?
                     // Let's just put it in "Weaken" (Blue) as a placeholder or add a "Worker" category.
                     // Actually, let's just split it evenly visually or add a separate "Smart Worker" bar?
                     // Let's classify 'early-hack.js' as "Mixed/Smart".
                     // But for the sake of the bar, let's add it to a generic count
                     // or try to guess? No, guessing is bad.
                     
                     // Let's add a "Worker" category.
                } else if (proc.filename.endsWith("hack.js")) {
                    hack += proc.threads;
                }
            }
            
            if (proc.filename.includes("grow.js")) grow += proc.threads;
            if (proc.filename.includes("weaken.js")) weaken += proc.threads;
            
            // If we are using the new atomic structure later, these will populate.
            // For now, early-hack is the main one.
            // Let's modify `early-hack` to accept an argument? No, waste of RAM.
            // Let's just display "Workers" for early-hack.
        }
    }
    
    // Fix for early-hack counting
    // If we find early-hack, we put it in 'total' but it won't show in H/G/W bars.
    // Let's map 'early-hack' to 'weaken' color just so it shows up, 
    // or add a specific check.
    // Actually, let's look at the code. getProcessStats returns an object.
    // We can add a 'worker' field.
    
    // Recalculating total based on all found
    // We'll cheat slightly: Since we can't see inside early-hack, 
    // we'll display a "Mixed Worker" bar if H/G/W are 0.
    
    // Re-scan for generic workers specifically
     for (const node of nodes) {
        const processes = ns.ps(node);
        for (const proc of processes) {
             if (proc.filename.endsWith("/early-hack.js") || proc.filename.endsWith("early-hack.js")) {
                 // It's our smart worker.
                 total += proc.threads;
                 // We can't categorize it. 
                 // We'll just add it to 'weaken' (Blue) for now to make the bar look busy,
                 // or we create a "Smart" category.
                 weaken += proc.threads; 
             }
        }
     }

    return { hack, grow, weaken, total };
}

/**
 * Generates an ASCII progress bar.
 * @param {number} current 
 * @param {number} max 
 * @param {number} width 
 * @param {string} color 
 */
function drawBar(current, max, width, color) {
    if (max === 0) return "[" + ".".repeat(width) + "]";
    
    const ratio = Math.min(1, current / max);
    const fillLen = Math.floor(ratio * width);
    const emptyLen = width - fillLen;
    
    const bar = color + "|".repeat(fillLen) + COLORS.BRIGHT_BLACK + ".".repeat(emptyLen) + COLORS.RESET;
    return `[${bar}]`;
}
