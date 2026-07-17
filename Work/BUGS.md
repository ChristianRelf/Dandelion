# Dandelion — Known Bugs

Defects found while auditing the browser. A bug here is something **broken against what already
exists** — not work that hasn't been built yet. Planned features live in [TODO.md](TODO.md), and
defects that have been fixed move to [BUGS-FIXED.md](BUGS-FIXED.md).

Priorities: **P1** = fix before a public release · **P2** = noticeable / worth fixing · **P3** =
rough edge.

Status: **Confirmed** = traced to the code path that causes it · **Suspected** = observed once, not
yet isolated.

---

## Security & privacy

### P2 · Confirmed · The reader's inline images are still fetched by the chrome

Favicons were routed through the profile's session in v0.2.2f — but
[ReaderView.tsx](../src/renderer/components/reader/ReaderView.tsx) still renders `<img src={block.src}>`
for a page's own images, and the chrome has no session, so those land in the **default session**: a
persistent, on-disk jar shared by every profile including private ones, with none of the privacy
engine's filters attached.

Narrower than the favicon leak was — it needs reader mode to be open on a page with images, where
favicons were fetched for every tab and every history row — but it is the same defect and the same
fix. Route them through `dandelion-favicon:` (renaming it to something that isn't favicon-specific),
and `https:` can then come out of the chrome's `img-src` altogether, which is what makes the routing
enforceable rather than merely intended.

### P3 · Confirmed · tRPC procedure lookup walks `Object.prototype`

[ipc-host.ts](../src/main/ipc/ipc-host.ts) resolves `op.path` by walking properties and guards only
with `typeof target !== 'function'`. Inherited members satisfy it: `"constructor"` resolves to
`Object`, `"__proto__.constructor.constructor"` to `Function`. **Not exploitable** — the result is
only ever called with one superjson value and never eval'd, and it is reachable only from the trusted
chrome renderer. Robustness, not a vulnerability. Resolve with `Object.hasOwn` per segment, or match
against a flattened procedure allowlist.

### P3 · Confirmed · Third-party cookie shield fails open on every multi-part TLD

`rootDomain` ([url.ts](../src/shared/utils/url.ts)) takes the last two labels unconditionally, with
no public-suffix list in the repo. `bbc.co.uk` and `tracker.co.uk` both reduce to `co.uk`, so
`isThirdParty` returns `false` and [third-party.ts](../src/main/services/privacy/third-party.ts)
declines to strip. The comment marks it "best-effort … for grouping", but a privacy decision now
depends on it. On any `.co.uk` / `.com.au` / `.co.jp` page, genuinely third-party requests keep their
cookies. Fails open, so nothing breaks visibly — the feature just doesn't do what it claims for a
large slice of the web.

### P2 · Confirmed · Third-party cookies are stored, only never sent

The same feature deletes the `Cookie` **request** header but there is no `onHeadersReceived`, so
`Set-Cookie` still lands and `document.cookie` is untouched. Third-party cookies are therefore still
written to disk — the feature does not deliver the privacy it advertises in the README and settings
UI. Either strip `Set-Cookie` too, or narrow the claim.

## Downloads

### P2 · Confirmed · Downloads restored from disk present live controls that do nothing, silently

`toDownload` derives affordances from persisted state (`canResume: state === 'paused' || state ===
'interrupted'`), but `pause`/`resume`/`cancel` act only through `this.live`, populated exclusively by
`handleWillDownload`. After a restart `live` is empty, so every mutator is a no-op lookup
(`this.live.get(id)?.item.pause()`). The router returns `true` unconditionally, so the renderer's
`.catch(() => toast.error(...))` **never fires** — the error path is dead code.

Compounding it, a download interrupted by the app quitting stays `in_progress` **forever**: nothing
reconciles orphaned rows at boot. `isActive()` keeps it in the active list with a frozen progress
bar, and `clearCompleted` filters `state IN ('completed','cancelled')` — so neither "Clear completed"
nor "Clear browsing data → downloads" will remove it. Only "Remove from list" does.

**Reproduction.** Start a large download, quit mid-transfer, relaunch, open Downloads: a permanently
"downloading" row with an enabled Pause/Cancel that do nothing at all, with no feedback.

### P3 · Confirmed · Every progress tick does an unthrottled synchronous write + read-back

`item.on('updated', ...)` is unthrottled, and the `elapsed >= 1` guard inside `onUpdated` gates
**only** the speed/ETA sample — not persistence. Every event runs an `UPDATE` followed by a `SELECT`
read-back to build the event payload, both synchronous better-sqlite3 calls on the main process.
`LIMITS.downloadSampleMs` ("Download speed sampling window, ms") is **never referenced anywhere** —
the intended window was never wired to the write path. The read-back is also avoidable: the service
already holds every field it just wrote.

## History & storage

### P2 · Confirmed · The omnibox full-scans and sorts all history on every keystroke

[history.repo.ts](../src/main/storage/repositories/history.repo.ts) orders by a **computed
expression** (`visit_count * 2 + typed_count * 5`), which no index can satisfy, and the `OR title LIKE
@prefix` disjunction defeats any prefix range-scan on the `UNIQUE(profile_id, url)` index. SQLite
scans every row for the profile, evaluates the expression per row, and builds a temp B-tree — to
`LIMIT 4`. It runs **synchronously on the main process per keystroke** (90 ms debounce).
`topSites()` is correctly served by `idx_history_visits`; only `prefixMatch` is affected.

Downgraded from the original finding: it was unbounded only because retention never ran, which was
fixed in v0.2.2f. It is now bounded by the retention window rather than by the age of the install —
still a full scan, but of 90 days of history instead of all of it.

The real fix is a **stored generated column** for the score plus an index on `(profile_id, rank DESC,
last_visited_at DESC)`, so SQLite walks the index in order and stops at `LIMIT 4` instead of sorting
everything. That needs a migration, which is why it is not folded into the retention fix.

### P3 · Confirmed · `LIKE` wildcards in search input are not escaped

`` like: `%${params.query}%` `` interpolates raw input into a `LIKE` pattern with no `ESCAPE` clause
(`history.repo.ts`, `bookmarks.repo.ts`). Values **are** bound as parameters — there is no SQL
injection — but `%` and `_` stay wildcards. Searching history for `50%` matches every entry
containing "50"; searching `_` matches every non-empty row.

## Chrome & UI

### P2 · Confirmed · Tab escapes the command palette and tab switcher, then Escape stops working

Both are hand-rolled `motion.div` overlays wrapping cmdk's plain `<Command>`. cmdk handles only
ArrowDown/ArrowUp/Enter — it does not trap Tab. It ships a Radix-backed `Command.Dialog`, which
neither component uses. The `fixed inset-0` overlay blocks pointer events only; the chrome behind
stays in the tab order (not `inert`, not `aria-hidden`). Neither has `role="dialog"`, `aria-modal`, or
focus restore on close.

**Reproduction.** Open `⌘K` → press Tab → focus lands on a Toolbar button behind the overlay. Now
press Escape: the handler is `onKeyDown` on the palette's own inner div, so the event never reaches it
and **the palette cannot be closed by keyboard**. Mouse users are fine (`onMouseDown={close}`).

A defect rather than unbuilt work: the sibling `Omnibox` — same overlay pattern — deliberately traps
Tab and restores focus on close, and the Radix dialogs are trapped correctly. These two are the
outliers.

### P2 · Confirmed · The rounded content frame doesn't clip the native `WebContentsView`

Web pages render square-cornered inside the rounded frame
([ContentArea.tsx](../src/renderer/components/chrome/ContentArea.tsx)). Round the native view in the
main process, or accept and document it.

### P3 · Confirmed · TitleBar tooltips advertise the wrong modifier

[TitleBar.tsx](../src/renderer/components/chrome/TitleBar.tsx) uses `⌃` (U+2303, Control) for both,
but `view.toggleSidebar` is `CmdOrCtrl+B` and `tools.aiSidebar` is `CmdOrCtrl+/`. Every other tooltip
uses `⌘` for CmdOrCtrl, as does `acceleratorLabel`. On macOS the tooltips claim Ctrl+B / Ctrl+/; the
real bindings are ⌘B / ⌘/.

### P3 · Suspected · Active tab pill keeps light styling after switching to dark

Switching Theme → Dark left the active tab pill rendered light while the rest of the chrome went dark;
a later capture (after tabs re-rendered) showed it correctly dark. `data-theme` flips on `<html>` and
the body background updates immediately, so this looks like the tab row not restyling until it
re-renders — but it was seen in a screenshot mid-session and has not been isolated. Reproduce before
fixing; it may just be the theme transition animation.

## Commands

- **P2** `tools.print` (⌘P) forwards to the renderer but has no handler → a dead command. Add a
  main-side `webContents.print()` proc.
- **P3** `tools.clearBrowsingData` opens Settings instead of a dedicated "Clear browsing data" dialog
  (a `privacy.clearData` dialog with time-range + category checkboxes).
- **P3** `downloads.start` accepts a `savePath` that is ignored by `startOnSession`.
- **P3** Permissions support "allow once" vs "always" but there's no durable "allow for this session"
  scope (would need a session-scoped grant map + `expiresAt`/`scope` on `SitePermissionRule`).

---

## Not a bug

Recorded so they are not re-investigated:

- **Google sign-in fails with an "embedded user-agent" error.** Deliberate on Google's side, and
  correct by their published definition — an embedded user-agent is any library that can "insert
  arbitrary scripts, alter the default routing of a request to the Google OAuth server, or access
  session cookies", and Dandelion does all three by design (reader mode, HTTPS-upgrade redirects, the
  cookie manager). Not fixable from here; switching to a Chromium fork would not change it, since
  Electron already ships real Chromium and Google's own error page names other real-Chromium
  embedders. The cookie bug above is a genuine defect found while investigating this, but it is not
  the cause.
