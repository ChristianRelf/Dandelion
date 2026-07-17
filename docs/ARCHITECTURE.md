# Dandelion Architecture

This document explains how Dandelion is put together — the process model, the domain model, and
every subsystem — and how a keystroke becomes a page load.

## 1. Process model

Dandelion is a multi-process Electron application with a strict separation between the **chrome**
(the browser UI) and **web content** (the pages you visit).

```
┌───────────────────────────────────────────────────────────────────────┐
│ MAIN PROCESS (Node)                                                     │
│   AppContext (composition root / DI container)                          │
│   ├─ Db + Repositories (better-sqlite3)                                 │
│   ├─ EventBus                                                           │
│   ├─ Services: settings, profile, workspace, history, bookmarks,        │
│   │             search, omnibox, permissions, downloads, privacy,       │
│   │             vault, ai, sync, updates, extensions                    │
│   ├─ SessionManager  (per-profile Electron session partitions)          │
│   ├─ WindowManager   (frameless BrowserWindows)                         │
│   ├─ TabManager      (one WebContentsView per tab)                      │
│   └─ IPC host        (tRPC router + event forwarding)                   │
└───────────────┬───────────────────────────────────┬───────────────────┘
                │ contextBridge (sandboxed preload)   │ contentView.addChildView
   ┌────────────▼────────────────┐        ┌───────────▼──────────────────┐
   │ RENDERER — React chrome     │        │ WebContentsView per tab       │
   │ (BrowserWindow webContents) │        │ (own process, own session)    │
   │ titlebar · tabs · omnibox   │        │ renders on top of the chrome  │
   │ sidebar · palette · pages   │        │ in the content region         │
   └─────────────────────────────┘        └───────────────────────────────┘
```

The React app renders **only the chrome**. Each tab's page lives in a separate `WebContentsView`
(the modern, non-deprecated replacement for `BrowserView`). The main process owns those views and
positions the active one to cover the content region.

### Chrome-over-content and overlays

The chrome is the `BrowserWindow`'s base web layer; tab views are child views added on top of it in
the content region only, so the sidebar and toolbar are never covered. Because full-window overlays
(the omnibox, the command palette, modals) are rendered _by the chrome_ — beneath the tab views —
they would be hidden by an opaque web view. Dandelion resolves this the way Arc's command bar does:
when an overlay opens, the renderer flips a `contentHidden` flag (`layout.setContentVisible`) and the
`TabManager` hides the active view, producing the dimmed "command bar" effect. Native context menus
use Electron `Menu.popup`, which always floats above everything.

## 2. Entity model

Two concepts that overlap in Arc/Zen are given clear, separate responsibilities:

| Concept       | Responsibility                                     | Storage boundary                                                                                             |
| ------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Profile**   | The identity and **security/storage boundary**     | A dedicated Electron `session` partition → cookies, cache, local storage, passwords, permissions, extensions |
| **Workspace** | An Arc-style **"space"**: organises tabs + theming | References one profile; shares that profile's jar                                                            |

- Several workspaces may share a profile (shared cookies) or a workspace can point at its own
  profile for isolation.
- Incognito windows use a shared **private profile** whose partition is not `persist:`, so its
  storage evaporates when the app closes.
- History, bookmarks and downloads are stored once, keyed by `profileId` and optionally tagged with
  a `workspaceId` for per-space views.

The domain types live in [`src/shared/types`](../src/shared/types) and are the single source of
truth shared by all three processes.

### Windows and workspaces

A **window is a view onto a workspace**, and a workspace may be open in **several windows at once**.
Each window keeps the tabs it holds: a tab carries exactly one `windowId` and owns exactly one
`WebContentsView`, so it can only ever render in one window. Two windows on the same workspace
therefore show _different_ tabs from it, not the same ones.

That makes window scope, not workspace scope, the unit for anything driving a single window's UI —
`TabManager.listInWindow(windowId, workspaceId)`, not `listByWorkspace(workspaceId)`. The latter
spans every window and exists for workspace-wide bookkeeping (index allocation). Reading across
windows to drive one window's strip is what let `Ctrl+N` steal a live tab out of the window showing
it; the renderer mirrors the same scope by ignoring tab events for other windows.

Restoring a workspace into a window only materialises persisted tabs **no window has claimed** —
whatever is already live belongs to the window showing it. A window that opens an occupied
workspace gets a fresh tab of its own rather than adopting someone else's.

## 3. The tRPC-over-IPC bridge

Every renderer → main call is a typed tRPC procedure; there is no ad-hoc `ipcRenderer.send`.

1. The renderer calls `trpc.tabs.create.mutate(input)`.
2. A **custom tRPC link** ([`renderer/lib/trpc/link.ts`](../src/renderer/lib/trpc/link.ts))
   serialises the input with superjson and calls `window.dandelion.trpc.invoke({ type, path, input })`.
3. The sandboxed **preload** forwards it over a single `ipcRenderer.invoke` channel.
4. The **IPC host** ([`main/ipc/ipc-host.ts`](../src/main/ipc/ipc-host.ts)) builds a per-call tRPC
   caller with `{ app, windowId }` context (the window id is derived from `event.sender`), traverses
   the dotted path, runs the procedure, and returns a superjson-serialised result.

The renderer imports the router **type** (`import type { AppRouter }`) so the whole surface is typed
end-to-end; because it is a type-only import it is erased at build time and no main-process code is
bundled into the renderer.

Reactive updates flow the other way through a dedicated **event channel**: services publish
`BrowserEvent`s to the `EventBus`, the IPC host forwards them to every chrome renderer, and the
renderer's `AppProvider` narrows on `event.type` to update the correct Zustand store.

