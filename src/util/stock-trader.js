/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.clearLog();
    
    // Register standard DOM HUD cleanup on script termination
    ns.atExit(() => {
        const win = eval("window");
        if (win.cleanupCustomHudSection) {
            win.cleanupCustomHudSection("stock");
        }
    });

    // Constants for trade logic (Long Only)
    const WINDOW_SIZE = 20;            // Number of historical ticks to estimate forecast (larger = less noise)
    const INVERSION_WINDOW = 6;        // Recent ticks checked for forecast inversion detection
    const BUY_THRESHOLD = 0.65;        // Estimated forecast >= 65% -> Buy Long
    const SELL_THRESHOLD = 0.50;       // Estimated forecast <= 50% -> Sell at neutral (don't wait for bearish)
    const MIN_TRADE_VALUE = 5000000;   // Don't trade if position value is < $5M (avoids fee cannibalization)
    const COMMISSION = 100000;         // Flat fee per transaction ($100k)

    // Verification of API requirements
    if (!ns.stock.hasWseAccount() || !ns.stock.hasTixApiAccess()) {
        ns.print("ERROR: You do not have WSE account and/or TIX API access.");
        ns.print("Please purchase these from the Stock Market before running this script.");
        ns.tprint("ERROR: Stock trader requires WSE Account and TIX API Access.");
        return;
    }

    const symbols = ns.stock.getSymbols();
    
    // Internal state variables
    const lastPrices = new Map();
    const history = new Map(); // symbol -> array of price directions [1 (up), 0 (down)]
    let tickCount = 0;
    let totalRealizedPL = 0;   // Strictly tracks stock trader's closed transaction profits

    // Initialize prices and history maps with a neutral prior (alternating 1s and 0s)
    // to prevent early-tick 10/10 or 0/10 spikes and start all stocks at exactly 50% (5/10)
    for (const sym of symbols) {
        lastPrices.set(sym, ns.stock.getPrice(sym));
        
        const baseline = [];
        for (let i = 0; i < WINDOW_SIZE; i++) {
            baseline.push(i % 2); // alternating [0, 1, 0, 1] for exactly 50% forecast
        }
        history.set(sym, baseline);
    }

    ns.print("Initializing price tracking... Waiting for market ticks.");

    while (true) {
        // Poll every 200ms to detect the exact moment a global market tick occurs
        await ns.sleep(200);

        let marketTicked = false;
        const currentPrices = new Map();

        // Query prices to check if any have changed (indicating a market update tick)
        for (const sym of symbols) {
            const price = ns.stock.getPrice(sym);
            currentPrices.set(sym, price);
            if (price !== lastPrices.get(sym)) {
                marketTicked = true;
            }
        }

        if (!marketTicked) {
            continue;
        }

        // --- MARKET UPDATE DETECTED ---
        tickCount++;

        // Update movement history for all stocks
        for (const sym of symbols) {
            const newPrice = currentPrices.get(sym);
            const oldPrice = lastPrices.get(sym);
            const h = history.get(sym);

            // Record movement direction (1 for up, 0 for down)
            if (newPrice > oldPrice) {
                h.push(1);
            } else if (newPrice < oldPrice) {
                h.push(0);
            } else {
                // If price remained exactly unchanged, maintain the previous direction if exists, else up
                h.push(h.length > 0 ? h[h.length - 1] : 1);
            }

            // Bound history length to sliding window size
            if (h.length > WINDOW_SIZE) {
                h.shift();
            }

            // Inversion Detection: If recent ticks strongly contradict the overall trend,
            // the stock's hidden forecast likely flipped. Reset history to prevent stale
            // data from delaying sell signals or generating false buy signals.
            if (h.length >= WINDOW_SIZE) {
                const recentSlice = h.slice(-INVERSION_WINDOW);
                const recentForecast = recentSlice.reduce((a, b) => a + b, 0) / INVERSION_WINDOW;
                const overallForecast = estimateForecast(h);

                // Trigger: recent and overall are on opposite sides of 50% with meaningful gap
                const crossed = (recentForecast > 0.5) !== (overallForecast > 0.5);
                const divergence = Math.abs(overallForecast - recentForecast);
                if (crossed && divergence >= 0.35) {
                    history.set(sym, [...recentSlice]);
                }
            }

            lastPrices.set(sym, newPrice);
        }

        // Calculate current total portfolio value (cash + stocks)
        const portfolioVal = calculateTotalPortfolioValue(ns, symbols);
        
        // Update dynamic reserve (keep 20% liquid of our total net worth)
        const cashReserve = portfolioVal * 0.20;

        // Calculate and execute trades, accumulating realized profits
        const tickRealizedPL = executeTradingStrategy(ns, symbols, history, currentPrices, cashReserve, MIN_TRADE_VALUE, COMMISSION, BUY_THRESHOLD, SELL_THRESHOLD);
        totalRealizedPL += tickRealizedPL;

        // Calculate current unrealized (open) profit/loss of active positions
        let openPL = 0;
        for (const sym of symbols) {
            const [sharesLong, avgPriceLong] = ns.stock.getPosition(sym);
            if (sharesLong > 0) {
                openPL += sharesLong * (ns.stock.getBidPrice(sym) - avgPriceLong);
            }
        }
        const totalPL = totalRealizedPL + openPL;

        // Update dashboard UI
        updateDashboard(ns, symbols, history, currentPrices, tickCount, cashReserve, portfolioVal, totalPL, WINDOW_SIZE);
    }
}

