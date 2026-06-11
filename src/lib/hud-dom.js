/**
 * Shared DOM library to construct and manage a horizontal Top Bar HUD.
 * Fits beautifully at the top of the viewport between the left Sidebar and right Overview panel.
 * Supports a persistent Collapsible Drawer layout:
 * - Collapsed State (32px): Sleek horizontal summary metrics
 * - Expanded State (132px): Deep 4-column breakdown (Swarm RAM, operation percentages, top targets, stock tables)
 * - Draggable Grab Bar: Sleek grab bar (dots) allowing full screen positioning, persistent across ticks.
 * 
 * NOTE: This library is entirely NS-free to prevent any concurrent/post-termination ns access crashes.
 */

/**
 * Creates or retrieves the unified horizontal top bar element from the DOM.
 * Styled with a premium glassmorphic dark slate appearance and drag-and-drop support.
 */
export function createOrGetTopBar() {
    const doc = eval("document");
    let bar = doc.getElementById("custom-top-hud");
    
    if (bar) {
        if (!doc.getElementById("hud-grab-handle") || !doc.getElementById("hud-content-container") || !doc.getElementById("hud-toggle-btn")) {
            if (bar.parentNode) {
                bar.parentNode.removeChild(bar);
            }
            bar = null;
        } else {
            // Apply live style upgrades directly to the existing bar to ensure updates are visible instantly
            bar.style.fontSize = "12px";
            
            let leftVal = window.customHudLeft;
            let topVal = window.customHudTop;
            
            if (leftVal !== undefined && topVal !== undefined) {
                const lParsed = parseFloat(leftVal);
                const tParsed = parseFloat(topVal);
                if (isNaN(lParsed) || isNaN(tParsed) || lParsed < 0 || tParsed < 0 || lParsed > (doc.documentElement.clientWidth - 100) || tParsed > (doc.documentElement.clientHeight - 30)) {
                    // Coordinates are corrupt or offscreen, force a reset
                    leftVal = undefined;
                    topVal = undefined;
                    window.customHudLeft = undefined;
                    window.customHudTop = undefined;
                }
            }
            
            if (leftVal !== undefined && topVal !== undefined) {
                bar.style.left = leftVal;
                bar.style.top = topVal;
                bar.style.right = "auto";
                bar.style.width = window.customHudWidth || "1380px";
            } else {
                bar.style.left = "250px";
                bar.style.top = "0px";
                bar.style.right = "255px";
                bar.style.width = "auto";
            }
            const isCollapsed = window.customHudCollapsed === true;
            bar.style.height = isCollapsed ? "32px" : "138px";
        }
    }
    
    if (!bar) {
        bar = doc.createElement("div");
        bar.id = "custom-top-hud";
        
        // CSS Style declarations for a premium, highly detailed top HUD
        bar.style.position = "fixed";
        bar.style.background = "rgba(10, 15, 30, 0.90)"; // Sleek deep slate
        bar.style.backdropFilter = "blur(14px) saturate(145%)";
        bar.style.webkitBackdropFilter = "blur(14px) saturate(145%)";
        bar.style.borderBottom = "2px solid rgba(56, 189, 248, 0.22)"; // Soft cyan neon border
        bar.style.boxShadow = "0 8px 32px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.05)";
        bar.style.zIndex = "9999";
        bar.style.fontFamily = "'Lucida Console', 'Courier New', monospace";
        bar.style.fontSize = "12px"; // Increased from 11px
        bar.style.borderRadius = "0 0 10px 10px";
        bar.style.transition = "height 0.22s ease-out";
        bar.style.overflow = "hidden";
        bar.style.display = "flex";
        bar.style.alignItems = "center";
        
        // Apply persisted drag coordinates if they exist and pass validation, otherwise default to responsive anchors
        let leftVal = window.customHudLeft;
        let topVal = window.customHudTop;
        
        if (leftVal !== undefined && topVal !== undefined) {
            const lParsed = parseFloat(leftVal);
            const tParsed = parseFloat(topVal);
            if (isNaN(lParsed) || isNaN(tParsed) || lParsed < 0 || tParsed < 0 || lParsed > (doc.documentElement.clientWidth - 100) || tParsed > (doc.documentElement.clientHeight - 30)) {
                // Coordinates are corrupt or offscreen, force a reset
                leftVal = undefined;
                topVal = undefined;
                window.customHudLeft = undefined;
                window.customHudTop = undefined;
            }
        }
        
        if (leftVal !== undefined && topVal !== undefined) {
            bar.style.left = leftVal;
            bar.style.top = topVal;
            bar.style.right = "auto";
            bar.style.width = window.customHudWidth || "1380px";
        } else {
            bar.style.left = "250px";
            bar.style.top = "0px";
            bar.style.right = "255px";                 // Pushed further right (from 290px) to align with default overview and provide more space
        }
        
        // Check for saved collapse state in window to persist across script ticks
        const isCollapsed = window.customHudCollapsed === true;
        if (isCollapsed) {
            bar.style.height = "32px";
            bar.classList.add("collapsed");
        } else {
            bar.style.height = "138px"; // Increased from 132px
        }
        
        // Sleek Draggable Grab Bar Icon Element (attached directly to parent so it is never overwritten)
        const grabHandle = doc.createElement("div");
        grabHandle.id = "hud-grab-handle";
        grabHandle.style.cursor = "move";
        grabHandle.style.width = "18px";
        grabHandle.style.height = "100%";
        grabHandle.style.display = "flex";
        grabHandle.style.alignItems = "center";
        grabHandle.style.justifyContent = "center";
        grabHandle.style.color = "#64748b";         // Lighter slate rest state for better visibility (from #475569)
        grabHandle.style.fontSize = "14px";
        grabHandle.style.userSelect = "none";
        grabHandle.style.paddingLeft = "8px";
        grabHandle.style.paddingRight = "4px";
        grabHandle.style.flexShrink = "0";          // CRITICAL: Prevent flexbox from squishing the grab handle to 0 width
        grabHandle.innerText = "⋮⋮";
        
        // Grab Bar hover effect
        grabHandle.addEventListener("mouseover", () => {
            grabHandle.style.color = "#38bdf8";      // Neon cyan highlight
            grabHandle.style.textShadow = "0 0 4px #38bdf8";
        });
        grabHandle.addEventListener("mouseout", () => {
            grabHandle.style.color = "#64748b";
            grabHandle.style.textShadow = "none";
        });
        
        // Mouse Down Drag Handler
        grabHandle.addEventListener("mousedown", (e) => {
            e.preventDefault();
            
            // Snap to exact fixed dimensions before clearing the responsive right-anchor
            const currentRect = bar.getBoundingClientRect();
            bar.style.width = currentRect.width + "px";
            bar.style.right = "auto";
            
            const shiftX = e.clientX - currentRect.left;
            const shiftY = e.clientY - currentRect.top;
            
            function onMouseMove(moveEvent) {
                let newLeft = moveEvent.clientX - shiftX;
                let newTop = moveEvent.clientY - shiftY;
                
                // Safety boundary checks: keep within screen viewport
                newLeft = Math.max(0, Math.min(newLeft, doc.documentElement.clientWidth - currentRect.width));
                newTop = Math.max(0, Math.min(newTop, doc.documentElement.clientHeight - currentRect.height));
                
                bar.style.left = newLeft + "px";
                bar.style.top = newTop + "px";
            }
            
            doc.addEventListener("mousemove", onMouseMove);
            
            doc.addEventListener("mouseup", () => {
                doc.removeEventListener("mousemove", onMouseMove);
                
                // Store coordinates in global window object to persist during live updates
                window.customHudLeft = bar.style.left;
                window.customHudTop = bar.style.top;
                window.customHudWidth = bar.style.width;
            }, { once: true });
        });

        // Dynamic Views Container (content container, sibling to grab handle, gets innerHTML updates)
        const contentDiv = doc.createElement("div");
        contentDiv.id = "hud-content-container";
        contentDiv.style.flexGrow = "1";
        contentDiv.style.height = "100%";
        contentDiv.style.display = "flex";
        contentDiv.style.alignItems = "center";
        
        // Add toggle button floating tab at bottom center
        const toggleBtn = doc.createElement("div");
        toggleBtn.id = "hud-toggle-btn";
        toggleBtn.style.position = "absolute";
        toggleBtn.style.bottom = "0px";
        toggleBtn.style.left = "50%";
        toggleBtn.style.transform = "translateX(-50%)";
        toggleBtn.style.width = "36px";
        toggleBtn.style.height = "10px";
        toggleBtn.style.background = "rgba(10, 15, 30, 0.95)";
        toggleBtn.style.border = "1px solid rgba(56, 189, 248, 0.22)";
        toggleBtn.style.borderTop = "none";
        toggleBtn.style.borderRadius = "0 0 6px 6px";
        toggleBtn.style.color = "#38bdf8";
        toggleBtn.style.fontSize = "7px";
        toggleBtn.style.display = "flex";
        toggleBtn.style.alignItems = "center";
        toggleBtn.style.justifyContent = "center";
        toggleBtn.style.cursor = "pointer";
        toggleBtn.style.zIndex = "10000";
        toggleBtn.innerText = isCollapsed ? "▼" : "▲";
        
        toggleBtn.addEventListener("click", () => {
            const collapsed = bar.classList.toggle("collapsed");
            window.customHudCollapsed = collapsed;
            toggleBtn.innerText = collapsed ? "▼" : "▲";
            bar.style.height = collapsed ? "32px" : "138px";
            
            // Re-render instantly
            renderHud();
        });
        
        bar.appendChild(grabHandle);
        bar.appendChild(contentDiv);
        bar.appendChild(toggleBtn);
        doc.body.appendChild(bar);
    }
    
    return bar;
}