## 4. The tab engine (`TabManager`)

The [`TabManager`](../src/main/browser/tab-manager.ts) is the heart of the browser. It holds a
`Map<TabId, LiveTab>` where a live tab is `{ state, view, loaded }`.

- **Materialisation is lazy.** A tab exists as plain state immediately; its `WebContentsView` is
  created and its URL loaded only when the tab is first activated. Sleeping a tab destroys the view
  and frees its renderer process while preserving state.
- **Internal pages** (`dandelion://…`) never get a view — the renderer draws them as React pages,
  and the `TabManager` simply hides the (absent) web content.
- The view's full **navigation/media event surface** is wired to keep `Tab` state live: title,
  favicon, theme colour, loading state, can-go-back/forward, audible/muted, crashes.
- **History** is recorded on `did-navigate` (skipping internal/private).
- **Layout** — the renderer measures the content slot and reports its rect via
  `layout.setContentBounds`; the `TabManager` positions the active (or split) view to match, with
  rounded corners via `setBorderRadius` where supported.
- **Split view** positions 2+ views side-by-side across the content region.
- Tabs are **persisted** (write-through to SQLite) so a workspace restores across launches.

## 5. Sessions & the privacy engine

The [`SessionManager`](../src/main/browser/session-manager.ts) lazily creates and configures one
Electron `Session` per profile partition, applying:

- a Chrome-like user agent (Electron/app tokens stripped),
- the [`PrivacyService`](../src/main/services/privacy/privacy.service.ts) request filters,
- the permission request/check handlers, and the download handler.

The privacy engine attaches `webRequest` listeners to each session:

- **`BlockEngine`** ([`block-engine.ts`](../src/main/services/privacy/block-engine.ts)) matches a
  request's hostname (and every parent domain) against a seeded ad/tracker/fingerprinter/cryptominer
  blocklist in O(labels) time; blocked requests are cancelled and counted.
- **HTTPS upgrade** rewrites `http://` to `https://` for non-local hosts.
- **DNT / GPC** headers are injected; **third-party cookies** are stripped by comparing the request's
  registrable domain to that of the document owning its frame tree — `Cookie` on the way out and
  `Set-Cookie` on the way back, since a cookie that is never sent has no reason to be stored. A
  top-level (`mainFrame`) request is first-party by definition and is exempt from both.
  ([`third-party.ts`](../src/main/services/privacy/third-party.ts)) Registrable domains come from a
  bundled Public Suffix List ([`public-suffix.ts`](../src/main/services/privacy/public-suffix.ts));
  label counting cannot tell `bbc.co.uk` from `tracker.co.uk`. Cookies a third-party frame writes
  through `document.cookie` are out of scope: `webRequest` never sees them.
- Per-`webContents` counters feed the per-tab **shield report** shown in the UI.

## 6. The encrypted vault

[`VaultService`](../src/main/services/vault.service.ts) implements a real local password manager:

- A **master password** is stretched with **scrypt** (`N=16384`) to a key-encryption-key.
- The KEK wraps a random **256-bit data key**; the wrapped key, a salt and a verifier are stored.
- Credentials are sealed with **AES-256-GCM** under the data key.
- On unlock the KEK decrypts the verifier (constant-time compared) and unwraps the data key, which
  lives in memory only until lock/auto-lock, when it is zeroed.
- Plaintext is returned across IPC only in response to an explicit reveal/autofill request.

## 7. AI provider architecture

[`AIService`](../src/main/services/ai/ai.service.ts) registers pluggable providers (OpenAI,
Anthropic, Google, local/Ollama-compatible) behind a common `AiProvider.complete(...)` streaming
contract. Completions stream to the renderer as `ai:chunk` events. API keys are encrypted with the
OS keychain (`safeStorage`). No keys ship with the app — a provider is "configured" only once a key
is supplied. Page actions extract readable text from the active tab and fill a prompt template.

## 8. Commands & keyboard shortcuts

A single [command registry](../src/shared/constants/commands.ts) is shared by the keybinding system
and the command palette, so a shortcut and a palette entry always refer to the same action. Because
web content steals keyboard focus, shortcuts are delivered through an **application `Menu`** whose
accelerators fire even over a focused `WebContentsView`; each item calls `executeCommand`, which runs
navigation/tab/window commands directly in main and focus-and-forwards UI commands (palette, address
bar, sidebar) to the owning renderer.

## 9. Storage

[`Db`](../src/main/storage/database.ts) wraps a single WAL-mode better-sqlite3 connection with
forward-only migrations. Typed **repositories** ([`storage/repositories`](../src/main/storage/repositories))
own all SQL and map rows ↔ domain objects; services depend on the `Repositories` aggregate, never on
raw SQL. Booleans are stored as `0/1`, timestamps as millisecond integers, and JSON columns hold
structured values (tags, wallpapers, session snapshots).

## 10. Data-flow example: navigating from the omnibox

1. `⌘L` → the menu accelerator runs `executeCommand('navigation.focusAddressBar')` → main focuses the
   chrome and sends `app:command`.
2. The renderer opens the `Omnibox`, which queries `omnibox.query` on each keystroke. The
   `OmniboxService` aggregates URL/search/history/bookmark/tab/calculator/unit/action/suggestion
   results, ranked and de-duplicated.
3. Enter → `tabs.navigate` → `TabManager.navigate` materialises a `WebContentsView`, applies the
   privacy filters via the profile session, and loads the URL.
4. `did-navigate` / `page-title-updated` / `page-favicon-updated` update `Tab` state and record
   history; each change emits a `tab:updated` event that updates the renderer's tab store.