/**
 * Core trading logic execution on each market tick.
 * Returns the net profit/loss realized from any sales made on this tick.
 */
function executeTradingStrategy(ns, symbols, history, currentPrices, cashReserve, minTradeValue, commission, buyThreshold, sellThreshold) {
    let tickRealizedPL = 0;

    // 1. Identify which positions we currently hold, and if we should close them.
    for (const sym of symbols) {
        const [sharesLong, avgPriceLong] = ns.stock.getPosition(sym);
        const forecast = estimateForecast(history.get(sym));

        // Skip evaluation if we don't have enough history to make a confident estimate
        if (history.get(sym).length < 10) {
            continue;
        }

        // Manage existing Long positions
        if (sharesLong > 0) {
            if (forecast <= sellThreshold) {
                // Trend is weakening, liquidate Long position
                const avgPrice = avgPriceLong;
                const sellPrice = ns.stock.sellStock(sym, sharesLong);
                
                if (sellPrice > 0) {
                    // Net profit = shares * (sale_price - buy_price) - transaction fees (buy fee + sell fee = 2 * commission)
                    const tradePL = sharesLong * (sellPrice - avgPrice) - 2 * commission;
                    tickRealizedPL += tradePL;
                    ns.print(`[SELL] Closed Long on ${sym}: ${sharesLong.toLocaleString()} shares. Forecast dropped to ${(forecast * 100).toFixed(0)}%. P/L: ${formatPL(tradePL)}`);
                }
            }
        }
    }

    // 2. Identify new entry opportunities with remaining cash
    if (ns.getServerMoneyAvailable("home") - cashReserve < minTradeValue) {
        return tickRealizedPL; // Insufficient cash to make any meaningful trade
    }

    // Rank all stocks with sufficient history by forecast strength
    const candidates = symbols
        .map(sym => {
            const forecast = estimateForecast(history.get(sym));
            return { sym, forecast, hLength: history.get(sym).length };
        })
        .filter(c => c.hLength >= 10)     // Require enough history for a confident estimate
        .filter(c => c.forecast >= buyThreshold)
        .sort((a, b) => b.forecast - a.forecast);

    // Execute Long Entries: buy ALL candidates above threshold (portfolio diversification)
    for (const candidate of candidates) {
        const [sharesLong] = ns.stock.getPosition(candidate.sym);
        if (sharesLong > 0) continue; // Already holding this stock

        const availableCash = ns.getServerMoneyAvailable("home") - cashReserve;
        if (availableCash < minTradeValue) break; // No more investable cash

        const price = ns.stock.getAskPrice(candidate.sym);
        const maxShares = ns.stock.getMaxShares(candidate.sym);

        // Calculate how many shares we can afford with our available cash
        // accounting for the $100k commission fee
        const affordableShares = Math.floor((availableCash - commission) / price);
        const purchaseShares = Math.min(affordableShares, maxShares);
        const tradeValue = purchaseShares * price;

        if (purchaseShares > 0 && tradeValue >= minTradeValue) {
            ns.stock.buyStock(candidate.sym, purchaseShares);
            ns.print(`[BUY] Opened Long on ${candidate.sym}: ${purchaseShares.toLocaleString()} shares @ $${price.toFixed(2)} (Value: $${(tradeValue / 1e6).toFixed(1)}M). Forecast: ${(candidate.forecast * 100).toFixed(0)}%.`);
        }
    }

    return tickRealizedPL;
}

