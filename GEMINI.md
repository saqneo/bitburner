# GEMINI.md - Project Context & Guidelines

## Project Overview
**Project Name:** Bitburner Automation Scripts (Fresh Start)
**Goal:** Develop a comprehensive, automated script suite for the game Bitburner, starting from scratch.
**Language:** JavaScript (ES6+ / Netscript 2.0 / NS2)
**Environment:** Node.js local environment synced to Bitburner via itburner-filesync.

## Architectural Guidelines
1.  **NS2 Standards:** Use `async/await` and `ns` handle. Adhere strictly to `index.d.ts` for type safety. Verify function RAM costs/availability.
2.  **Modularity:** Encapsulate logic in `src/lib/` or feature folders.
3.  **RAM Efficiency:** General scripts must be lightweight. Avoid `ns.singularity` in persistent scripts unless necessary.
4.  **Legacy Code:** Archived scripts in `src/.old/` are for reference only and excluded from sync.
5.  **Logging:** Use `ns.print` for internal logs. Use `ns.tprint` *only* for critical alerts or CLI output.
6.  **Daemon Pattern:** `src/daemon.js` is a lightweight **orchestrator**. Abstract logic to libraries (`src/lib/target-analysis.js`). Offload heavy tasks to transient scripts (`src/util/`).
7.  **Naming:** Use descriptive, self-documenting names for all symbols.
8.  **Commit Standards:** Adhere to [Conventional Commits](https://www.conventionalcommits.org/). 
    *   **Type:** Reflect the most significant change (e.g., use `feat`/`fix` over `docs` if code changed).
    *   **Message:** Summarize the impact of changes across affected components. Listing every file is not required, but key changes must be noted.
    *   **Context Awareness:** Describe the *net result* of the staged changes relative to the previous commit (`HEAD`), not the step-by-step iteration process used to get there. For example, if you create a file and then fix a bug in it before the first commit, the message should be "Add [file]" with a description of its features, *not* "Fix bug in [file]".

## Automation Architecture
**State Machine Pattern:** The automation is structured as a series of sequential "Stages" (scripts) that handle specific phases of the game. This uses a **Cyclic Handoff** model to maximize RAM efficiency (Daemon and Stage are never running simultaneously).

1.  **Persistence:** The current stage is stored in `/data/state.txt`. This ensures recovery after game restarts.
2.  **Entry Point (`src/daemon.js`):**
    *   Reads `/data/state.txt`.
    *   **Executes** the logic for the current stage.
    *   **Early Game:** Runs internally (`runEarly` function) to manage atomic workers.
    *   **Mid/End Game:** May spawn dedicated stage scripts (e.g., `src/stages/midgame.js`) if complexity requires it.
    *   Defaults to `early` if no state file exists.
3.  **Stage Scripts (`src/stages/*.js`):**
    *   **Responsibility:** Manage the game for complex phases (e.g., "Mid Game" batchers) that require dedicated RAM/Logic.
    *   **Transition:** When a stage is complete (RAM/Money thresholds met):
        1.  **Cleanup:** Kill all worker scripts (e.g., `early-hack.js`) spawned by this stage.
        2.  **Persist:** Write the *next* stage name to `/data/state.txt`.
        3.  **Handover:** Execute `ns.spawn('/daemon.js')` to reboot into the next stage.

## Timing & Waits
*   **Tick Rate:** For short, polling-style waits (e.g., waiting for a process to start or die), use the `TICK_RATE_MS` constant from `/lib/constants.js`. This is set to 100ms to provide a safe margin over the game's script execution overhead.

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
1.  **Start:** Run `npm run start` or `./start_dev.ps1` to start the file watcher.
2.  **Linting:** Code is linted via ESLint (Loose configuration) to catch syntax errors without blocking `ns` usage.
3.  **Commit Protocol:** Before *every* commit, read `.gemini/pre-commit.md`. This is mandatory to ensure all files are staged and messages are accurate.
4.  **Documentation:** Update this file as architectural decisions are made.
