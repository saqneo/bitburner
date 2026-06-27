/**
 * This file contains shared constants used across multiple scripts.
 */

/** 
 * The base tick rate for process polling and short waits, in milliseconds.
 * Based on a safe margin above the ~25ms script execution time.
 * @type {number} 
 */
export const TICK_RATE_MS = 100;

/**
 * The interval for running heavy maintenance tasks (spread, deploy, contracts) in the daemon.
 * @type {number}
 */
export const MAINTENANCE_INTERVAL_MS = 60000;

// --- Midgame Batcher Constants ---

/**
 * Max concurrent batch operations per target in the midgame batcher.
 * @type {number}
 */
export const MAX_CONCURRENT_BATCHES = 1000;

/**
 * Fraction of money to hack per HWGW batch (small for concurrent safety).
 * Lower values allow more overlapping batches before desyncing.
 * @type {number}
 */
export const HACK_FRACTION = 0.10;

/**
 * Over-provision factor for grow threads. Compensates for float rounding
 * and edge cases in ns.growthAnalyze calculations.
 * @type {number}
 */
export const GROW_SAFETY_FACTOR = 1.05;

/**
 * Time between each operation landing within one HWGW batch (ms).
 * Order: Hack → Weaken₁ → Grow → Weaken₂, each separated by this spacing.
 * Must be large enough that the game resolves each operation before the next lands.
 * @type {number}
 */
export const BATCH_SPACING_MS = 25;

/**
 * Time between consecutive batch landing windows (ms).
 * Equals 4 * BATCH_SPACING_MS since each HWGW batch has 4 operations.
 * @type {number}
 */
export const CYCLE_PERIOD_MS = 4 * BATCH_SPACING_MS;

// --- Singularity Constants ---

/**
 * The base tick rate for the Singularity manager, in milliseconds.
 * @type {number}
 */
export const SING_TICK_MS = 10000;

/**
 * The interval for running full state scans of the Singularity API, in milliseconds.
 * @type {number}
 */
export const SING_SCAN_INTERVAL_MS = 60000;

/**
 * Minimum number of purchased but not installed augmentations before auto-prestige.
 * @type {number}
 */
export const SING_MIN_AUGS_TO_INSTALL = 20;

/**
 * Set to true to automatically install augmentations and reset.
 * Defaults to false for player safety.
 * @type {boolean}
 */
export const SING_AUTO_INSTALL = true;

/**
 * Max fraction of current money to spend on home RAM/core upgrades.
 * @type {number}
 */
export const SING_HOME_UPGRADE_PCT = 0.10;

/**
 * Time player must be doing the same work without interruption before stealing UI focus, in milliseconds.
 * @type {number}
 */
export const SING_FOCUS_DELAY_MS = 300000;

/**
 * Time without progress (purchasable aug count unchanged) before forcing a prestige
 * with whatever augs are available. Prevents stalling in late game when the full
 * augmentation threshold can't be reached.
 * @type {number}
 */
export const SING_STALL_TIMEOUT_MS = 1800000; // 30 minutes

// --- City Faction Exclusivity ---

/**
 * City faction mutual exclusion groups.
 * Joining any faction in one group locks out all factions in every other group
 * for the remainder of the current run (until augmentation reset).
 * @type {string[][]}
 */
export const CITY_FACTION_GROUPS = [
    ["Sector-12", "Aevum"],
    ["Chongqing", "New Tokyo", "Ishima"],
    ["Volhaven"]
];

/** Flat list of all city faction names. @type {string[]} */
export const CITY_FACTIONS = CITY_FACTION_GROUPS.flat();