/**
 * Formats a number with commas for readability.
 */
function formatNumberHUD(num) {
    return Math.round(num).toLocaleString();
}

/**
 * Formats a RAM value in GB to a readable string (GB, TB, PB).
 */
function formatRAMHUD(gb) {
    if (gb === 0) return "0 GB";
    if (gb < 1024) return gb.toFixed(1) + " GB";
    const suffixes = ["GB", "TB", "PB", "EB"];
    let exp = 0;
    let val = gb;
    while (val >= 1024 && exp < suffixes.length - 1) {
        val /= 1024;
        exp++;
    }
    return val.toFixed(2) + " " + suffixes[exp];
}

/**
 * Formats money values compactly with standard metric suffixes.
 */
function formatMoneyHUD(val) {
    const sign = val < 0 ? "-" : "";
    const absVal = Math.abs(val);
    
    if (absVal < 999.5) {
        return sign + "$" + Math.round(absVal);
    }
    
    const SUFFIXES = ["", "k", "M", "B", "T", "q", "Q"];
    let exp = Math.floor(Math.log10(absVal) / 3);
    
    if (exp >= SUFFIXES.length) {
        exp = SUFFIXES.length - 1;
    }
    
    const divisor = Math.pow(10, exp * 3);
    const roundedNum = Math.round(absVal / divisor);
    
    return sign + "$" + roundedNum + SUFFIXES[exp];
}

