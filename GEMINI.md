# GEMINI.md - Project Context & Guidelines

## Project Overview
**Project Name:** Bitburner Automation Scripts (Fresh Start)
**Goal:** Develop a comprehensive, automated script suite for the game Bitburner, starting from scratch.
**Language:** JavaScript (ES6+ / Netscript 2.0 / NS2)
**Environment:** Node.js local environment synced to Bitburner via itburner-filesync.

## Architectural Guidelines
1.  **NS2 Standards:** All scripts must use the sync/await pattern and the 
s handle.
    *   Extension: .js (avoid .script for legacy Netscript 1.0).
    *   Entry Point: export async function main(ns) { ... }.
    *   **Function Availability:** Always verify function availability and usage in the in-game Netscript documentation (`help <function_name>`). Avoid legacy Netscript 1.0 functions (e.g., `disableScriptLog`) as they may be deprecated or have changed signatures in NS2.
    *   **Type Safety:** strictly adhere to the signatures defined in `index.d.ts`. Do not assume API overrides (e.g., `ns.scp` taking an array) exist unless confirmed by the definition file.
2.  **Modularity:** Reusable logic should be placed in `src/lib/` or specific feature folders, exported, and imported.
3.  **Memory Efficiency:** Early game scripts must be RAM-conscious.
4.  **Singularity API Usage:** Avoid directly using `ns.singularity` API methods in general-purpose scripts due to their high RAM cost. Permission must be sought before integrating them, unless the script is specifically located within a `src/singularity/` subfolder.
5.  **Legacy Reference:** Old scripts are archived in `src/.old/` for reference but are excluded from game sync.

## Automation Architecture
**State Machine Pattern:** The automation is structured as a series of sequential "Stages" (scripts) that handle specific phases of the game. This uses a **Cyclic Handoff** model to maximize RAM efficiency (Daemon and Stage are never running simultaneously).

1.  **Persistence:** The current stage is stored in `/data/state.txt`. This ensures recovery after game restarts.
2.  **Entry Point (`src/daemon.js`):**
    *   Reads `/data/state.txt`.
    *   **Spawns** (replaces itself with) the corresponding stage script (e.g., `src/stages/early.js`).
    *   Defaults to `early` if no state file exists.
3.  **Stage Scripts (`src/stages/*.js`):**
    *   **Responsibility:** Manage the game for that specific phase (e.g., "Early Game" uses simple hack scripts, "Mid Game" uses batchers).
    *   **Transition:** When a stage is complete (RAM/Money thresholds met):
        1.  **Cleanup:** Kill all worker scripts (e.g., `early-hack.js`) spawned by this stage.
        2.  **Persist:** Write the *next* stage name to `/data/state.txt`.
        3.  **Handover:** Execute `ns.spawn('/daemon.js')` to reboot into the next stage.

## Directory Structure
*   src/: Source code root (synced to game).
*   src/lib/: Shared library functions.
*   src/stages/: State machine stage scripts.
*   src/.old/: Archived scripts from previous iteration (Not Synced).
*   .gemini/: AI Configuration and context.

## Testing
*   **Structure:** The src/test/ directory contains test suites. Each file (e.g., src/test/lib_map.test.js) corresponds to a specific library or component.
*   **Execution:** Since Bitburner lacks a native test runner, test scripts are standalone executables that import the target code, run assertions, and print pass/fail results to the terminal.
*   **Memory Tests:** Critical scripts must have associated memory tests (e.g., checking 
s.getScriptRam) to ensure they fit within early-game RAM constraints (e.g., daemon.js < 3GB, early.js < 5GB).

## Development Workflow
1.  **Start:** Run 
pm run start or ./start_dev.ps1 to start the file watcher.
2.  **Linting:** Code is linted via ESLint (Loose configuration) to catch syntax errors without blocking 
s usage.
3.  **Documentation:** Update this file as architectural decisions are made.
