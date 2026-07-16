# Developer Guide

## Prerequisites

- **Node.js ≥ 20** (developed on Node 24).
- A C/C++ toolchain for the one native module (`better-sqlite3`):
  - **Windows:** Visual Studio Build Tools (Desktop C++), or `npm i -g windows-build-tools`.
  - **macOS:** Xcode Command Line Tools.
  - **Linux:** `build-essential` + `python3`.

## First run

```bash
npm install
npm run rebuild      # compiles better-sqlite3 for Electron's ABI (not Node's)
npm run dev
```

`npm run rebuild` is required because `better-sqlite3` ships a Node-ABI prebuild, but it runs inside
Electron, which has a different ABI. We keep it out of `postinstall` so a missing toolchain never
aborts `npm install`.

### The `ELECTRON_RUN_AS_NODE` gotcha

Some sandboxes/CI export `ELECTRON_RUN_AS_NODE=1`, which makes `electron.exe` behave as a plain Node
runtime — `require('electron')` returns a path string, `app` is `undefined`, and **no window
appears**. If the app won't launch, clear the variable for that command:

```bash
env -u ELECTRON_RUN_AS_NODE npm run dev     # macOS/Linux/Git-Bash
```

```powershell
Remove-Item Env:ELECTRON_RUN_AS_NODE; npm run dev   # PowerShell
```

A normal desktop environment is unaffected.

## Project layout

`src/` is split by process; see [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md).

- **`src/shared`** — types, Zod schemas, constants and pure utilities imported by every process.
- **`src/main`** — the Electron main process (browser engine, services, storage, tRPC host).
- **`src/preload`** — the sandboxed contextBridge.
- **`src/renderer`** — the React chrome.

Path aliases (`@shared`, `@main`, `@preload`, `@renderer`, `@`) are defined once in
`tsconfig.base.json` and mirrored in `electron.vite.config.ts` and `vitest.config.ts`.

## Common tasks

### Type-check / lint / format

```bash
npm run typecheck      # tsc for the Node and Web projects
npm run lint           # eslint
npm run format         # prettier --write
```

The build splits into two TypeScript projects because the main process targets Node libs and the
renderer targets DOM libs. Keep both green.

### Tests

```bash
npm test               # Vitest: pure logic (node) + components (jsdom)
npm run test:e2e       # Playwright drives the built Electron app
```

`better-sqlite3` is compiled for Electron, so Vitest (plain Node) cannot load it. Unit tests
therefore cover the pure layers (utils, block engine, merge) and the storage layer is exercised by
the Playwright e2e against the real app.

## Adding a feature

### A new tRPC procedure

1. Add an input schema in `src/shared/schemas/*.schema.ts` (Zod).
2. Add the procedure to the relevant router in `src/main/ipc/routers/*.router.ts`, calling into a
   service via `ctx.app.<service>`.
3. Call it from the renderer with full typing: `await trpc.<namespace>.<proc>.query|mutate(input)`.

### A new service

1. Create `src/main/services/<name>.service.ts` depending only on `Repositories`, `EventBus`,
   `SettingsService` and a `Logger` child.
2. Construct it in `src/main/app/app-context.ts` in dependency order and expose it as a field.
3. Wire a router and, if it needs to push state, publish `BrowserEvent`s to the `EventBus` (add the
   event to `src/shared/types/events.ts`).

### A new internal page

1. Add the URL to `INTERNAL_PAGES` in `src/shared/constants/internal-pages.ts`.
2. Build the page under `src/renderer/pages` and route it in `pages/InternalPage.tsx`.
3. Navigate to it with `openInternalPage(INTERNAL_PAGES.<key>)` or a command.

## Debugging

- **Chrome (React UI) DevTools:** `⌘/Ctrl+Alt+I`.
- **Web page DevTools:** `⌘/Ctrl+Shift+I` (acts on the focused tab).
- Main-process logs are structured and scoped (`dandelion:tabs`, `dandelion:privacy`, …). Set
  `NODE_ENV=development` for debug-level logs (electron-vite does this in `dev`).

## Packaging

```bash
npm run dist           # electron-builder → dist/ (nsis / dmg / AppImage)
```

Native modules are unpacked from the asar (`asarUnpack` in `electron-builder.yml`) so Electron can
`dlopen` the `.node` binary at runtime.