/**
 * Renders the horizontal collapsed (mini) bar view.
 */
function renderCollapsedView(container, swarm, stock) {
    let html = "";
    
    // Left: Swarm Mini Stats
    if (swarm) {
        const stageColor = swarm.stage === "MIDGAME" ? "#c084fc" : "#facc15";
        const ramPct = swarm.ramMax > 0 ? (swarm.ramUsed / swarm.ramMax) * 100 : 0;
        const barLength = 6;
        const filled = Math.round((ramPct / 100) * barLength);
        const contractSpan = swarm.contracts > 0 
            ? `<span style="color: #f472b6; font-weight: bold; text-shadow: 0 0 3px #f472b6;">⚡ ${swarm.contracts} CCT</span>`
            : `<span style="color: #64748b;">0 CCT</span>`;
            
        const incRateText = swarm.incomeRate !== undefined 
            ? `<span style="color: #4ade80; font-weight: bold;">${formatMoneyHUD(swarm.incomeRate)}/s</span>`
            : `<span style="color: #64748b;">$0/s</span>`;
        const expRateText = swarm.expRate !== undefined 
            ? `<span style="color: #60a5fa; font-weight: bold;">${swarm.expRate.toFixed(1)} XP/s</span>`
            : `<span style="color: #64748b;">0 XP/s</span>`;

        let singMini = "";
        if (swarm.singStatus) {
            const s = swarm.singStatus;
            const prestigeColor = s.canPrestige ? "#4ade80" : "#cbd5e1";
            const prestigeStyle = s.canPrestige ? "font-weight: bold;" : "";
            const prestigeLabel = s.canPrestige ? "⚡ READY" : s.nextPrestige;
            singMini = `
                <span style="color: #334155;">|</span>
                <span style="color: #a78bfa; font-weight: bold;">SING:</span> <span style="color: #cbd5e1;">${s.currentWork}</span> (<span style="color: ${prestigeColor}; ${prestigeStyle}">${prestigeLabel}</span>)
            `;
        }
            
        html += `
            <div style="display: flex; align-items: center; gap: 7px; height: 100%;">
                <span style="color: ${stageColor}; font-weight: bold;">SWARM::${swarm.stage}</span>
                <span style="color: #334155;">|</span>
                <span style="color: #38bdf8;">RAM:</span>
                <span style="color: #cbd5e1; font-family: monospace;">[<span style="color: #38bdf8;">${"|".repeat(filled)}</span><span style="color: #334155;">${".".repeat(barLength - filled)}</span>] ${ramPct.toFixed(0)}%</span>
                <span style="color: #334155;">|</span>
                <span style="color: #c084fc;">Workers:</span> <span style="color: #e2e8f0; font-weight: bold;">${formatNumberHUD(swarm.threads)}</span>
                <span style="color: #334155;">|</span>
                ${incRateText}
                <span style="color: #334155;">|</span>
                ${expRateText}
                <span style="color: #334155;">|</span>
                ${contractSpan}
                ${singMini}
            </div>
        `;
    } else {
        html += `<div style="color: #64748b; font-style: italic;">Swarm Offline</div>`;
    }
    
    html += `<div style="color: #334155; font-weight: bold;">|</div>`;
    
    // Right: Stock Mini Stats
    if (stock) {
        const plColor = stock.totalPL >= 0 ? "#4ade80" : "#f87171";
        const plSign = stock.totalPL >= 0 ? "+" : "";
        const plPercent = stock.portfolioVal > 0 ? (stock.totalPL / stock.portfolioVal) * 100 : 0;
        
        html += `
            <div style="display: flex; align-items: center; gap: 7px; height: 100%;">
                <span style="color: #34d399; font-weight: bold;">STOCKS</span>
                <span style="color: #334155;">|</span>
                <span style="color: #10b981;">Portfolio:</span> <span style="color: #e2e8f0; font-weight: bold;">${formatMoneyHUD(stock.portfolioVal)}</span>
                <span style="color: #334155;">|</span>
                <span style="color: #10b981;">P/L:</span> <span style="color: ${plColor}; font-weight: bold;">${plSign}${formatMoneyHUD(stock.totalPL)} (${plSign}${plPercent.toFixed(1)}%)</span>
            </div>
        `;
    } else {
        html += `<div style="color: #64748b; font-style: italic;">Stocks Offline</div>`;
    }
    
    container.innerHTML = `
        <div style="width: 100%; height: 32px; display: flex; align-items: center; justify-content: space-between; padding-right: 14px;">
            ${html}
        </div>
    `;
}
 
