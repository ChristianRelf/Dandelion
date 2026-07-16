# Project Structure

A folder-by-folder tour. The codebase is organised by **process** first, then by **concern**.

```
dandelion/
├── electron.vite.config.ts   # Build config for main / preload / renderer
├── electron-builder.yml      # Packaging (nsis / dmg / AppImage)
├── tsconfig.*.json           # Base + Node project + Web project
├── vitest.config.ts          # Unit (node) + component (jsdom) projects
├── playwright.config.ts      # Electron e2e
├── eslint.config.mjs         # Flat ESLint config
│
├── src/
│   ├── shared/               # Imported by ALL processes — no Electron/DOM deps
│   │   ├── types/            # Domain model (Tab, Workspace, Settings, events, …)
│   │   ├── schemas/          # Zod input schemas for tRPC procedures
│   │   ├── constants/        # App metadata, commands, search engines, defaults
│   │   ├── utils/            # Pure helpers: url, calculator, units, format, id…
│   │   └── ipc/              # IPC channels, wire contract, bridge type
│   │
│   ├── main/                 # Electron MAIN process (Node)
│   │   ├── index.ts          # Entry: single-instance, lifecycle, bootstrap
│   │   ├── app/              # AppContext (DI), command executor, menu, security
│   │   ├── core/             # Logger, EventBus, paths, deepMerge
│   │   ├── storage/          # Db, migrations, typed repositories
│   │   ├── browser/          # WindowManager, SessionManager, TabManager
│   │   ├── services/         # settings, profile, workspace, history, bookmarks,
│   │   │                     #  search, omnibox, permissions, downloads, vault,
│   │   │                     #  sync, updates, extensions, privacy/, ai/
│   │   └── ipc/              # tRPC base, routers/, IPC host (transport)
│   │
│   ├── preload/              # Sandboxed contextBridge (main ↔ renderer)
│   │   └── index.ts
│   │
│   └── renderer/             # React CHROME (DOM)
│       ├── index.html
│       ├── main.tsx          # React root
│       ├── App.tsx           # AppProvider + Chrome
│       ├── env.d.ts          # Vite/asset ambient types
│       ├── styles/           # Tailwind v4 design tokens (globals.css)
│       ├── lib/              # trpc client + link, events, theme, commands, cn
│       ├── stores/           # Zustand: browser, ui, downloads
│       ├── hooks/            # useBrowser selectors
│       ├── providers/        # AppProvider (bootstrap + event bridge)
│       ├── components/
│       │   ├── ui/           # IconButton, Tooltip, Switch, Slider, Favicon, Icon…
│       │   ├── brand/        # DandelionMark logo
│       │   ├── chrome/       # TitleBar, Sidebar, Tabs, Toolbar, ContentArea…
│       │   ├── omnibox/      # Omnibox
│       │   ├── palette/      # CommandPalette
│       │   └── ai/           # AiSidebar
│       └── pages/            # Internal dandelion:// pages + PageShell
│
├── tests/
│   ├── unit/                 # Vitest: url, calculator, units, format, merge, block-engine
│   ├── integration/          # Vitest + Testing Library component tests
│   ├── e2e/                  # Playwright Electron testsThat backend map is exactly what I needed. Key facts: tab groups, drag/reorder, tab-switcher, tab-capture (hover previews), and downloads pause/resume all have full backend support (renderer-only work); split view is partial (renderer must track state locally, activate clears split); per-site zoom and reader mode need new main-process procs. I'll sequence accordingly once the services map lands.

Let me finish the AppProvider body — primitive accent selector, live system-theme, and mount the toast viewport:

Edit c:\Users\chris\Desktop\dandilion\src\renderer\providers\AppProvider.tsx
Added 10 lines

│   └── setup/                # jsdom test setup
│
└── docs/                     # This documentation
```

## Design rules the structure enforces

- **`shared` is dependency-free of Electron and the DOM.** It can be imported anywhere and unit
  tested in plain Node. Pure logic (URL classification, the calculator, unit conversion) lives here
  so it is trivially testable.
- **Services never touch SQL.** They depend on the `Repositories` aggregate; repositories own all
  SQL and row↔object mapping.
- **The renderer never imports main-process _values_** — only the `AppRouter` _type_, which is erased
  at build time. All calls go through the typed tRPC client.
- **One concern per file, one export barrel per folder.** Feature pages, chrome components and
  services are small and single-purpose.
- **The command registry, search engines, default settings and keybindings are data**, declared once
  in `shared/constants` and consumed by both processes.
