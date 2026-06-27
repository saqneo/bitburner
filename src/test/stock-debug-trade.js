/** @param {NS} ns */
export async function main(ns) {
    ns.tprint("=== STOCK TRADING DRY-RUN DIAGNOSTICS ===");

    const symbols = ns.stock.getSymbols();
    const cash = ns.getServerMoneyAvailable("home");
    
    // Calculate values matching our trader logic
    let stockValue = 0;
    for (const sym of symbols) {
        const [sharesLong] = ns.stock.getPosition(sym);
        if (sharesLong > 0) {
            stockValue += sharesLong * ns.stock.getBidPrice(sym);
        }
    }
    const portfolioVal = cash + stockValue;
    const cashReserve = portfolioVal * 0.20;
    const availableCash = cash - cashReserve;
    const minTradeValue = 5000000;
    const commission = 100000;
    const buyThreshold = 0.60;

    ns.tprint(`[FINANCE] Total Cash:       $${cash.toLocaleString()}`);
    ns.tprint(`[FINANCE] Portfolio Value:  $${portfolioVal.toLocaleString()}`);
    ns.tprint(`[FINANCE] Cash Reserve:     $${cashReserve.toLocaleString()}`);
    ns.tprint(`[FINANCE] Available Cash:   $${availableCash.toLocaleString()}`);
    ns.tprint(`[FINANCE] Min Trade Value:  $${minTradeValue.toLocaleString()}`);

    if (availableCash < minTradeValue) {
        ns.tprint("[FAIL] Available cash is LESS than minimum trade value! Cannot trade.");
        return;
    } else {
        ns.tprint("[PASS] Cash check passed.");
    }

    // Rank candidates
    ns.tprint("\n=== CANDIDATE EVALUATION ===");
    const candidates = [];
    for (const sym of symbols) {
        const forecast = ns.stock.getForecast(sym);
        const [sharesLong] = ns.stock.getPosition(sym);
        const price = ns.stock.getAskPrice(sym);
        const maxShares = ns.stock.getMaxShares(sym);

        candidates.push({ sym, forecast, sharesLong, price, maxShares });
    }

    // Sort by forecast descending
    candidates.sort((a, b) => b.forecast - a.forecast);

    let eligibleCount = 0;
    for (const c of candidates) {
        const isEligible = c.forecast >= buyThreshold;
        const alreadyHeld = c.sharesLong > 0;
        
        ns.tprint(`Symbol: ${c.sym.padEnd(6)} | Forecast: ${(c.forecast*100).toFixed(1)}% | Held: ${c.sharesLong} | Price: $${c.price.toFixed(2)}`);
        
        if (isEligible) {
            eligibleCount++;
            ns.tprint(`Candidate: ${c.sym} | Forecast: ${(c.forecast*100).toFixed(1)}% | Eligible: YES | Already Held: ${alreadyHeld ? "YES" : "NO"}`);
            
            if (!alreadyHeld) {
                const affordableShares = Math.floor((availableCash - commission) / c.price);
                const purchaseShares = Math.min(affordableShares, c.maxShares);
                const tradeValue = purchaseShares * c.price;

                ns.tprint(`  -> Affordable: ${affordableShares.toLocaleString()} shares`);
                ns.tprint(`  -> Max Shares:  ${c.maxShares.toLocaleString()} shares`);
                ns.tprint(`  -> Target Buy:  ${purchaseShares.toLocaleString()} shares`);
                ns.tprint(`  -> Trade Value: $${tradeValue.toLocaleString()}`);
                ns.tprint(`  -> Will Buy?   ${purchaseShares > 0 && tradeValue >= minTradeValue ? "YES" : "NO"}`);
            }
        }
    }

    if (eligibleCount === 0) {
        ns.tprint("[INFO] No stocks currently meet the buy threshold (>= 60.0% forecast).");
    }
}
