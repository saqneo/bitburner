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
    const WINDOW_SIZE = 20;            // Number of historical ticks to display on dashboard
    const EWMA_ALPHA = 0.10;           // EWMA decay factor (alpha). Lower = smoother/slower, higher = faster/noisier.
    const BUY_THRESHOLD = 0.60;        // EWMA forecast >= 60% -> Buy Long
    const SELL_THRESHOLD = 0.50;       // EWMA forecast <= 50% -> Sell Long (exit at neutral/bearish)
    const MIN_HISTORY = 8;             // Minimum ticks before we can buy a stock
    const MIN_TRADE_VALUE = 5000000;   // Don't trade if position value is < $5M (avoids fee cannibalization)
    const COMMISSION = 100000;         // Flat fee per transaction ($100k)
    const FLIP_CORRELATION_THRESHOLD = 0.60; // Ratio of reversing stocks to trigger market-wide flip
    const STREAK_LENGTH = 5;           // Consecutive counter-trend ticks for per-stock flip detection

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
    const history = new Map();         // symbol -> array of raw price directions [1 (up), 0 (down)]
    const ewmas = new Map();           // symbol -> EWMA forecast probability [0.0 - 1.0]
    let tickCount = 0;
    let totalRealizedPL = 0;           // Strictly tracks stock trader's closed transaction profits

    // Initialize prices, history, and EWMA maps
    for (const sym of symbols) {
        lastPrices.set(sym, ns.stock.getPrice(sym));
        history.set(sym, []);          // Start with clean slate (no neutral prior seeding)
        ewmas.set(sym, 0.50);          // Neutral start
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

        const has4S = ns.stock.has4SDataTixApi();

        // 1. Gather movement directions (always do this so raw history displays correctly on visual bar)
        const currentDirs = new Map();
        for (const sym of symbols) {
            const newPrice = currentPrices.get(sym);
            const oldPrice = lastPrices.get(sym);
            let dir;
            if (newPrice > oldPrice) {
                dir = 1;
            } else if (newPrice < oldPrice) {
                dir = 0;
            } else {
                const h = history.get(sym);
                dir = h.length > 0 ? h[h.length - 1] : 1;
            }
            currentDirs.set(sym, dir);

            const h = history.get(sym);
            h.push(dir);
            if (h.length > WINDOW_SIZE) {
                h.shift();
            }
        }

        let marketFlipDetected = false;
        let flipRealizedPL = 0;

        if (has4S) {
            // --- 4S MODE ---
            // Read forecast directly from the game's 100% accurate API
            for (const sym of symbols) {
                ewmas.set(sym, ns.stock.getForecast(sym));
            }
        } else {
            // --- PRE-4S ESTIMATOR MODE ---
            // Check for market-wide reversals
            let reversalCount = 0;
            let activeStocksCount = 0;

            for (const sym of symbols) {
                const dir = currentDirs.get(sym);
                const prevEwma = ewmas.get(sym);
                // Only count stocks with a strong, established trend (>= 58% or <= 42%)
                if (Math.abs(prevEwma - 0.50) >= 0.08) {
                    activeStocksCount++;
                    const isTrendUp = prevEwma > 0.50;
                    const isTickUp = dir === 1;
                    if (isTrendUp !== isTickUp) {
                        reversalCount++;
                    }
                }
            }

            const reversalRatio = activeStocksCount > 0 ? reversalCount / activeStocksCount : 0;
            // Require at least 6 active trending stocks to make a confident market-wide assessment
            if (activeStocksCount >= 6 && reversalRatio >= FLIP_CORRELATION_THRESHOLD) {
                marketFlipDetected = true;
                ns.print(`!!! MARKET WIDE FLIP DETECTED !!! (${(reversalRatio * 100).toFixed(0)}% of ${activeStocksCount} active stocks reversed direction)`);
            }

            if (marketFlipDetected) {
                // Immediate liquidation
                for (const sym of symbols) {
                    const [sharesLong, avgPriceLong] = ns.stock.getPosition(sym);
                    if (sharesLong > 0) {
                        const sellPrice = ns.stock.sellStock(sym, sharesLong);
                        if (sellPrice > 0) {
                            const tradePL = sharesLong * (sellPrice - avgPriceLong) - 2 * COMMISSION;
                            flipRealizedPL += tradePL;
                            ns.print(`[FLIP SELL] Liquidated ${sym}: ${sharesLong.toLocaleString()} shares. P/L: ${formatPL(tradePL)}`);
                        }
                    }
                    ewmas.set(sym, 0.50);
                    history.get(sym).length = 0; // Clear history
                }
            } else {
                // Normal update: Update history, EWMA, and check per-stock streaks
                for (const sym of symbols) {
                    const dir = currentDirs.get(sym);
                    const h = history.get(sym);
                    
                    const prevEwma = ewmas.get(sym);
                    let newEwma = prevEwma * (1 - EWMA_ALPHA) + dir * EWMA_ALPHA;

                    // Per-stock streak detection (individual flip reset)
                    if (h.length >= STREAK_LENGTH) {
                        const recentStreak = h.slice(-STREAK_LENGTH);
                        const allDown = recentStreak.every(x => x === 0);
                        const allUp = recentStreak.every(x => x === 1);

                        if (newEwma > 0.55 && allDown) {
                            newEwma = 0.40; // Force bearish EWMA to trigger sell
                            h.length = 0;   // Reset history
                        } else if (newEwma < 0.45 && allUp) {
                            newEwma = 0.60; // Force bullish EWMA
                            h.length = 0;   // Reset history
                        }
                    }

                    ewmas.set(sym, newEwma);
                }
            }
        }

        // Always update lastPrices at the end of the tick
        for (const sym of symbols) {
            lastPrices.set(sym, currentPrices.get(sym));
        }

        // Calculate current total portfolio value (cash + stocks)
        const portfolioVal = calculateTotalPortfolioValue(ns, symbols);
        
        // Update dynamic reserve (keep 20% liquid of our total net worth)
        const cashReserve = portfolioVal * 0.20;

        // Calculate and execute trades, accumulating realized profits
        const minHistoryReq = has4S ? 0 : MIN_HISTORY;
        const skipBuyingThisTick = has4S ? false : marketFlipDetected;

        const tickRealizedPL = executeTradingStrategy(ns, symbols, ewmas, history, cashReserve, MIN_TRADE_VALUE, COMMISSION, BUY_THRESHOLD, SELL_THRESHOLD, minHistoryReq, skipBuyingThisTick);
        totalRealizedPL += flipRealizedPL + tickRealizedPL;

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
        updateDashboard(ns, symbols, ewmas, history, currentPrices, tickCount, cashReserve, portfolioVal, totalPL, WINDOW_SIZE);
    }
}

