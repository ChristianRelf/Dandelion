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

### P2 · Confirmed · Windows prompts for a passkey on any login form, and no switch turns it off

Focusing a login field on a site that opts into passkey autofill pops the native Windows Security
dialog, with no click and nothing to dismiss it permanently. Measured against a secure context on
Electron 43.1.1, WebAuthn is fully live and unguarded:

```text
isUserVerifyingPlatformAuthenticatorAvailable: true
isConditionalMediationAvailable:               true
```

The mechanism is **conditional mediation** (passkey autofill): an `autocomplete="username webauthn"`
field lets the page call `navigator.credentials.get({ mediation: 'conditional' })` without a gesture,
Chromium calls the native Windows WebAuthn API, and Windows shows the dialog. Real Chrome renders
this as a quiet autofill dropdown — that UI is Chrome's own, not Chromium's, so in Electron the
request degrades to the modal OS dialog. That is why it fires on _any_ login form rather than only
on a "Sign in with a passkey" button.

**There is no supported off-switch.** Each candidate below was measured against a deliberate
nonsense-named control, because Blink and Chromium both ignore unknown feature names **silently** —
without the control every one of these reads as a working fix while changing nothing:

| Attempt                                             | Result                           |
| --------------------------------------------------- | -------------------------------- |
| `disableBlinkFeatures: 'WebAuthentication'`         | identical to control — no effect |
| `--disable-features=WebAuthUseNativeWinApi`         | identical to control — no effect |
| `--disable-features=WebAuthenticationConditionalUI` | identical to control — no effect |
| `MadeUpControlFeature` (control)                    | identical                        |

Electron's own `app.configureWebAuthn()` is **`@platform darwin`** and takes only `touchID`; its doc
("until this is called, `isUserVerifyingPlatformAuthenticatorAvailable()` resolves to `false`")
does not hold on Windows, where the probe above measures `true` without it — Chromium reaches the
platform authenticator directly, outside Electron's gate. So the only remaining lever is
intercepting `navigator.credentials.get` in the page, and tab views are deliberately `sandbox: true`
with **no preload** ([tab-manager.ts](../src/main/browser/tab-manager.ts) `createView`) — the
property the "Missing sender validation on `IPC.trpc`" note below depends on. A sandboxed preload
cannot reach the page's main world, and unsandboxing remote content to suppress a dialog is not a
trade a browser should make.

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

### P1 · Confirmed · The right-click menus are painted over by the page

The defect `PopupHost` was built to fix, in the overlays it was never extended to. `PopupKind` is
`'downloads' | 'update' | 'zoom'` ([popup.ts](../src/shared/types/popup.ts)) — so those three float
above the page, and **every other chrome overlay still drops into the content region and is painted
over by the native view**: [TabContextMenu.tsx](../src/renderer/components/chrome/TabContextMenu.tsx),
[TabGroupHeader.tsx](../src/renderer/components/chrome/TabGroupHeader.tsx) and
[WorkspaceBar.tsx](../src/renderer/components/chrome/WorkspaceBar.tsx) — **three** right-click menus,
not the two the tab strips make obvious.

Tooltips were a fourth, fixed in v0.2.4 by defaulting
[Tooltip.tsx](../src/renderer/components/ui/Tooltip.tsx) to `side="top"`: the toolbar has chrome
above it in both layouts, so opening upward keeps a tooltip out of the content region for one line
and no IPC, and Radix flips it back down where there is no room (the title bar). A tooltip is not
worth a surface — see "Radix" below for what a migration costs.

Both layouts are affected ([Chrome.tsx](../src/renderer/components/chrome/Chrome.tsx)): `Toolbar`
sits directly above `ContentArea`, and in the vertical layout the tabs live in the 248px `Sidebar`,
so a right-click menu opens at the pointer and extends right and down into the content region.
Right-clicking a tab is a core interaction and the menu is unreachable on any real site — it works
only on internal pages, where `activate()` destroys the view and leaves nothing on top.

**Not fixable by widening the surface.** `View`/`WebContentsView` expose only `setBounds`,
`setVisible`, `setBackgroundColor`, `setBorderRadius` and `setBackgroundBlur` — there is **no
`setIgnoreMouseEvents`** (it exists on `BrowserWindow` alone). A single full-window overlay surface
hosting every menu would swallow every click meant for the page, which is precisely why `PopupHost`
sizes itself to the popover. Each overlay has to be migrated individually; the per-menu cost is the
architecture, not an oversight.