/**
 * Renders the fully expanded deep dashboard layout.
 */
function renderExpandedView(container, swarm, stock) {
    // --- COLUMN 1: SWARM SUMMARY & PRIMARY TARGET ---
    let col1Html = "";
    if (swarm) {
        const stageColor = swarm.stage === "MIDGAME" ? "#c084fc" : "#facc15";
        const ramPct = swarm.ramMax > 0 ? (swarm.ramUsed / swarm.ramMax) * 100 : 0;
        const ramBarLength = 6;
        const ramFilled = Math.round((ramPct / 100) * ramBarLength);
        
        let targetHtml = `<div style="color: #64748b; font-size: 11px; margin-top: 3px; font-style: italic;">No primary target active.</div>`;
        if (swarm.primaryTarget) {
            const t = swarm.primaryTarget;
            const monPct = t.moneyMax > 0 ? (t.moneyCurr / t.moneyMax) * 100 : 0;
            targetHtml = `
                <div style="margin-top: 2px; border-top: 1px solid rgba(148, 163, 184, 0.12); padding-top: 2px;">
                    <div style="color: #ffd700; font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 10px;">TARGET: ${t.name}</div>
                    <div style="display: flex; justify-content: space-between; margin-top: 1px; font-size: 9px;">
                        <span>Sec:</span>
                        <span style="color: #cbd5e1; font-weight: bold;">${t.secCurr.toFixed(1)} / ${t.secMin.toFixed(1)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 9px;">
                        <span>Money:</span>
                        <span style="color: #4ade80; font-weight: bold;">${formatMoneyHUD(t.moneyCurr)} (${monPct.toFixed(0)}%)</span>
                    </div>
                </div>
            `;
        }

        let singHtml = "";
        if (swarm.singStatus) {
            const s = swarm.singStatus;
            const prestigeColor = s.canPrestige ? "#4ade80" : "#cbd5e1";
            singHtml = `
                <div style="margin-top: 2px; border-top: 1px solid rgba(148, 163, 184, 0.12); padding-top: 2px;">
                    <div style="color: #a78bfa; font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 10px;">SINGULARITY</div>
                    <div style="font-size: 9px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Work: <span style="color: #cbd5e1;">${s.currentWork}</span></div>
                    <div style="font-size: 9px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Status: <span style="color: ${prestigeColor}; font-weight: bold;">${s.nextPrestige}</span></div>
                </div>
            `;
        }
        
        col1Html = `
            <div style="display: flex; flex-direction: column; justify-content: space-between; height: 100%; font-size: 11px;">
                <div>
                    <span style="color: ${stageColor}; font-weight: bold; font-size: 12px; text-shadow: 0 0 4px ${stageColor};">SWARM::${swarm.stage}</span>
                    <div style="color: #cbd5e1; margin-top: 1px; font-size: 10px;"><span style="color: #c084fc;">Work:</span> <strong>${formatNumberHUD(swarm.threads)}</strong> | <span style="color: #f472b6;">CCT:</span> <strong>${swarm.contracts}</strong></div>
                    <div style="color: #cbd5e1; margin-top: 1px; font-size: 10px;"><span style="color: #4ade80;">Inc:</span> <strong>${formatMoneyHUD(swarm.incomeRate || 0)}/s</strong></div>
                    <div style="color: #cbd5e1; margin-top: 1px; font-size: 10px;"><span style="color: #60a5fa;">XP:</span> <strong>${(swarm.expRate || 0).toFixed(1)}/s</strong></div>
                    <div style="color: #38bdf8; margin-top: 2px; font-family: monospace; font-size: 9px;">
                        [<span style="color: #38bdf8;">${"|".repeat(ramFilled)}</span><span style="color: #334155;">${".".repeat(ramBarLength - ramFilled)}</span>] ${ramPct.toFixed(0)}%
                    </div>
                </div>
                ${targetHtml}
                ${singHtml}
            </div>
        `;
    } else {
        col1Html = `<div style="color: #64748b; font-style: italic; font-size: 11px;">Swarm Monitor Offline</div>`;
    }

    // --- COLUMN 2: OPERATIONS RATIOS ---
    let col2Html = "";
    if (swarm) {
        const total = swarm.threads || 1;
        const hackPct = (swarm.hack / total) * 100;
        const growPct = (swarm.grow / total) * 100;
        const weakenPct = (swarm.weaken / total) * 100;
        
        // Calculate cumulative angles for conic-gradient
        const hackEnd = hackPct;
        const growEnd = hackEnd + growPct;
        
        // conic-gradient background string
        const gradientStr = `conic-gradient(
            #f87171 0% ${hackEnd.toFixed(1)}%,
            #4ade80 ${hackEnd.toFixed(1)}% ${growEnd.toFixed(1)}%,
            #60a5fa ${growEnd.toFixed(1)}% 100%
        )`;
        
        // Format thread count compactly (e.g. 1.2k) inside donut hole
        const displayThreads = (swarm.threads >= 1000) 
            ? (swarm.threads / 1000).toFixed(1) + "k" 
            : swarm.threads.toString();
        
        col2Html = `
            <div style="display: flex; flex-direction: column; justify-content: space-between; height: 100%; font-size: 11px;">
                <div style="color: #94a3b8; font-weight: bold; border-bottom: 1px solid rgba(148, 163, 184, 0.12); padding-bottom: 1px;">SWARM OPERATIONS</div>
                <div style="display: flex; align-items: center; justify-content: space-between; flex-grow: 1; margin-top: 4px; gap: 8px;">
                    <!-- Circular Donut Chart -->
                    <div style="position: relative; width: 62px; height: 62px; border-radius: 50%; background: ${gradientStr}; box-shadow: 0 0 8px rgba(0, 0, 0, 0.4), inset 0 0 0 1px rgba(255, 255, 255, 0.08); flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                        <!-- Center cutout for Donut chart appearance -->
                        <div style="width: 32px; height: 32px; border-radius: 50%; background: rgba(10, 15, 30, 0.95); display: flex; align-items: center; justify-content: center; font-size: 9px; color: #94a3b8; font-weight: bold;">
                            ${displayThreads}
                        </div>
                    </div>
                    <!-- Detailed Ratios Legend -->
                    <div style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1; font-size: 10px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(148, 163, 184, 0.04); padding-bottom: 1px;">
                            <span style="color: #f87171; font-weight: bold; display: flex; align-items: center; gap: 4px;">
                                <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #f87171;"></span>HAK
                            </span>
                            <span style="color: #cbd5e1; font-family: monospace;">${hackPct.toFixed(0)}%</span>
                        </div>
                        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(148, 163, 184, 0.04); padding-bottom: 1px;">
                            <span style="color: #4ade80; font-weight: bold; display: flex; align-items: center; gap: 4px;">
                                <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #4ade80;"></span>GRW
                            </span>
                            <span style="color: #cbd5e1; font-family: monospace;">${growPct.toFixed(0)}%</span>
                        </div>
                        <div style="display: flex; align-items: center; justify-content: space-between; padding-bottom: 1px;">
                            <span style="color: #60a5fa; font-weight: bold; display: flex; align-items: center; gap: 4px;">
                                <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #60a5fa;"></span>WEA
                            </span>
                            <span style="color: #cbd5e1; font-family: monospace;">${weakenPct.toFixed(0)}%</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } else {
        col2Html = `<div style="color: #64748b; font-style: italic; font-size: 11px;">No Operations Data</div>`;
    }

    // --- COLUMN 3: SWARM FOCUS ---
    let col3Html = "";
    if (swarm && swarm.topTargets && swarm.topTargets.length > 0) {
        const total = swarm.threads || 1;
        const rows = swarm.topTargets.slice(0, 4).map((t, idx) => {
            const pct = (t.threads / total) * 100;
            return `
                <div style="display: flex; justify-content: space-between; margin-top: 1px; font-size: 10px;">
                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 95px; color: #e2e8f0;">${idx+1}. ${t.name}</span>
                    <span style="color: #cbd5e1; font-weight: bold;">${formatNumberHUD(t.threads)} (${pct.toFixed(0)}%)</span>
                </div>
            `;
        }).join("");
        
        col3Html = `
            <div style="display: flex; flex-direction: column; justify-content: space-between; height: 100%; font-size: 11px;">
                <div style="color: #ffd700; font-weight: bold; border-bottom: 1px solid rgba(148, 163, 184, 0.12); padding-bottom: 1px;">SWARM FOCUS (TOP 4)</div>
                <div style="display: flex; flex-direction: column; gap: 1px; margin-top: 2px;">
                    ${rows}
                </div>
            </div>
        `;
    } else {
        col3Html = `<div style="color: #64748b; font-style: italic; font-size: 11px;">No Swarm Focus Data</div>`;
    }

    // --- COLUMN 4: STOCK TRADING GRID ---
    let col4Html = "";
    if (stock) {
        const plColor = stock.totalPL >= 0 ? "#4ade80" : "#f87171";
        const plSign = stock.totalPL >= 0 ? "+" : "";
        const plPercent = stock.portfolioVal > 0 ? (stock.totalPL / stock.portfolioVal) * 100 : 0;
        
        let tableRows = "";
        if (stock.allStocks && stock.allStocks.length > 0) {
            tableRows = stock.allStocks.slice(0, 4).map(row => {
                const fColor = row.forecast >= 0.65 ? "#4ade80" : (row.forecast <= 0.45 ? "#f87171" : "#cbd5e1");
                const holdingText = row.posText !== "None" ? `<span style="color: #c084fc; font-weight: bold;">${row.posText}</span>` : `<span style="color: #64748b;">-</span>`;
                const rowPlColor = row.plText.startsWith("+") ? "#4ade80" : (row.plText.startsWith("-") ? "#f87171" : "#e2e8f0");
                
                // Construct compact forecast indicator bar
                const barLen = 5;
                const filled = Math.round(row.forecast * barLen);
                const forecastBar = `<span style="color: ${fColor}; font-family: monospace;">${"█".repeat(filled)}${"░".repeat(barLen - filled)}</span>`;

                return `
                    <tr style="border-bottom: 1px solid rgba(148, 163, 184, 0.05); font-size: 10px;">
                        <td style="color: #ffd700; font-weight: bold; text-align: left; padding: 1px 0;">${row.sym}</td>
                        <td style="color: #e2e8f0; text-align: right; padding-right: 6px;">${formatMoneyHUD(row.price)}</td>
                        <td style="text-align: right; padding-right: 6px;">${forecastBar} ${(row.forecast * 100).toFixed(0)}%</td>
                        <td style="text-align: right; padding-right: 6px;">${holdingText}</td>
                        <td style="color: ${rowPlColor}; text-align: right; font-weight: bold;">${row.plText}</td>
                    </tr>
                `;
            }).join("");
        } else {
            tableRows = `<tr><td colspan="5" style="color: #64748b; text-align: center; font-style: italic; padding: 5px;">No active ticker tracking.</td></tr>`;
        }

        col4Html = `
            <div style="display: flex; flex-direction: column; justify-content: space-between; height: 100%; font-size: 11px; padding-right: 12px;">
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(148, 163, 184, 0.12); padding-bottom: 1px; font-size: 11px;">
                    <span style="color: #34d399; font-weight: bold;">STOCKS :: PORT ${formatMoneyHUD(stock.portfolioVal)}</span>
                    <span style="color: ${plColor}; font-weight: bold;">P/L: ${plSign}${formatMoneyHUD(stock.totalPL)} (${plSign}${plPercent.toFixed(1)}%)</span>
                </div>
                <table style="width: 100%; border-collapse: collapse; margin-top: 2px;">
                    <thead>
                        <tr style="color: #94a3b8; border-bottom: 1px solid rgba(148, 163, 184, 0.1); font-size: 9.5px;">
                            <th style="text-align: left; padding-bottom: 1px;">SYM</th>
                            <th style="text-align: right; padding-bottom: 1px; padding-right: 6px;">PRICE</th>
                            <th style="text-align: right; padding-bottom: 1px; padding-right: 6px;">FCST/TREND</th>
                            <th style="text-align: right; padding-bottom: 1px; padding-right: 6px;">POSITION</th>
                            <th style="text-align: right; padding-bottom: 1px;">P/L</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            </div>
        `;
    } else {
        col4Html = `<div style="color: #64748b; font-style: italic; font-size: 11px;">Stock Trading Subsystem Offline</div>`;
    }

    container.innerHTML = `
        <div style="display: grid; grid-template-columns: 1.1fr 1.1fr 1.1fr 1.8fr; gap: 14px; width: 100%; height: 114px; padding-bottom: 8px; padding-right: 14px;">
            <div style="border-right: 1px solid rgba(148, 163, 184, 0.12); padding-right: 10px; height: 100%;">${col1Html}</div>
            <div style="border-right: 1px solid rgba(148, 163, 184, 0.12); padding-right: 10px; height: 100%;">${col2Html}</div>
            <div style="border-right: 1px solid rgba(148, 163, 184, 0.12); padding-right: 10px; height: 100%;">${col3Html}</div>
            <div style="height: 100%;">${col4Html}</div>
        </div>
    `;
}

/**
 * Unified render entry point. Updates the active view of the custom Top Bar HUD 
 * based on collapsed/expanded state and shared global window stores.
 */
export function renderHud() {
    try {
        const doc = eval("document");
        const bar = createOrGetTopBar();
        const contentContainer = doc.getElementById("hud-content-container");
        if (!contentContainer) return;
        
        const isCollapsed = bar.classList.contains("collapsed");
        const swarmStats = window.customHudSwarm;
        const stockStats = window.customHudStock;
        
        if (isCollapsed) {
            renderCollapsedView(contentContainer, swarmStats, stockStats);
        } else {
            renderExpandedView(contentContainer, swarmStats, stockStats);
        }
    } catch (e) {
        window.customHudError = e.stack || e.message || String(e);
        console.error("Custom HUD Render Error: ", e);
    }
}

/**
 * Clears and hides a section from the horizontal HUD, deleting the HUD bar entirely if both sections are inactive.
 * Ensures DOM cleanliness and prevents leaks/leftovers on exit.
 * @param {string} sectionId - Either 'swarm' or 'stock'
 */
export function cleanupHudSection(sectionId) {
    const doc = eval("document");
    
    if (sectionId === "swarm") {
        window.customHudSwarm = null;
    } else if (sectionId === "stock") {
        window.customHudStock = null;
    }

    const bar = doc.getElementById("custom-top-hud");
    if (bar) {
        const isSwarmEmpty = !window.customHudSwarm;
        const isStockEmpty = !window.customHudStock;
        
        if (isSwarmEmpty && isStockEmpty) {
            if (bar.parentNode) {
                bar.parentNode.removeChild(bar);
            }
        } else {
            // Re-render with remaining section
            renderHud();
        }
    }
}

// Register global hooks using eval to bypass 25GB static RAM charge for other scripts importing this
try {
    const win = eval("window");
    win.renderCustomHud = renderHud;
    win.cleanupCustomHudSection = cleanupHudSection;
} catch (e) {}