/**
 * Core trading logic execution on each market tick.
 * Returns the net profit/loss realized from any sales made on this tick.
 */
function executeTradingStrategy(ns, symbols, ewmas, history, cashReserve, minTradeValue, commission, buyThreshold, sellThreshold, minHistory, skipBuying) {
    let tickRealizedPL = 0;

    // 1. Identify which positions we currently hold, and if we should close them.
    for (const sym of symbols) {
        const [sharesLong, avgPriceLong] = ns.stock.getPosition(sym);
        const ewma = ewmas.get(sym);

        // Manage existing Long positions
        // Note: We do NOT enforce minHistory when selling. If we hold a position,
        // we evaluate sell signals immediately to exit as quickly as possible.
        if (sharesLong > 0) {
            if (ewma <= sellThreshold) {
                // Trend is weakening, liquidate Long position
                const avgPrice = avgPriceLong;
                const sellPrice = ns.stock.sellStock(sym, sharesLong);
                
                if (sellPrice > 0) {
                    // Net profit = shares * (sale_price - buy_price) - transaction fees (buy fee + sell fee = 2 * commission)
                    const tradePL = sharesLong * (sellPrice - avgPrice) - 2 * commission;
                    tickRealizedPL += tradePL;
                    ns.print(`[SELL] Closed Long on ${sym}: ${sharesLong.toLocaleString()} shares. EWMA: ${(ewma * 100).toFixed(1)}%. P/L: ${formatPL(tradePL)}`);
                }
            }
        }
    }

    // 2. Identify new entry opportunities with remaining cash
    if (skipBuying) {
        return tickRealizedPL;
    }

    if (ns.getServerMoneyAvailable("home") - cashReserve < minTradeValue) {
        return tickRealizedPL; // Insufficient cash to make any meaningful trade
    }

    // Rank all stocks with sufficient history by forecast strength
    const candidates = symbols
        .map(sym => {
            const ewma = ewmas.get(sym);
            const hLength = history.get(sym).length;
            return { sym, ewma, hLength };
        })
        .filter(c => c.hLength >= minHistory)     // Require enough history for a confident estimate
        .filter(c => c.ewma >= buyThreshold)
        .sort((a, b) => b.ewma - a.ewma);

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
            ns.print(`[BUY] Opened Long on ${candidate.sym}: ${purchaseShares.toLocaleString()} shares @ $${price.toFixed(2)} (Value: $${(tradeValue / 1e6).toFixed(1)}M). EWMA: ${(candidate.ewma * 100).toFixed(1)}%.`);
        }
    }

    return tickRealizedPL;
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
function updateDashboard(ns, symbols, ewmas, history, currentPrices, tickCount, cashReserve, portfolioVal, totalPL, windowSize) {
    ns.clearLog();

    const cash = ns.getServerMoneyAvailable("home");
    const plPercent = portfolioVal > 0 ? (totalPL / portfolioVal) * 100 : 0;

    // Header styling
    const has4S = ns.stock.has4SDataTixApi();
    const title = has4S ? "FOUR SIGMA STOCK TRADER (4S)" : "PRIMITIVE STOCK TRADER (EWMA)";
    const titlePadding = Math.floor((68 - title.length) / 2);
    const titleStr = " ".repeat(titlePadding) + title + " ".repeat(68 - title.length - titlePadding);

    ns.print("╔══════════════════════════════════════════════════════════════════════╗");
    ns.print(`║${titleStr}║`);
    ns.print("╚══════════════════════════════════════════════════════════════════════╝");
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
        const forecast = ewmas.get(sym);
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
