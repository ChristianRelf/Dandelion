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

### P3 · Confirmed · The shield counts third-party requests, not blocked cookies

Found while fixing the two cookie defects above in v0.2.3, and deliberately left alone there: the
`onBeforeSendHeaders` half bumps `thirdPartyCookies` whenever `shouldStripCookies` says yes —
**regardless of whether a `Cookie` header was present**. A page with 50 third-party images reports
"50 third-party cookies blocked" when zero cookies existed. The `onHeadersReceived` half added in
v0.2.3 only counts a real removal, so the two halves now disagree about what the number means.

Cosmetic (the number is only ever shown in the shield popover) but it inflates the one figure that
tells the user the feature is working. The fix is to bump only when a header was actually deleted,
which makes both halves count the same thing; it was left out of v0.2.3 to keep a security fix from
quietly changing a user-visible number.

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

## Chrome & UI

### P2 · Confirmed · The rounded content frame doesn't clip the native `WebContentsView`

Web pages render square-cornered inside the rounded frame
([ContentArea.tsx](../src/renderer/components/chrome/ContentArea.tsx)). Round the native view in the
main process, or accept and document it.

### P3 · Suspected · Active tab pill keeps light styling after switching to dark

Switching Theme → Dark left the active tab pill rendered light while the rest of the chrome went dark;
a later capture (after tabs re-rendered) showed it correctly dark. `data-theme` flips on `<html>` and
the body background updates immediately, so this looks like the tab row not restyling until it
re-renders — but it was seen in a screenshot mid-session and has not been isolated. Reproduce before
fixing; it may just be the theme transition animation.

## Commands

- **P3** `tools.clearBrowsingData` opens Settings instead of a dedicated "Clear browsing data" dialog
  (a `privacy.clearData` dialog with time-range + category checkboxes). The **categories** are fully
  backed by `privacy.clearData`; the **time range** is not, and cannot simply be plumbed through:
  - `clearDataInput` ([privacy.schema.ts](../src/shared/schemas/privacy.schema.ts)) already declares
    `since`, and [privacy.router.ts](../src/main/ipc/routers/privacy.router.ts) destructures only
    `{ options }` — so `since` is **accepted and silently ignored** today. A dialog that sends it
    would inherit that lie.
  - Only history could honour it (`history.repo.deleteRange` exists). Electron's session API has no
    time-filtered clearing at all: `clearStorageData({ storages })` and `clearCache()` are
    all-or-nothing, so cookies/cache/storage would ignore the range whatever the UI says.

  So it needs a product decision before it is built — either drop the range, or scope it to history
  and say so in the dialog. Deleting more than the user asked for is the failure mode to avoid.

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
