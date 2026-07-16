# 🌼 Dandelion

**A fast, private, beautiful desktop web browser** built on Electron, React 19 and TypeScript.
Workspaces, split view, a Raycast-style command palette, a local-first privacy engine, an
encrypted password vault and a pluggable AI assistant — wrapped in a dark, glassy, handcrafted UI
inspired by Arc, Zen, Safari, Linear and Raycast.

> Status: **working developer preview**. The full browser boots, renders web pages in isolated
> `WebContentsView` tabs, blocks trackers, and drives every feature through a fully-typed
> tRPC-over-IPC bridge.

---

## Highlights

- **Real browser architecture** — the React app renders only the _chrome_; each tab is an isolated
  `WebContentsView` (the modern successor to `BrowserView`) with its own process and session.
- **Workspaces & profiles** — Arc-style "spaces" for organising tabs, on top of profiles that are
  the true storage/security boundary (separate cookie jars, passwords, permissions, extensions).
- **Vertical & horizontal tabs** — pinned, sleeping, grouped, drag-reordered, muteable, duplicable,
  with split view, previews and recently-closed restore.
- **Omnibox** — URLs, search, history, bookmarks, open-tab switching, an offline calculator and unit
  converter, quick actions and live search suggestions, with inline autocomplete.
- **Command palette** (`⌘K`) — every command and open tab, fuzzy-searchable, Raycast-style.
- **Privacy engine** — request-level ad/tracker/fingerprinter blocking, HTTPS upgrades, DNT/GPC
  headers and third-party-cookie stripping, with a per-tab shield report.
- **Encrypted vault** — AES-256-GCM credentials under a scrypt-stretched master password, with a
  password generator and auto-lock. Keys never touch disk in plaintext.
- **AI assistant** — provider architecture for OpenAI / Anthropic / Google / local models with
  streaming chat and page summarise/explain/translate. No API keys ship with the app.
- **Everything else** — downloads with pause/resume/speed graphs, a searchable settings page,
  history timeline, bookmark import/export, site permissions, cookie manager, Manifest-V3 extension
  loading, secure DNS, incognito windows, and rebindable keyboard shortcuts.

## Quick start

```bash
npm install          # install dependencies
npm run rebuild      # rebuild better-sqlite3 for Electron's ABI (once, after install)
npm run dev          # launch the browser with hot reload
```

> **Sandbox note:** some CI/sandbox environments export `ELECTRON_RUN_AS_NODE=1`, which turns
> Electron into a plain Node runtime (no window). If the app doesn't open, launch with
> `env -u ELECTRON_RUN_AS_NODE npm run dev`. A normal desktop is unaffected.

### Scripts

| Script                    | Description                                          |
| ------------------------- | ---------------------------------------------------- |
| `npm run dev`             | Launch with hot-reloading main, preload and renderer |
| `npm run build`           | Type-safe production bundle (`out/`)                 |
| `npm run rebuild`         | Rebuild native modules against Electron              |
| `npm run typecheck`       | Type-check the Node and Web projects                 |
| `npm run lint` / `format` | ESLint / Prettier                                    |
| `npm test`                | Vitest unit + component tests                        |
| `npm run test:e2e`        | Playwright end-to-end (builds first)                 |
| `npm run dist`            | Package installers with electron-builder             |

## Tech stack

Electron 43 · React 19 · TypeScript 5.9 · Vite 7 / electron-vite · Tailwind CSS v4 · Motion ·
Zustand 5 · tRPC 11 · Zod 4 · better-sqlite3 · Vitest 4 · Playwright · ESLint · Prettier.

## Architecture at a glance

```
┌─────────────────────────────────────────────────────────────┐
│ MAIN PROCESS (Node) — the "browser process"                  │
│  AppContext (DI) · WindowManager · TabManager (WebContentsView)│
│  SessionManager · SQLite + repositories · services · tRPC host│
└───────────────┬───────────────────────────┬─────────────────┘
     contextBridge (preload)          attaches N views
   ┌────────────▼───────────┐   ┌────────────▼─────────────────┐
   │ RENDERER (React chrome)│   │ WebContentsView per tab       │
   │ titlebar·tabs·omnibox  │   │ (isolated, sandboxed, own     │
   │ sidebar·palette·pages  │   │  session partition)           │
   └────────────────────────┘   └──────────────────────────────┘
```

Communication is a fully-typed **tRPC-over-Electron-IPC** bridge (a custom link — no fragile
third-party adapter) plus a typed event channel for main → renderer push.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the deep dive, and
[`docs/PROJECT_STRUCTURE.md`](docs/PROJECT_STRUCTURE.md) for a folder-by-folder tour.

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — process model, entity model, every subsystem
- [Developer guide](docs/DEVELOPER.md) — setup, workflows, adding features, debugging
- [Project structure](docs/PROJECT_STRUCTURE.md) — what lives where and why
- [Contributing](CONTRIBUTING.md) — conventions and the review checklist

## Security model

- Context isolation and sandbox on for both the chrome and every web tab.
- The chrome window cannot navigate to external content or open OS windows.
- Per-profile Electron session partitions isolate cookies, cache and storage.
- Passwords are sealed with AES-256-GCM under a scrypt-derived key; the data key exists in memory
  only while unlocked and is zeroed on lock.
- API keys are encrypted with the OS keychain via Electron `safeStorage`.

## License

Dandelion is free software: you may use, study, share and modify it under the terms of the
**GNU General Public License v3.0 or later**. Derivatives must remain under the same license, so
the browser and its forks stay open. See [LICENSE](LICENSE) for the full text.

Copyright © 2026 Christian Relf.
