/** @param {NS} ns */
export async function main(ns) {
    ns.tprint("=== HUD DIAGNOSTIC ===");
    
    // 1. Check if file exists
    const exists = ns.fileExists("/monitor.js");
    ns.tprint(`1. /monitor.js exists: ${exists}`);
    if (!exists) {
        ns.tprint("ERROR: /monitor.js is missing on home!");
        return;
    }
    
    // 2. RAM Cost & Availability
    const ramCost = ns.getScriptRam("/monitor.js");
    const homeMax = ns.getServerMaxRam("home");
    const homeUsed = ns.getServerUsedRam("home");
    const homeFree = homeMax - homeUsed;
    
    ns.tprint(`2. RAM Cost of /monitor.js: ${ramCost} GB`);
    ns.tprint(`   Home Max RAM: ${homeMax} GB`);
    ns.tprint(`   Home Used RAM: ${homeUsed} GB`);
    ns.tprint(`   Home Free RAM: ${homeFree} GB`);
    
    if (homeFree < ramCost && !ns.isRunning("/monitor.js", "home")) {
        ns.tprint(`ERROR: Not enough free RAM to run /monitor.js (need ${ramCost} GB, have ${homeFree} GB free).`);
    } else {
        ns.tprint("   RAM check: OK!");
    }
    
    // 3. Check if running
    const isRunning = ns.isRunning("/monitor.js", "home");
    ns.tprint(`3. /monitor.js is currently running: ${isRunning}`);
    
    if (isRunning) {
        const processInfo = ns.getRunningScript("/monitor.js", "home");
        if (processInfo) {
            ns.tprint(`   PID: ${processInfo.pid}`);
            ns.tprint(`   Logs:`);
            const logs = processInfo.logs;
            if (logs.length > 0) {
                logs.slice(-5).forEach(l => ns.tprint(`     ${l}`));
            } else {
                ns.tprint("     (No logs yet)");
            }
        }
    }
    
    // 4. Global window state checks
    const win = eval("window");
    ns.tprint(`4. Window HUD elements:`);
    ns.tprint(`   window.customHudSwarm: ${win.customHudSwarm ? "Exists" : "Undefined/Null"}`);
    ns.tprint(`   window.customHudStock: ${win.customHudStock ? "Exists" : "Undefined/Null"}`);
    ns.tprint(`   window.customHudError: ${win.customHudError || "None"}`);
    
    // 5. Document checks (DOM access)
    const doc = eval("document");
    const hudBar = doc.getElementById("custom-top-hud");
    ns.tprint(`5. DOM custom-top-hud element: ${hudBar ? "Found" : "NOT FOUND"}`);
    if (hudBar) {
        ns.tprint(`   Display: ${hudBar.style.display}`);
        ns.tprint(`   Visibility: ${hudBar.style.visibility}`);
        ns.tprint(`   Position: left=${hudBar.style.left}, top=${hudBar.style.top}, width=${hudBar.style.width}, height=${hudBar.style.height}`);
        ns.tprint(`   Classes: ${[...hudBar.classList].join(", ") || "None"}`);
    }
    
    ns.tprint("=======================");
}
