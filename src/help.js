/** @param {NS} ns */
export async function main(ns) {
    const C = {
        RESET: "\u001b[0m",
        GOLD: "\u001b[33;1m",
        CYAN: "\u001b[36;1m",
        WHITE: "\u001b[37;1m"
    };

    const pad = (text, width) => {
        const visibleLength = text.replace(/\u001b\[[0-9;]*m/g, '').length;
        return text + " ".repeat(Math.max(0, width - visibleLength));
    };

    const lines = [
        " ________________________________________________________________________________ ",
        `|${pad(`${C.GOLD}                         RECOVERY PROTOCOL: EARLY GAME                          `, 80)}${C.RESET}|`,
        "|________________________________________________________________________________|",
        `|${pad(" 1. [TRAVEL]   :: Go to Chongqing, New Tokyo, or Ishima immediately.            ", 80)}|`,
        `|${pad(" 2. [SHOPPING] :: Buy TOR Router ($200k) at City -> 'Alpha Enterprises'.        ", 80)}|`,
        `|${pad(" 3. [FACTION]  :: Join Tian Di Hui (Req: Hacking 50, $1m).                      ", 80)}|`,
        `|${pad(" 4. [BACKDOOR] :: Crack & Backdoor immediately:                                 ", 80)}|`,
        `|${pad("                  -> 'CSEC' (CyberSec)                                          ", 80)}|`,
        `|${pad("                  -> 'avmnite-02h' (NiteSec)                                    ", 80)}|`,
        "|--------------------------------------------------------------------------------|",
        `|${pad(`${C.CYAN}                         SHOPPING LIST (PRIORITY ORDER)                         `, 80)}${C.RESET}|`,
        "|--------------------------------------------------------------------------------|",
        `|${pad(" 1. Neuroreceptor Manager (TDH) :: [Auto-Focus Work / No Penalty]               ", 80)}|`,
        `|${pad(" 2. Social Neg. Asst (TDH)      :: [Faction Rep Gain +15%]                      ", 80)}|`,
        `|${pad(" 3. ADR-V1 Gene (TDH)           :: [Faction Rep Gain +10%]                      ", 80)}|`,
        `|${pad(" 4. Cranial Signal Proc (CSEC)  :: [Hacking Speed/Power Upgrade]                ", 80)}|`,
        `|${pad(" 5. BitWire (CSEC/NiteSec)      :: [Hacking Skill Upgrade]                      ", 80)}|`,
        "|--------------------------------------------------------------------------------|",
        `|${pad(" 5. [ACTION]   :: Work 'Hacking Contracts' for TDH. Solve .cct for Rep bursts.  ", 80)}|`,
        `|${pad(" 6. [SYSTEM]   :: REMINDER: Run 'ba' (buyAll) alias!                            ", 80)}|`,
        "|________________________________________________________________________________|",
        "",
        " ________________________________________________________________________________ ",
        `|${pad(`${C.GOLD}                               SYSTEM & HUD USAGE                               `, 80)}${C.RESET}|`,
        "|________________________________________________________________________________|",
        `|${pad(" Ext. Sync:     Run 'npm run start' in OS terminal to sync files.               ", 80)}|`,
        `|${pad(" Start Daemon:  run /daemon.js (alias: d)                                       ", 80)}|`,
        `|${pad(" Start HUD:     run /monitor.js (alias: m)                                      ", 80)}|`,
        `|${pad(" Start Stocks:  run /util/stock-trader.js                                       ", 80)}|`,
        `|${pad("                                                                                ", 80)}|`,
        `|${pad(" The HUD (/monitor.js) tracks the active swarm in real-time. It detects which   ", 80)}|`,
        `|${pad(" target has the most active worker threads and displays its live status.        ", 80)}|`,
        `|${pad("                                                                                ", 80)}|`,
        `|${pad(" Alias: s       -> run /util/network-tree.js (Map & Backdoor targets)           ", 80)}|`,
        `|${pad(" Alias: path    -> run /util/path.js [target] (Show connection string)          ", 80)}|`,
        `|${pad(" Alias: c       -> connect (Quick navigation)                                   ", 80)}|`,
        `|${pad(" Alias: ka      -> run /util/killall.js (Emergency stop all scripts)            ", 80)}|`,
        `|${pad(" Alias: ba      -> [buyAll] (Purchase all available port openers)               ", 80)}|`,
        "|________________________________________________________________________________|",
        "",
        " ________________________________________________________________________________ ",
        `|${pad(`${C.GOLD}                                HACKING WORKFLOW                                `, 80)}${C.RESET}|`,
        "|________________________________________________________________________________|",
        `|${pad(" The Daemon (/daemon.js) is fully autonomous. It ranks targets by:              ", 80)}|`,
        `|${pad(` ${C.WHITE}Score = (MaxMoney * HackChance) / HackTime${C.RESET}`, 80)}|`,
        `|${pad("                                                                                ", 80)}|`,
        `|${pad(" 1. Run 'd' (daemon.js) to begin spreading to nodes.                            ", 80)}|`,
        `|${pad(" 2. The swarm will automatically deploy H/G/W workers across rooted servers.    ", 80)}|`,
        `|${pad(" 3. Keep buying port openers ('ba') to expand the botnet's total RAM.           ", 80)}|`,
        `|${pad(" 4. Monitor real-time deployment targets with the HUD ('m').                    ", 80)}|`,
        "|________________________________________________________________________________|"
    ];

    ns.tprint("\n" + lines.join("\n"));
}