/**
 * Estimate forecast probability (0 to 1) based on historical tick movements.
 */
function estimateForecast(historyArray) {
    if (!historyArray || historyArray.length === 0) {
        return 0.5; // Neutral default
    }
    const sum = historyArray.reduce((acc, val) => acc + val, 0);
    return sum / historyArray.length;
}

/**
 * Calculate total value of stocks + cash
 */
function calculateTotalPortfolioValue(ns, symbols) {
    let stockValue = 0;
    for (const sym of symbols) {
        const [sharesLong] = ns.stock.getPosition(sym);
        if (sharesLong > 0) {
            stockValue += sharesLong * ns.stock.getBidPrice(sym);
        }
    }
    return ns.getServerMoneyAvailable("home") + stockValue;
}

/**
 * Generate a beautifully formatted tail dashboard.
 */
function updateDashboard(ns, symbols, history, currentPrices, tickCount, cashReserve, portfolioVal, totalPL, windowSize) {
    ns.clearLog();

    const cash = ns.getServerMoneyAvailable("home");
    const plPercent = portfolioVal > 0 ? (totalPL / portfolioVal) * 100 : 0;

    // Header styling
    ns.print("╔══════════════════════════════════════════════════════════════════════╗");
    ns.print("║                    PRIMITIVE STOCK TRADER (TIX)                      ║");
    ns.print("╚═════════════════════════════════════════════════════════════════════╝");
    ns.print(` Ticks Active: ${tickCount.toString().padStart(6)}   | Window Size: ${windowSize} ticks`);
    ns.print(` Liquid Cash:  ${formatMoney(cash).padEnd(12)} | Reserve (20%): ${formatMoney(cashReserve).padEnd(12)}`);
    ns.print(` Portfolio:    ${formatMoney(portfolioVal).padEnd(12)} | Trader P/L:   ${formatPL(totalPL).padEnd(12)} (${totalPL >= 0 ? "+" : ""}${plPercent.toFixed(2)}%)`);
    ns.print("╟──────────────────────────────────────────────────────────────────────╢");
    ns.print(" Symbol   Price      Forecast Trend   Position  Avg Price  P/L         ");
    ns.print("╟──────────────────────────────────────────────────────────────────────╢");

    // Gather and sort active/promising stocks
    const stockRows = symbols.map(sym => {
        const price = currentPrices.get(sym);
        const h = history.get(sym);
        const forecast = estimateForecast(h);
        const [sharesLong, avgPriceLong] = ns.stock.getPosition(sym);

        let posText = "None";
        let avgText = "-";
        let plText = "-";
        let orderType = "HOLD";

        if (sharesLong > 0) {
            posText = `Long ${(sharesLong/1e3).toFixed(0)}k`;
            avgText = formatMoney(avgPriceLong);
            const pl = sharesLong * (ns.stock.getBidPrice(sym) - avgPriceLong);
            plText = formatPL(pl);
            orderType = "LONG";
        }

        // Draw visual progress bar for forecast
        const barLength = 10;
        const filled = Math.round(forecast * barLength);
        const bar = "█".repeat(filled) + "░".repeat(barLength - filled);

        return {
            sym,
            price,
            forecast,
            bar,
            posText,
            avgText,
            plText,
            hLength: h.length,
            orderType
        };
    });

    // Sort: Held positions first, then highest forecast (for longs)
    stockRows.sort((a, b) => {
        if (a.orderType !== "HOLD" && b.orderType === "HOLD") return -1;
        if (a.orderType === "HOLD" && b.orderType !== "HOLD") return 1;
        return b.forecast - a.forecast;
    });

    // Output top 12 most relevant rows
    for (const row of stockRows.slice(0, 12)) {
        const symStr = row.sym.padEnd(8);
        const priceStr = formatMoney(row.price).padEnd(10);
        const forecastStr = `${row.bar} ${(row.forecast * 100).toFixed(0)}%`.padEnd(17);
        const posStr = row.posText.padEnd(10);
        const avgStr = row.avgText.padEnd(11);
        const plStr = row.plText;

        ns.print(` ${symStr} ${priceStr} ${forecastStr} ${posStr} ${avgStr} ${plStr}`);
    }
    ns.print("╚══════════════════════════════════════════════════════════════════════╝");

    // Construct and update holdings stats on horizontal Top Bar HUD
    const holdings = [];
    for (const sym of symbols) {
        const [sharesLong, avgPriceLong] = ns.stock.getPosition(sym);
        if (sharesLong > 0) {
            const pl = sharesLong * (ns.stock.getBidPrice(sym) - avgPriceLong);
            holdings.push({ sym, pl });
        }
    }
    
    // Store globally in window state using eval to bypass 25GB static RAM charge
    eval("window").customHudStock = {
        portfolioVal: portfolioVal,
        cash: cash,
        totalPL: totalPL,
        tickCount: tickCount,
        cashReserve: cashReserve,
        holdings: holdings,
        allStocks: stockRows // Includes pre-sorted, calculated price, forecast, posText, avgText, plText
    };

    // Render the unified horizontal HUD using dynamic global hook to save RAM
    const win = eval("window");
    if (win.renderCustomHud) {
        win.renderCustomHud();
    }
}

