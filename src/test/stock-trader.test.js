/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.tprint("Running Stock Trader Algorithm Tests...");

    let passes = 0;
    let failures = 0;

    function assert(condition, message) {
        if (condition) {
            ns.tprint(`PASS: ${message}`);
            passes++;
        } else {
            ns.tprint(`FAIL: ${message}`);
            failures++;
        }
    }

    // 1. EWMA update helper
    function updateEwma(prev, tick, alpha = 0.1) {
        return prev * (1 - alpha) + tick * alpha;
    }

    // Test EWMA convergence: Bullish case (alpha = 0.10)
    const bullHistory = [1, 1, 1, 0, 1, 1, 1, 0, 1, 1];
    let ewmaBull = 0.50;
    for (const tick of bullHistory) {
        ewmaBull = updateEwma(ewmaBull, tick);
    }
    assert(Math.abs(ewmaBull - 0.69152) < 0.001, `Bullish EWMA converges to ~0.692 (got ${ewmaBull.toFixed(4)})`);

    // Test EWMA convergence: Bearish case (alpha = 0.10)
    const bearHistory = [0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
    let ewmaBear = 0.50;
    for (const tick of bearHistory) {
        ewmaBear = updateEwma(ewmaBear, tick);
    }
    assert(Math.abs(ewmaBear - 0.29507) < 0.001, `Bearish EWMA converges to ~0.295 (got ${ewmaBear.toFixed(4)})`);

    // 2. Test Streak Detection Logic
    function checkStreakReset(history, ewma, streakLength = 5) {
        if (history.length >= streakLength) {
            const recent = history.slice(-streakLength);
            const allDown = recent.every(x => x === 0);
            const allUp = recent.every(x => x === 1);
            if (ewma > 0.55 && allDown) return 0.40;
            if (ewma < 0.45 && allUp) return 0.60;
        }
        return ewma;
    }

    assert(checkStreakReset([1, 1, 0, 0, 0, 0, 0], 0.70) === 0.40, "Streak of 5 downs resets EWMA > 0.55 to 0.40");
    assert(checkStreakReset([1, 1, 0, 0, 0, 0, 0], 0.50) === 0.50, "Streak of 5 downs does not reset neutral EWMA (0.50)");
    assert(checkStreakReset([0, 0, 1, 1, 1, 1, 1], 0.30) === 0.60, "Streak of 5 ups resets EWMA < 0.45 to 0.60");
    assert(checkStreakReset([1, 1, 1, 1], 0.30) === 0.30, "Short streak (4 ups) does not trigger reset");

    // 3. Test Market-wide Correlation Logic
    function getReversalRatio(prevEwmas, currentDirs) {
        let reversalCount = 0;
        let activeCount = 0;
        for (const [sym, prevEwma] of Object.entries(prevEwmas)) {
            if (Math.abs(prevEwma - 0.50) >= 0.05) {
                activeCount++;
                const isTrendUp = prevEwma > 0.50;
                const isTickUp = currentDirs[sym] === 1;
                if (isTrendUp !== isTickUp) {
                    reversalCount++;
                }
            }
        }
        return activeCount > 0 ? reversalCount / activeCount : 0;
    }

    const prevEwmas = { A: 0.70, B: 0.80, C: 0.30, D: 0.20, E: 0.50 }; // E is neutral
    const currentDirs = { A: 0, B: 0, C: 1, D: 1, E: 1 }; // All active stocks reversed
    const ratio = getReversalRatio(prevEwmas, currentDirs);
    assert(ratio === 1.0, `Market-wide correlation detects 100% reversal on active stocks (got ${ratio})`);

    const currentDirsNoFlip = { A: 1, B: 1, C: 0, D: 1, E: 1 }; // Only D reversed
    const ratioNoFlip = getReversalRatio(prevEwmas, currentDirsNoFlip);
    assert(ratioNoFlip === 0.25, `Market-wide correlation detects 25% reversal under normal conditions (got ${ratioNoFlip})`);

    ns.tprint(`\nStock Trader Algorithm Tests Complete: ${passes} Passed, ${failures} Failed.`);
}
