import { spread } from '/lib/spread.js';

/** @param {NS} ns */
export async function main(ns) {
    const guide = `
\n_______________________________________________________
|            RECOVERY PROTOCOL: EARLY GAME            |
|_____________________________________________________|
| 1. [TRAVEL]   :: Go to Chongqing, New Tokyo, or     |
|                  Ishima immediately.                |
| 2. [FACTION]  :: Join Tian Di Hui (Req: H:50, $1m). |
| 3. [BACKDOOR] :: Crack & Backdoor immediately:      |
|                  -> 'CSEC' (CyberSec)               |
|                  -> 'avmnite-02h' (NiteSec)         |
|-----------------------------------------------------|
|            SHOPPING LIST (PRIORITY ORDER)           |
|-----------------------------------------------------|
| 1. Neuroreceptor Manager (TDH) :: [Auto-Focus Work] |
| 2. Social Neg. Asst (TDH)      :: [Rep Gain +15%]   |
| 3. ADR-V1 Gene (TDH)           :: [Rep Gain +10%]   |
| 4. Cranial Signal Proc (CSEC)  :: [Hack Speed/Power]|
| 5. BitWire (CSEC/NiteSec)      :: [Hack Skill]      |
|-----------------------------------------------------|
| 4. [ACTION]   :: Work 'Hacking Contracts' for TDH.  |
|                  Solve .cct files for Rep bursts.   |
| 5. [SYSTEM]   :: REMINDER: Run 'buyAll' alias!      |
|_____________________________________________________|
`;

    ns.tprint(guide);
    ns.disableLog("ALL");
    
    // Define the state file path
    const STATE_FILE = "/data/state.txt";
    let state = "early"; // Default bootstrap state

    // Read the current state if the file exists
    if (ns.fileExists(STATE_FILE)) {
        const content = ns.read(STATE_FILE).trim();
        if (content) {
            state = content;
        }
    }

    const script = `/stages/${state}.js`;
    
    // Immediate Network Scan & Spread
    // Ensure we have root access to available servers immediately upon boot/recovery.
    // Continue spreading until no new servers are compromised to ensure maximum reach.
    while (spread(ns)) {
        await ns.sleep(50); 
    }

    // Spawn the Stage
    if (ns.fileExists(script)) {
        ns.tprint(`Daemon: Spawning stage '${state}' (${script})...`);
        ns.spawn(script);
    } else {
        ns.tprint(`Daemon ERROR: Stage script '${script}' not found! Defaulting to 'early'.`);
        if (state !== 'early' && ns.fileExists('/stages/early.js')) {
             ns.spawn('/stages/early.js');
        }
    }
}