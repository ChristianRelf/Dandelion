# Dandelion — Things Left To Do

Status: the product-polish + feature pass is complete and green (typecheck node+web, lint 0 warnings, 35 unit tests, production build, clean cold boot). This file tracks what remains — known limitations of shipped features, deferred work, and gaps in testing/docs.

Priorities: **P1** = should do before a public release · **P2** = noticeable / worth doing · **P3** = polish / nice-to-have.

---

## Known limitations of shipped features

### Reader mode

- [ ] **P2** Extraction is a heuristic (best-container + block walk in [tab-manager.ts](../src/main/browser/tab-manager.ts) `getReaderContent`). Swap in a real Readability pass for reliable article boundaries.
- [ ] **P3** Images with relative `src` can fail to load in the reader (no `<base>`/URL resolution).
- [ ] **P3** No per-site "always use reader" preference; reader closes on navigation by design.

### Omnibox result actions

- [ ] **P3** The hover actions are mouse-only and `aria-hidden`. Interactive children of a
      `role="option"` are unreachable anyway — focus stays in the field and selection runs through
      `aria-activedescendant` — so exposing them would only fold their labels into every option's
      announced name. `Ctrl+Enter` and `Shift+Delete` are the keyboard paths, matching Chrome;
      copying a _link_ has none, because `Ctrl+Shift+C` never arrives (Chromium claims it for
      inspect-element before the page sees the keydown). A command-palette-style action menu on the
      selected row would close this properly.
- [ ] **P3** `openTab` results carry no `url` (only `tabId`), so they offer no copy action. Giving
      them one would collapse them with the history/bookmark result for the same URL in `finalize`'s
      dedupe — `openTab` scores 0.9 and would win — which is a ranking change, not a copy button.

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

- [ ] **P2** Dragging a tab to another window isn't supported — `moveTabInput.windowId` is dropped by
      the router, and there is no longer any mechanism behind it: `reparent()` was removed in v0.2.2a
      once window-scoped restore stopped needing it (it was the tab-theft vector). Moving a tab
      between windows means detaching its `WebContentsView` from one `BrowserWindow`'s `contentView`
      and adding it to the other's, then reassigning `Tab.windowId` — ~15 lines, but it should arrive
      with the drag UX that justifies it rather than sit unused.

### Workspaces

- [ ] **P3** `WorkspaceWallpaper` exists in the type but has no UI — per-space theming is accent-only. Add a wallpaper (color/gradient/image) picker.

---

## Settings the UI offers but nothing implements

Found during the v0.2.1 audit. These are recorded here rather than in [BUGS.md](BUGS.md) because
nothing is broken against what exists — the backing feature was never built. They are listed
together because the honest options are the same for each: **build it, or stop advertising it.**

- [ ] **P1** **Auto-sleep never runs.** Settings → Tabs offers "Sleep inactive tabs" (default **on**)
      and a "Sleep after — 30 min" slider described as _"Free memory from tabs you haven't used in a
      while."_ Nothing in `src/main/` ever reads `tabs.sleepEnabled` or `tabs.sleepAfterMinutes`;
      there is no timer. `TabManager.sleep()` is only ever called manually (`tab.sleep`, the context
      menu). `tabs.sleepPinnedTabs` _is_ read, which makes the feature look wired and suggests the
      driving sweep was simply never added. Needs an interval over `lastActiveAt` calling the
      existing `sleep()`. The split-pane guard it depends on was fixed in v0.2.1.
- [ ] **P2** `security.safeBrowsing` and `security.isolateSites` render as live toggles and are read
      nowhere in the main process.
- [ ] **P3** `privacy.httpsOnlyMode`, `security.safeBrowsingLevel` and `security.warnOnInsecureForms`
      exist in the schema, defaults and types with neither a consumer nor any UI.
- [ ] **P3** `behavior.newTabPage` is honoured by `TabManager` but has no Settings row — it can only
      ever be the default. (`behavior.homePage` gained one in v0.2.1; this is its sibling.)

---

## Built, but nothing consumes it

- [ ] **P2** **`history_visits` is write-only.** `recordVisit()` inserts a row per navigation — with
      `visited_at`, `transition`, `referrer_visit_id`, `duration_ms` — and **no query anywhere reads
      the table**. It carries an index that grows with it. Retention now bounds it (v0.2.2f: entries
      prune at 90 days and visits follow via `ON DELETE CASCADE`), so it is no longer unbounded
      growth, but it is still a per-navigation write nothing consumes. Not dead code so much as an
      unbuilt consumer — and the consumer is worth building: the History page groups by
      `history_entries.last_visited_at`, which holds **one row per URL**, so a site visited on Monday
      and Friday appears only under Friday. Chrome shows it under both, because Chrome reads its
      visits table. Building that view is the honest resolution; dropping the table is the other, and
      loses the transition/referrer data permanently. Decide before the table gets larger.

## Latent, not currently reachable

- [ ] **P3** `wireWebContents` captures `profile` in a closure at materialise time
      ([tab-manager.ts](../src/main/browser/tab-manager.ts)), so `move()`ing a tab across workspaces
      would keep recording history under the **old** profile. The IPC surface exposes it
      (`moveTabInput` carries `workspaceId`) but no UI caller passes it, so it cannot be hit today.
      Fix before wiring any cross-workspace tab move.

---

## Bugs

Bugs live in [BUGS.md](BUGS.md) — this file tracks work that hasn't been built yet, not defects
against what has. Fixed ones move to [BUGS-FIXED.md](BUGS-FIXED.md).

---

## Testing

- [ ] **P1** **`AppContext` is not constructible in a test**, so nothing in it can be unit tested —
      `saveSession`, `restoreSession` and the session-snapshot trigger all went out on v0.2.2b
      verified by tracing rather than by a test, which is exactly how the empty-snapshot P1 survived
      in the first place. The constructor `new Db(databasePath())`s and builds every service eagerly,
      so a test cannot inject a temp database or fake the window/tab managers. Take `Db` (or a
      `paths` seam) as a constructor argument and the whole composition root becomes testable. This
      is the single highest-leverage testing gap in the repo.
- [ ] **P1** Re-run the Playwright e2e suite against a **throwaway/fixture profile** (it currently drives the live user profile and would add test tabs). **No code change is needed:** `paths.ts` reads `app.getPath('userData')` without overriding it, so Electron's own `--user-data-dir` switch redirects the whole profile. Verified during the v0.2.1 audit by driving the built app with `electron.launch({ args: [APP, '--user-data-dir=<mkdtemp>'] })`. Add it to `app.spec.ts`'s launch args.
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
