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
