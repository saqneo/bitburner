# Bitburner Automation Scripts

This repository houses a collection of JavaScript (Netscript 2.0) scripts designed to automate various aspects of the game Bitburner. The project emphasizes a structured, modular, and RAM-efficient approach to in-game automation.

## Project Structure and Goals

The scripts are organized to manage different phases of the game through a state-machine pattern. A central daemon orchestrates the execution of "stage" scripts, each handling specific game progression objectives.

-   **`src/daemon.js`**: The primary entry point, responsible for initiating the appropriate game stage based on saved state.
-   **`src/stages/*.js`**: These scripts manage distinct game phases (e.g., early-game, mid-game), performing actions and transitioning to the next stage upon meeting specific criteria.
-   **`src/lib/`**: Contains shared utility functions and modules used across various scripts to promote code reusability and maintainability.
-   **`src/hack/`**: Houses the core hacking scripts.

## Key Principles

-   **Modularity**: Code is structured into reusable modules and libraries.
-   **Efficiency**: Scripts are developed with a focus on optimizing RAM usage, particularly for early-game scenarios.
-   **Automation**: The system aims to automate progression, resource management, and combat within the game.

## Development Setup

1.  **Prerequisites**: [Node.js](https://nodejs.org/) and the game [Bitburner](https://store.steampowered.com/app/1812820/Bitburner/).
2.  **Installation**: 
    -   Clone this repository.
    -   Run `npm install` to set up dependencies.
3.  **Synchronization**: Use `npm run start` to activate the file watcher and synchronize local `src` files with your Bitburner game instance via `bitburner-filesync`.