- **The user-agent strip in `SessionManager.chromeUserAgent()` looks like a hack but is
  load-bearing.** With the stock Electron UA, Google rejects the sign-in navigation outright
  (`ERR_FAILED`). Don't "simplify" it away.
- **Renderer store races on `switchWorkspace` / `hydrate` / `downloads.load`.** `restoreWorkspace`,
  `updateStatus` and `downloads.list` are all **synchronous** resolvers, and replies plus
  `webContents.send` share one ordered IPC pipe per renderer, so main-process ordering is preserved
  and no stale response can clobber a fresh one. (This same ordering property is what makes the AI
  chunk defect above fire deterministically.)
- **StrictMode double-`bootstrap`.** `restoreWorkspace` is explicitly idempotent, and pinned by
  `tests/unit/tab-window-scope.test.ts`.
- **Missing sender validation on `IPC.trpc`.** `WebContentsView`s are created with no preload, so
  remote content has no `ipcRenderer` handle and cannot reach `ipcMain`. Not exploitable.
- **Extra bound params in `history.repo.search()`.** better-sqlite3 iterates the _statement's_ bind
  map and only errors on missing params; extra object keys are ignored. Not a bug.
- **`updateColumns` interpolates column names.** Every call site passes repo-local literals, never user
  input. Safe as documented.
- **`SearchEnginesRepository.list()[0]!`.** `remove` carries `AND is_builtin = 0`, so the six built-ins
  are undeletable and the list cannot empty.
- **`useAsyncData` races, and renderer listener leaks.** Audited: the sequence guard, mount guard and
  cleanup are all correct, and every subscription (`onBrowserEvent`, `FindBar`, `PermissionPrompt`,
  debounce timers) returns and honours its unsubscribe.
