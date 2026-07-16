# Dandelion — Things Left To Do

Status: the product-polish + feature pass is complete and green (typecheck node+web, lint 0 warnings, 35 unit tests, production build, clean cold boot). This file tracks what remains — known limitations of shipped features, deferred work, and gaps in testing/docs.

Priorities: **P1** = should do before a public release · **P2** = noticeable / worth doing · **P3** = polish / nice-to-have.

---

## Known limitations of shipped features

### Reader mode

- [ ] **P2** Extraction is a heuristic (best-container + block walk in [tab-manager.ts](../src/main/browser/tab-manager.ts) `getReaderContent`). Swap in a real Readability pass for reliable article boundaries.
- [ ] **P3** Images with relative `src` can fail to load in the reader (no `<base>`/URL resolution).
- [ ] **P3** No per-site "always use reader" preference; reader closes on navigation by design.

### Per-site zoom

- [ ] **P2** Relies on Chromium's per-host session persistence — zoom is **not** persisted to the DB across app restarts. Add an origin→level store applied on `did-navigate`.
- [ ] **P3** The toolbar zoom % is queried when the popover opens ([ZoomControl.tsx](../src/renderer/components/chrome/ZoomControl.tsx)), not reactive. Add a `Tab.zoomFactor` field updated on `zoom-changed` for a live indicator.

### Split view

- [ ] **P1** `splitTabIds`/orientation are not in `WindowState` or any event, so the renderer mirrors split state locally ([ui.store.ts](../src/renderer/stores/ui.store.ts) `splitTabIds`). Serialize them so split survives reloads and is observable.
- [ ] **P2** Panes are always divided equally — `SplitViewLayout.sizes` is declared but unused. Add draggable pane dividers + a `setSplitSizes` proc.
- [ ] **P2** `TabManager.activate()` clears the split server-side, so activating any non-split tab exits split. Intended, but revisit for a "keep split while switching" UX.
- [ ] **P3** Split only supports 2 tabs from the UI; backend accepts N.

### Tab hover previews

- [ ] **P3** `tabs.capture` only succeeds for materialized (non-asleep, non-internal) tabs; others show a fallback glyph.
- [ ] **P3** No capture caching/throttling — each hover re-captures. Cache by tab + invalidate on `tab:updated`.
- [ ] **P3** Previews are wired for the vertical sidebar only, not the horizontal strip.

### Tab groups

- [ ] **P2** No drag-a-tab-into-a-group (assignment is via the context menu "Add to group…").
- [ ] **P2** No group reorder (`TabGroup.index` exists but no proc/UI).
- [ ] **P3** Drag reorder is enabled for the ungrouped section; pinned/grouped rows aren't reorderable by drag yet.

### Saved sessions

- [ ] **P2** Restore recreates tabs into their original/active workspace but does not restore window bounds, tab layout, groups, or pinned state precisely ([app-context.ts](../src/main/app/app-context.ts) `restoreSession`).
- [ ] **P3** Sessions aren't user-nameable; the list title is derived from the lead tab. Add a `name` column + rename.

### Extensions on/off

- [ ] **P2** The disabled set is in-memory ([extensions.service.ts](../src/main/services/extensions.service.ts) `disabled` map) — consistent with the fact that extensions currently aren't reloaded on app start at all. Persist loaded extension paths + enabled state and reload on boot.

### AI assistant

- [ ] **P2** Conversation persists only in-session (in [ai.store.ts](../src/renderer/stores/ai.store.ts)), not to disk. Add a conversations repo + `ai.conversations.*` for history across restarts.
- [ ] **P2** `ai.pageAction` (summarise/explain/translate) ignores the model picker and uses the provider's first model.
- [ ] **P3** Responses render as plain text (`whitespace-pre-wrap`) — no markdown/code formatting.
- [ ] **P3** Single conversation only (no threads); no per-message copy/regenerate.

### Cross-window

- [ ] **P2** Dragging a tab to another window isn't supported — `moveTabInput.windowId` is dropped by the router; only internal `reparent()` exists.

### Workspaces

- [ ] **P3** `WorkspaceWallpaper` exists in the type but has no UI — per-space theming is accent-only. Add a wallpaper (color/gradient/image) picker.

---

## Bugs

Bugs live in [BUGS.md](BUGS.md) — this file tracks work that hasn't been built yet, not defects
against what has.

---

## Testing

- [ ] **P1** Re-run the Playwright e2e suite against a **throwaway/fixture profile** (it currently drives the live user profile and would add test tabs). Add a `DANDELION_USER_DATA` override or a temp `--user-data-dir` for tests.
- [ ] **P1** Unit tests for the new backend logic: reader extraction shape, `restoreSession`, `extensions.setEnabled`, tab-group CRUD, zoom percent mapping.
- [ ] **P2** Store tests: `ai.store` (streaming reducer, error path), `reader.store`, `tab-preview.store`, `toast.store`, `useAsyncData` (race/stale-response handling).
- [ ] **P2** Component/integration tests for the new primitives (`Button`, `Select`, `SegmentedControl`, `List`, `EmptyState`, `ConfirmDialog`).
- [ ] **P3** e2e flows for the new features: reader toggle, split view, tab switcher, saved sessions, settings search.

---

## Documentation

- [ ] **P2** Update [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) with the chrome-over-content occlusion model (dimmed overlays vs. content top-inset) and the reader/split/zoom/sessions subsystems.
- [ ] **P2** Document the design system (the `components/ui/*` primitives, tokens, `useAsyncData`) — a short "Design System" section or `docs/DESIGN_SYSTEM.md`.
- [ ] **P3** Update [docs/PROJECT_STRUCTURE.md](../docs/PROJECT_STRUCTURE.md) for the new files (reader/, sessions/, ai.store, reader.store, tab-preview.store, toast.store, etc.) and the new commands (`view.readerMode`, `view.splitView`, `tab.search`, `tools.sessions`, `tools.saveSession`).
- [ ] **P3** Add a keyboard-shortcuts reference (the command registry in [commands.ts](../src/shared/constants/commands.ts) is the source of truth).

---

## Performance

- [ ] **P2** The renderer bundle is ~2.3 MB because [Icon.tsx](../src/renderer/components/ui/Icon.tsx) imports the entire lucide `icons` set. Fine for a local Electron app, but switch to a curated map or `lucide-react/dynamic` to shrink it.
- [ ] **P3** Virtualize long lists (history/bookmarks) with `@tanstack/react-virtual` (already a dependency) once datasets grow large.
- [ ] **P3** `selectOrderedTabs` re-sorts on every store mutation; memoize per `(tabs, activeWorkspaceId)` if tab counts get very high.

---

## Accessibility

- [ ] **P2** Tabs use `tabIndex=0` on every row (reachable + operable). Upgrade to **roving tabindex** with Up/Down arrow navigation for a single tab stop per strip.
- [ ] **P3** Full screen-reader pass (NVDA/VoiceOver) over the new overlays (reader, sessions dialog, zoom popover, tab switcher).
- [ ] **P3** Verify colour contrast of the accent-on-surface combinations in light mode; add a high-contrast theme option.

---

## Larger architectural items (original spec, still stubs by design)

- [ ] Sync is local-only (`LocalSyncProvider`); a real sync backend + E2E-encrypted transport is unimplemented.
- [ ] AI requires user-supplied API keys (no keys shipped, by design).
- [ ] Certificate viewer, deeper cookie manager, and fingerprint-protection specifics are partial relative to the original spec.
