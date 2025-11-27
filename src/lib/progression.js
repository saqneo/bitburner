/**
 * Centralized progression logic.
 * Defines the criteria for transitioning between game stages.
 * 
 * @param {NS} ns
 * @param {string} currentStage - The name of the currently running stage (e.g., "early")
 * @returns {string|null} - The name of the next stage if transition criteria are met, or null.
 */
export function checkTransition(ns, currentStage) {
    const maxRam = ns.getServerMaxRam("home");

    switch (currentStage) {
        case "early":
            // Transition to 'midgame' when we have at least 1TB (1024GB) of RAM.
            // This ensures we have enough capacity for batchers or heavier logic.
            if (maxRam >= 1024) {
                return "midgame";
            }
            break;
        
        case "midgame":
            // Placeholder: Transition to 'endgame' or other stages
            // if (ns.formulas.hacking.hackChance(...) > 0.9) return "endgame";
            break;

        default:
            // Unknown stage or no transition defined
            return null;
    }
    return null;
}