Four things the migration has to solve that the existing three popovers did not. `PopupHost` needs a
pointer-anchored placement and a `target` on `popup:show` (a menu is opened _on_ something, and the
surface renders from that id); both were written for v0.2.4 and taken back out, because nothing can
reach them until the renderer half exists and unused code is not worth shipping. What follows is the
part that made the renderer half more than a port, and is why it was not:

- **A menu escapes the surface's own measuring tape.** `PopupApp` sizes the surface by measuring a
  `card` ref and reporting it to `popup.resize`, and main keeps the surface hidden until it hears a
  real size. A Radix menu **portals to `document.body`** — outside that ref — so the card measures
  nothing, the surface never reports a size, and the menu never appears at all. The card also brings
  its own `glass-strong` and border, which a menu supplies for itself. The popup body contract has to
  change (a body that is its own card, or a portal `container`), which is the redesign this bullet is
  really describing.
- **Radix collision detection fights the surface.** Inside the popup the viewport _is_ the surface,
  so Radix flips and repositions against a rectangle sized to its own content. The bodies that work
  today (`DownloadsPopoverBody`) are plain markup placed by `PopupHost.place()` — but a menu cannot
  simply become plain markup either: `menuItemClass` styles off `data-[highlighted]`, which **Radix
  injects**, and hand-rolled buttons would lose arrow-key navigation with it. The answer is Radix
  `DropdownMenu` with `avoidCollisions={false}`, letting main place the surface and Radix keep
  keyboard nav. The `ContextMenu.Sub` for "Add to group…" still cannot survive — a floating submenu
  portals outside the measured card and clips — so it becomes an inline expanding section.
- **The popup has no tab state.** `app.initialState` does not return tabs, and `restoreWorkspace` —
  the only thing that does — creates views as a side effect, so the popup must not call it.
  `tabs.get`, `tabs.listByWorkspace` and `tabs.listGroups` cover it.
- **`TabGroupHeader` renames in chrome-local state.** Its menu calls `setEditing(true)` to reveal an
  inline input **in the chrome**, which a menu living in the popup renderer cannot reach. That one
  has to go back through main, the way "Later" on the update chip already does — `TabContextMenu` has
  no equivalent, since every one of its actions is already a tRPC mutation.

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

## Windows & workspaces

### P3 · Confirmed · A newly created workspace never appears in other windows on the same profile

`WorkspaceService.create()` and `.update()` both emit `workspace:changed`, but the renderer handler
([browser.store.ts](../src/renderer/stores/browser.store.ts) `applyEvent`) only _replaces_ an existing
entry:

```ts
workspaces: state.workspaces.map((w) => (w.id === event.workspace.id ? event.workspace : w));
```

`.map` cannot introduce an id that is not already present, so a **created** space is dropped by every
window that did not originate it. Renames, accent and wallpaper changes sync (the id already exists);
only creation is lost — the asymmetry shows the handler means to sync cross-window but doesn't upsert.

**Failure scenario.** Two windows on one profile (`Ctrl+N`); create a space in window A. A refetches
itself (`refreshWorkspaces()`) so it is fine, but B ignores the event and never shows the space until
reload. Fix: upsert in the handler (append when the id is absent). Related and lower priority:
`WorkspaceService.delete()` emits no event at all, so a deleted space also lingers in other windows —
it wants a `workspace:removed` event.

---

## Not a bug

Recorded so they are not re-investigated:

- **Google sign-in's "This browser or app may not be secure" block.** Addressed in stages, ending in
  v0.2.12 — see [../docs/google-signin-fix.md](../docs/google-signin-fix.md). The last cause was a
  UA↔client-hints mismatch: the UA string presented as stock Chrome while `Sec-CH-UA` still carried an
  `"Electron"` brand and no `"Google Chrome"`. `harmonizeClientHints` now keeps the hints consistent
  with the UA. What is **not** fixable from here is any _further_ embedded-browser gating Google
  chooses to apply (enterprise SSO policy, WebAuthn edge cases, a future heuristic) — an embedded
  user-agent is, by Google's published definition, any library that can insert scripts, reroute the
  OAuth request or read session cookies, and Dandelion does all three by design. Switching to a
  Chromium fork would not change that, since Electron already ships real Chromium.
- **The user-agent strip in `SessionManager.chromeUserAgent()` looks like a hack but is
  load-bearing.** With the stock Electron UA, Google rejects the sign-in navigation outright
  (`ERR_FAILED`). Its client-hints counterpart, `harmonizeClientHints`
  ([client-hints.ts](../src/shared/utils/client-hints.ts)), is load-bearing for the same reason —
  don't "simplify" either away.
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
