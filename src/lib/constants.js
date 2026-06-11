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
 * With 100 concurrent batches, worst case drains ~5 * overlapping_batches percent.
 * @type {number}
 */
export const HACK_FRACTION = 0.20;

/**
 * Over-provision factor for grow threads. Compensates for reduced grow effectiveness
 * when security is temporarily elevated between a hack landing and its weaken landing.
 * @type {number}
 */
export const GROW_SAFETY_FACTOR = 1.2;

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
export const SING_AUTO_INSTALL = false;

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