/**
 * Highly readable money formatting (rounding decimals, auto-scaling metric suffixes k->M->B->T->q...)
 */
function formatMoney(val) {
    const sign = val < 0 ? "-" : "";
    const absVal = Math.abs(val);
    
    if (absVal < 999.5) {
        return sign + "$" + Math.round(absVal).toString();
    }
    
    const SUFFIXES = ["", "k", "M", "B", "T", "q", "Q", "s", "S", "O", "N", "D"];
    let exp = Math.floor(Math.log10(absVal) / 3);
    
    // Cap the exponent to the maximum available suffix
    if (exp >= SUFFIXES.length) {
        exp = SUFFIXES.length - 1;
    }
    
    let divisor = Math.pow(10, exp * 3);
    let roundedNum = Math.round(absVal / divisor);
    
    // Handle edge case where rounding pushes the number into the next suffix tier
    // (e.g. 999,500 becomes 1000k, which should be bumped to 1M!)
    if (roundedNum >= 1000 && exp < SUFFIXES.length - 1) {
        exp++;
        divisor = Math.pow(10, exp * 3);
        roundedNum = Math.round(absVal / divisor);
    }
    
    return sign + "$" + roundedNum.toString() + SUFFIXES[exp];
}

/**
 * Formats Profit/Loss values with explicit '+' sign for positive figures
 */
function formatPL(val) {
    if (val === 0) return "$0";
    const formatted = formatMoney(val);
    return val > 0 ? "+" + formatted : formatted;
}
