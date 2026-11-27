# Minecraft: Java Edition — Browser Voxel Sandbox

A browser-based, 3D voxel sandbox inspired by the creative freedom and familiar mechanics of Minecraft Java Edition. Built with **React, TypeScript, Three.js, and Vite**, with desktop and touch-friendly controls.

> **Project status:** Independent, in-development project. This repository is not affiliated with, endorsed by, or sponsored by Mojang Studios or Microsoft. “Minecraft” is a trademark of its respective owner.

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-7-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Three.js-WebGL-black?logo=threedotjs&logoColor=white" alt="Three.js" />
  <img src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Status-Development-orange" alt="In development" />
</p>

---

## Table of contents

- [Overview](#overview)
- [Technology stack](#technology-stack)
- [Features](#features)
- [How the application works](#how-the-application-works)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Environment configuration](#environment-configuration)
- [Controls](#controls)
- [Build and quality checks](#build-and-quality-checks)
- [Security](#security)
- [Contributing](#contributing)
- [License](#license)
- [Credits and trademark notice](#credits-and-trademark-notice)

## Overview

This project recreates selected voxel-sandbox gameplay systems in the browser. The React application provides the menus and HUD, while a dedicated Three.js engine renders and updates the 3D world.

The codebase is written primarily in **TypeScript**. It is a web application—not a Java Edition mod, server, or Java desktop application.

## Technology stack

| Technology | Role in this repository |
| --- | --- |
| **TypeScript** | Main application and game-engine language; provides types for game state, entities, items, and engine APIs. |
| **React 19** | Builds the application shell, title screen, HUD, inventory, pause, and death interfaces. |
| **Three.js** | Creates the WebGL renderer, scene, camera, lighting, voxel world visuals, entities, and effects. |
| **Vite** | Development server and production build tool. |
| **Tailwind CSS 4** | Utility-first styling, integrated through the Vite plugin. |
| **Motion** | UI animation library included in the project dependencies. |
| **Lucide React** | Icon components used by the interface. |
| **Google GenAI SDK** | Included as a dependency for Gemini-powered functionality where configured. |
| **Bun** | Lockfile/package-management workflow represented by the committed `bun.lock`. |

### Why these technologies?

- **TypeScript + React** separate interface state and reusable UI components from the simulation code.
- **Three.js** provides direct control over the WebGL scene and rendering pipeline needed for a 3D voxel environment.
- **Vite** keeps local development and production builds straightforward.
- **Tailwind CSS** supports consistent styling across the game's interface.

## Features

The current codebase includes the following systems:

- **3D voxel world:** procedurally generated chunk-based terrain and a block texture atlas.
- **Game modes:** Survival and Creative, with Spectator represented in the game-mode types/engine.
- **Player movement:** first-person controls, sprinting, sneaking, jumping, and camera perspective switching.
- **Block interaction:** target selection, mining progress, and block placement/use interactions.
- **Inventory:** hotbar, inventory slots, armor slots, chests, furnaces, and item handling.
- **Survival systems:** health, hunger, air, experience, and player respawning.
- **World simulation:** day/night cycle, weather, clouds, mobs, dropped items, and particles.
- **Progression:** advancement notifications.
- **Persistence:** local browser save data for continuing a world.
- **HUD and menus:** title, pause, inventory, chat/command interface, debug overlay, and death screen.
- **Touch interface:** on-screen movement and action controls for mobile-sized screens.

> Features and behaviour may change as development continues. This project aims to implement its own browser-based systems; it does not claim complete feature parity with the official Minecraft Java Edition.

## How the application works

At a high level, the application is split into two cooperating layers:

1. **React interface layer** — mounts the game, owns menu/HUD state, and forwards user actions to the engine.
2. **Three.js game layer** — owns the renderer, scene, camera, world, player simulation, entities, input handling, and game loop.

The main entry point is `src/main.tsx`. It mounts `App`, which creates a `MinecraftEngine` instance and connects engine callbacks to React state. The engine is implemented under `src/engine/`; shared game types live under `src/types/`.

## Project structure

The following is a high-level map of the source directories and key files:

```text
Minecraft-/
├── src/
│   ├── components/       # React screens, HUD, inventory and game dialogs
│   ├── data/              # Block/item definitions and recipes
│   ├── engine/            # Three.js renderer, world, game loop and simulation
│   ├── types/             # Shared TypeScript game models and types
│   ├── App.tsx            # React application and engine integration
│   ├── main.tsx           # React entry point
│   └── index.css          # Global styles and game UI styling
├── .env.example           # Environment-variable template
├── .gitignore
├── bun.lock               # Bun dependency lockfile
├── index.html             # HTML document and metadata
├── metadata.json          # Application metadata
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
└── vite.config.ts         # Vite, React and Tailwind configuration
```

## Getting started

Follow these steps to run the project locally. The commands below are for Windows PowerShell unless noted otherwise; the same project can also be run on macOS and Linux.

### Requirements

Install the following before starting:

| Requirement | Version / notes | Why it is needed |
| --- | --- | --- |
| **Windows 10/11, macOS, or Linux** | A supported desktop operating system | To install dependencies and run the development server. |
| **Node.js** | **20.19+ or 22.12+** | Required by the Vite 8 toolchain. Install the current LTS release that meets this requirement. |
| **npm** | Included with Node.js | Alternative package manager; no separate installation is normally needed. |
| **Bun** | Current stable release (recommended) | Optional package manager; this repository includes `bun.lock`. |
| **Git** | Current version | Required to clone the repository. |
| **Modern browser** | Chrome, Edge, Firefox, or another current browser with WebGL 2 support and hardware acceleration | Required to render the 3D game. |

A dedicated graphics card is not mandatory, but 3D performance depends on your device and browser. Keep browser hardware acceleration enabled where available.

### 1. Install the tools

- Install Node.js from [nodejs.org](https://nodejs.org/). Choose a version supported by Vite 8.
- Install Git from [git-scm.com](https://git-scm.com/).
- Optional: install Bun from [bun.sh](https://bun.sh/) if you want to use the repository's recommended package-manager workflow.

Check that the tools are available in a new terminal:

```powershell
node --version
npm --version
git --version
```

If you installed Bun, also check:

```powershell
bun --version
```

### 2. Clone the repository

Open PowerShell, Windows Terminal, Command Prompt, or a terminal on macOS/Linux:

```bash
git clone https://github.com/prathameshsutar140/Minecraft-.git
cd Minecraft-
```

### 3. Install project dependencies

**Recommended — Bun** (uses the committed `bun.lock`):

```bash
bun install
```

**Alternative — npm**:

```bash
npm install
```

Use one package manager consistently for a given install. Do not mix Bun and npm lockfiles in the same working setup.

### 4. Configure environment variables (only if needed)

The repository provides an `.env.example` template. The normal local game launch does not require you to invent values for these settings. If you are testing a feature that makes Gemini API calls or depends on the hosted app URL, create a local `.env` file:

**Windows PowerShell:**

```powershell
Copy-Item .env.example .env
```

**Windows Command Prompt:**

```cmd
copy .env.example .env
```

**macOS / Linux:**

```bash
cp .env.example .env
```

Open `.env` and replace the example values only with valid values for the feature you are configuring:

- `GEMINI_API_KEY` — used for Gemini API calls, if that functionality is enabled.
- `APP_URL` — the hosted application URL for integrations that require it; AI Studio supplies this automatically in its hosted environment.

Do not commit `.env` or share API keys publicly. The example values are placeholders, not working credentials. Never put a private API key into client-side code.

### 5. Start the development server

From the repository root, run **one** of these commands:

```bash
# Bun
bun run dev

# npm
npm run dev
```

Vite starts the development server on port **3000**. Open this address in your browser:

```text
http://localhost:3000
```

Keep the terminal running while you play. To stop the server, focus the terminal and press `Ctrl + C`.

### 6. Create and preview a production build (optional)

Build the optimized app:

```bash
# Bun
bun run build

# npm
npm run build
```

Preview the generated production build locally:

```bash
# Bun
bun run preview

# npm
npm run preview
```

Vite prints the local preview address in the terminal. Open that address in your browser.

### Troubleshooting

| Problem | What to try |
| --- | --- |
| `node` or `npm` is not recognized | Install Node.js, close and reopen the terminal, then check `node --version` and `npm --version`. |
| Vite reports an unsupported Node.js version | Upgrade to Node.js **20.19+ or 22.12+**, then reinstall dependencies. |
| `bun` is not recognized | Install Bun, or use the npm commands shown above. |
| Port 3000 is already in use | Stop the other process using that port, then run the project again. |
| The page loads but the 3D scene is blank or slow | Update your browser and graphics drivers, enable browser hardware acceleration, and confirm WebGL 2 is supported. |
| Dependencies appear incomplete | From the project folder, run `bun install` or `npm install` again, then restart the development server. |


## Controls

The interface supports keyboard/mouse and touch input. The current UI and engine include these bindings:

| Action | Desktop input |
| --- | --- |
| Move | `W` `A` `S` `D` |
| Jump | `Space` |
| Sneak | `Shift` |
| Sprint | `Ctrl` / configured sprint input |
| Mine / attack | Left mouse button |
| Place / use | Right mouse button |
| Select hotbar slot | `1`–`9` / mouse wheel |
| Inventory | `E` |
| Chat / commands | `T` or `/` |
| Pause / close interface | `Esc` |
| Debug overlay | `F3` |
| Change camera perspective | `F5` |

Some controls can vary by device and current game state. On touch devices, use the on-screen movement and action controls.

## Build and quality checks

Create an optimized production build:

```bash
bun run build
```

Preview the production build locally:

```bash
bun run preview
```

Run the configured TypeScript check:

```bash
bun run lint
```

The `lint` script currently runs `tsc --noEmit`; it is a TypeScript type-check, not a dedicated ESLint rule set.

## Security

Please do not report security vulnerabilities in public issues.

- Review [SECURITY.md](SECURITY.md) for the project's vulnerability-reporting guidance.
- Never commit API keys, access tokens, passwords, or private configuration.
- Keep dependencies updated and review dependency advisories.
- Validate and safely handle data received from users or external services.
- Avoid putting privileged credentials in client-side code.

If private vulnerability reporting is enabled for this repository, use GitHub's **Report a vulnerability** flow. Otherwise, contact the maintainer privately through an appropriate GitHub channel.

## Contributing

Contributions, bug reports, and improvement ideas are welcome.

1. Check existing issues before opening a duplicate.
2. Create a focused branch for your change.
3. Keep changes scoped and follow the existing TypeScript/React patterns.
4. Run the type-check and production build before submitting.
5. Open a pull request with a clear summary, screenshots for UI changes, and steps to verify the change.

Please do not submit copyrighted Minecraft assets or other material unless you have the rights to share them.

## License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for the full license text.

The MIT License applies only to the original code and other material in this repository that the project maintainer has the right to license. It does not grant rights to Minecraft/Mojang/Microsoft trademarks, or to third-party assets, libraries, or content. Those remain subject to their respective owners' terms and licenses.

## Credits and trademark notice

- Built with open-source tools and libraries including React, Three.js, Vite, TypeScript, Tailwind CSS, Motion, and Lucide React.
- This is an independent fan-made project inspired by voxel sandbox gameplay.
- Minecraft is a trademark of Mojang Synergies AB. This project is not an official Minecraft product and is not affiliated with or endorsed by Mojang Studios or Microsoft.
- Any third-party assets remain the property of their respective owners and are subject to their own licenses.
