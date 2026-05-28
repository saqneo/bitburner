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

    // 1. Test forecast estimation logic
    function estimateForecast(historyArray) {
        if (!historyArray || historyArray.length === 0) {
            return 0.5;
        }
        const sum = historyArray.reduce((acc, val) => acc + val, 0);
        return sum / historyArray.length;
    }

    // Bullish case
    const bullHistory = [1, 1, 1, 0, 1, 1, 1, 0, 1, 1]; // 8 ups, 2 downs = 80%
    assert(Math.abs(estimateForecast(bullHistory) - 0.8) < 0.001, "Bullish forecast estimation is 0.8 (80%)");

    // Bearish case
    const bearHistory = [0, 0, 1, 0, 0, 0, 1, 0, 0, 0]; // 2 ups, 8 downs = 20%
    assert(Math.abs(estimateForecast(bearHistory) - 0.2) < 0.001, "Bearish forecast estimation is 0.2 (20%)");

    // Neutral case
    const neutralHistory = [1, 0, 1, 0, 1, 0, 1, 0, 1, 0]; // 5 ups, 5 downs = 50%
    assert(Math.abs(estimateForecast(neutralHistory) - 0.5) < 0.001, "Neutral forecast estimation is 0.5 (50%)");

    // Empty case
    const emptyHistory = [];
    assert(estimateForecast(emptyHistory) === 0.5, "Empty history returns default neutral 0.5");

    ns.tprint(`\nStock Trader Algorithm Tests Complete: ${passes} Passed, ${failures} Failed.`);
}
