# Dandelion — Fixed Bugs

Defects that have been fixed, with the root cause and what pins them. Open defects live in
[BUGS.md](BUGS.md); unbuilt work lives in [TODO.md](TODO.md).

Kept so a regression is recognised rather than re-diagnosed from scratch.

---

## v0.2.3

### P1 · Every toolbar popover rendered _behind_ the page

Open any real site, then click **Downloads**, the update chip, or **Zoom**: nothing appeared. The
popover was not merely invisible — the web view swallowed the clicks, so it could not be used at all.
Reported from a live build against Google.

Tab pages are native `WebContentsView`s added **on top of** the chrome in the content region. The
toolbar popovers were Radix popovers rendered **in the chrome layer**, anchored to a toolbar button
and dropping _down_ — into the content region. The page painted straight over them. It looked
intermittent because `activate()` destroys the view for internal URLs: on `dandelion://newtab` there
is nothing on top, and they worked perfectly.

**The obvious fix was the wrong one.** `selectContentDimmed` already hides the web view for the
omnibox, the palette and permission prompts; adding three flags to it would have worked, and it is
what [ARCHITECTURE.md](../docs/ARCHITECTURE.md) documents. But it blanks the page to show a dropdown.
For **zoom** that defeats the control — the point is watching the page resize under it. For
**downloads**, which opens itself when a download starts, the page would vanish out from under the
click that started it. Hiding the content is right for a command bar that _wants_ the page gone; it
is wrong for a popover that annotates the page.

**Fix: `PopupHost`.** The problem is z-order, not visibility. Child views stack in insertion order and
tab views are added at index 0, so a surface appended after them sits above every one — inside the
window, moving and resizing with it for free, with no OS window, no taskbar entry and no
always-on-top fight with other apps.

The surface is a second renderer loading the same bundle with `?popup=1`. It shares no React tree with
the chrome, which matters less than it sounds: the stores already hydrate themselves over tRPC and
follow the same events, so they work unchanged once the event bridge reaches them. Two things had to
learn about it, both because a view is not a `BrowserWindow` — the event fan-out (which iterates
`BrowserWindow.getAllWindows()` and would never have reached it) and `ipc-host`'s window resolution
(which goes through `fromWebContents`, so every window-scoped proc the popup called would have been
rejected).

Details worth keeping:

- **Sized to the popover**, so clicks outside it still reach the page. It measures its own card and
  reports back, because the downloads list grows with its contents; main keeps it hidden until it
  hears a real size, so nothing flashes.
- **Closes on `blur`** — clicking the page or the chrome focuses them, which blurs the surface. No
  outside-click plumbing.
- **The first click is replayed.** It builds the surface and asks for a popover in the same breath, so
  there is nothing listening yet; `did-finish-load` delivers it rather than dropping the click that
  paid for the boot.
- **The body must not paint.** The surface is the card plus the margin its shadow needs, so
  `[data-surface='popup']` makes the window background transparent — otherwise that margin is an
  opaque rectangle sitting on the page.
- **Dismissing an update now goes through main.** "Later" lives in the popup and the chip that reads
  it lives in the chrome — two renderers, so neither can hold it alone.

Pinned by `tests/unit/popup-host.test.ts`: right-alignment under the trigger, shadow padding, clamping
at the window edges, integer bounds.

### P3 · tRPC procedure lookup walked `Object.prototype`

Fixed alongside the popup host, which needed the same function. A plain property walk guarded with
`typeof target === 'function'` accepts inherited members: `"constructor"` resolves to `Object`,
`"__proto__.constructor.constructor"` to `Function`. **Never exploitable** — the result is only ever
called with one superjson value, never eval'd, and only the trusted chrome can reach the channel — but
a lookup that can land anywhere on the prototype chain is a coincidence rather than a lookup. It now
walks own properties only, via `Object.hasOwn`.

### P2 · Downloads restored from disk presented live controls that did nothing, silently

Start a large download, quit mid-transfer, relaunch, open Downloads: a row stuck on "Downloading"
**forever**, behind a progress bar frozen at wherever it got to, offering a Pause and a Cancel that
did nothing at all — no error, no log, no feedback of any kind. Neither "Clear completed" nor "Clear
browsing data → downloads" would remove it. Only "Remove from list" did.

Three separate causes behind one row.

**The controls.** `toDownload` derives affordances from persisted state (`canResume: state ===
'paused' || state === 'interrupted'`), so the buttons render from the row. But `pause`/`resume`/
`cancel` acted only through `this.live` — a map populated exclusively by `handleWillDownload`. A
`DownloadItem` cannot outlive the process that created it, so after a restart `live` is empty and
every control was a no-op lookup (`this.live.get(id)?.item.pause()`). The router returned `true`
regardless, so the renderer's `.catch(() => toast.error(...))` was **dead code** — the same silent
lie `openFile` told before v0.2.2j.

**The permanence.** Nothing reconciled orphaned rows at boot, so a transfer the last run never
finished kept claiming `in_progress` forever, and `isActive()` kept it in the active list.

**The sweep.** `clearCompleted` filtered `state IN ('completed', 'cancelled')` and missed
`interrupted` entirely — so even a download that failed normally, on a network drop, could never be
cleared in bulk. Reconciliation alone would have made that far more common rather than fixing it.

**Fix.** `pause`/`resume`/`cancel` throw when there is no live transfer, following the v0.2.2j
pattern exactly; the renderer needed no change, its error path was already written and merely
unreachable. `resume` throws too when Chromium says the server will not restart from an offset,
which previously did nothing silently. `remove` deliberately still works without a live item —
taking a row out of the list is something we can always do, and it was the only control that worked
at all before.

`reconcileInterrupted()` runs from `bootstrap()`, marking every row still claiming `in_progress` or
`paused` as `interrupted`: no `will-download` has been handled at that point, so every live state in
the table is stale by definition. Both live states are swept, not just `in_progress` — a download
paused when the app quit was stuck in exactly the same way, for exactly the same reason. `completed_at`
is left alone: the transfer stopped at an unknown point in the previous run, and stamping it with the
time we noticed would record a moment that never happened.

`clearCompleted` now deletes `NOT IN ('in_progress', 'paused')` — the complement of the one list the
reconciler uses, so the two cannot drift apart — which means a failed download is finally clearable
and "Clear browsing data → downloads" removes what it says it removes.

Genuinely **resuming** across a restart is not this fix and is not built: it needs
`session.createInterruptedDownload` plus an offset and ETag the row does not store. Until then a
restored download is honestly `interrupted` rather than dishonestly `in_progress`.

Pinned by `tests/unit/downloads-service.test.ts`.

### P3 · Every progress tick did an unthrottled synchronous write + read-back

`item.on('updated', ...)` was unthrottled, and the `elapsed >= 1` guard inside `onUpdated` gated
**only** the speed/ETA sample — not persistence. Every event ran an `UPDATE` followed by a `SELECT`
read-back to rebuild the payload it had just written, both synchronous better-sqlite3 calls on the
main process, at whatever rate Chromium chose to fire on a fast connection.

`LIMITS.downloadSampleMs` ("Download speed sampling window, ms") was **referenced nowhere**: the
window the constant documented had never been wired to the write path.

**Fix.** Each download gets its own `throttle(…, LIMITS.downloadSampleMs)` — the existing shared
helper, per download so concurrent transfers do not share a window — and the constant finally means
what it says. The read-back is gone: the service caches the row it last wrote on the live entry and
keeps it in step with every patch, because it already held every field it had just written.

The tick reads the item when it **fires**, not when it was scheduled. `throttle`'s trailing call
carries the arguments of the call that scheduled it, so a tick landing after `done` would otherwise
drag a finished download back to `in_progress` — the same trap `update.service.ts` documents on
`publishProgress`, where a late tick must not drag `ready` back to `downloading`. Guarded on the
`completedAt` stamp that `done` writes, which matters while a safety scan is still in flight and the
live entry outlives the transfer.

### P3 · `downloads.start` accepted a `savePath` that was ignored

`startDownloadInput` advertised an optional `savePath` and `startOnSession` never read it —
`session.downloadURL(url)` takes no destination.

**Removed rather than honoured.** The target is decided in `will-download`, where
`handleWillDownload` applies the user's download directory and the `uniqueSavePath` anti-clobber
walk — one owner for that decision. Honouring a per-call path would mean correlating it back through
`will-download`, which identifies a transfer by nothing but its URL (ambiguous the moment the same
URL is downloaded twice), and would let a caller write to an arbitrary filesystem location behind the
user's chosen directory — a write primitive worth more than the feature. Nothing called it: the route
had no caller in the renderer at all.

## v0.2.2

### P2 · A disabled extension could never be removed

`setEnabled(id, false)` unloads the extension from the session and parks it in the in-memory
`disabled` map. `remove(id)` only called `session.extensions.removeExtension(id)` — a no-op for
something already unloaded — and nothing deleted the parked entry. `list()` unions the session's
extensions with `disabled`, so it reappeared **forever**, with no way to get rid of it from the UI.
One line: `remove` deletes the entry too. Pinned by `tests/unit/extensions-service.test.ts`, which
covers the disabled-then-removed order that was broken.

### P2 · `workspace.switcher` was a dead command

`case 'workspace.switcher': ui.openPalette()` — and the palette rendered only "Commands" and "Open
Tabs", with no workspace list to open onto. From inside the palette it was worse: `onSelect` ran
`dispatchCommand(id)` and **then** `close()`, so `openPalette()` set `paletteOpen: true` and
`closePalette()` immediately set it back. The net effect was that the palette just closed.

**Fix.** The palette gains a **Workspaces** group (shown when there is more than one), so the thing
the command names now exists. `openPalette` takes an optional query, mirroring `openOmnibox`'s
`initialValue`, and the command seeds it with `workspace` so `⌘⌥S` opens scoped to that group rather
than the full command list.

The ordering half is fixed generally rather than special-cased: `onSelect` **closes first, then
dispatches**. A command may open something, and closing afterwards undoes it. This was the only
command that opened the palette, but the next one would have hit the same wall.

### P3 · `openFile` / `showInFolder` discarded the failure

`shell.openPath` **resolves** to an error message rather than rejecting — an empty string means
success — and the service did `void shell.openPath(...)`, throwing the only report away. The router
returned `true` regardless, so the renderer's `.catch(() => toast.error('Could not open file'))` was
**dead code**. Clicking Open on a download whose file had been moved or deleted did nothing
whatsoever: no error, no log. Directly against the repo's "never silently ignore errors" rule.

**Fix.** `openFile` is async and throws the failure; the router awaits it. The renderer needed no
change at all — its error path was already written, just unreachable. `showInFolder` reports nothing
even on failure, so it checks the file exists first and throws the one failure that is detectable,
rather than silently doing nothing.

### P3 · `SessionsDialog` swallowed its error state, and the History/Bookmarks panels lied

`SessionsDialog` destructured `{ status, data, reload }` and never `error`, branching on `loading` and
`ready` only — so a rejected `sessions.list` rendered the header and "Save current" over a blank body.
The History and Bookmarks **panels** branch loading → empty and never `error`, and `useAsyncData`
returns `data: []` on rejection — so the empty branch won and a failed fetch was indistinguishable
from an empty list: "No history yet", shown to someone who has history.

All three now render an error state with a retry, matching what every page already did.

### P2 · `Ctrl+Shift+T` from a different workspace silently emptied the tab strip

Close a tab in workspace A, switch to B, press `Ctrl+Shift+T`. The page materialised and rendered,
but the sidebar showed A selected with an **empty strip** — the tab unreachable and uncloseable until
a workspace was re-picked by hand.

`reopenClosed()` recreates the tab in the workspace it was closed **from**, and `createTab` →
`activate` sets `dandelionWindow.activeWorkspaceId = live.state.workspaceId`, moving the window to
another workspace from the main process. The renderer could not follow: `tab:created` was dropped by
its workspace filter (still the old workspace at that moment), the later `window:state` set
`activeWorkspaceId` **without refetching tabs**, and `selectOrderedTabs` then filtered to nothing. The
only rehydration paths were `bootstrap()` and `switchWorkspace()`, both renderer-initiated.

**Fix.** `workspace:activated` already existed in `events.ts` and was **never emitted and never
handled** — a dead event whose exact purpose was this. `activate` now emits it when it moves a window
between workspaces, and the renderer refetches. That fixes any main-side workspace switch, not just
this one; reopening into the current workspace instead would have fixed the symptom and left the hole.

No loop: the refetch calls `restoreWorkspace`, whose `activate` finds the workspace already current
and emits nothing.

### P2 · `setSplit()` never cleared `asleep`, so a live pane stayed dimmed forever

Restart, then split view: the second pane rendered live web content while its strip row stayed at
`opacity-50` indefinitely. State said asleep; the screen said awake.

`setSplit` materialised and `loadURL`ed each pane but — unlike `activate()` — never cleared `asleep`,
never `emitUpdate`ed and never set `lastActiveAt`. `sleep()` correctly refuses to sleep a split pane,
so nothing ever corrected the flag either. Restored tabs arrive `asleep: true`, and `toggleSplitView`
picks the first non-active tab — which, after a session restore, is asleep.

**Fix.** A pane on screen is awake by definition: `setSplit` clears the flag and says so, or the strip
never restyles.

### P3 · `duplicate()` collided tab indices, so the copy landed in the wrong slot

`duplicate` passes `index: live.state.index + 1` and `createTab` assigned it **verbatim**, without
making room. With `A(0) B(1) C(2)`, duplicating `A` produced a copy at index 1 colliding with `B(1)`;
sorts are stable, so the copy always landed _after_ the incumbent. Duplicating `A` in `A B C` gave
`A B A2 C` — never beside its source. The colliding index was persisted, and nothing renormalised
except a manual drag-reorder.

**Fix.** An explicit index is a slot request, so `createTab` frees the slot first — but only if
something holds it. `reopenClosed` asks for the slot it just vacated, which is free, and renumbering
its neighbours for nothing would emit an update per tab. Scoped to the window, since that is the list
the index orders.

### P3 · `recentlyClosed` had no private-profile guard

`close()` pushed url/title/favicon into `recentlyClosed` for any `https?:` tab with no `isPrivate`
check, while both comparable sinks — `persist()` and `recordVisit()` — guard explicitly. `Ctrl+Shift+T`
from a normal window resurrected a tab closed in a **private** one. In-memory only, and
`app.recentlyClosed` has no renderer consumer, so exposure was limited to the reopen command — but the
rule is that nothing from a private window outlives it.

Pinned by `tests/unit/tab-defects.test.ts`.

### P1 · The chrome had no session, so favicons escaped the profile partition

`WebContentsView`s are built with `session` bound to the profile's partition, but the chrome
`BrowserWindow` passed no session and so ran in `session.defaultSession` — which `PrivacyService` was
never attached to, since it only configures per-profile partitions. `page-favicon-updated` stores the
**site-chosen** URL verbatim, broadcasts it to the chrome, and `Favicon` rendered it as `<img src>`:
in the chrome window, i.e. outside the profile.

**Correcting the audit's phrasing, which mattered to the fix.** The original finding said the request
landed "in a jar shared with normal browsing". It does not: normal profiles use
`persist:dandelion-<id>` partitions, so `defaultSession` is used by the chrome and nothing else. The
real leak is worse in one way and narrower in another — the favicon jar is shared by **every profile
at once, including private ones**, and it persists across restarts. A page in a private window
setting `<link rel="icon" href="https://tracker/id?u=123">` had that request issued from a jar that
outlives the private session and also serves normal browsing's favicons, so the tracker could
correlate the two. Unblocked, because there is no `webRequest` filter on the default session, and
uncounted by the shields.

**Fix.** A `dandelion-favicon:` protocol, registered as privileged before `whenReady` (a scheme cannot
be given privileges once the registry is frozen) and handled in main. `Favicon` resolves
`dandelion-favicon://icon?profile=<id>&url=<encoded>`; main fetches the icon with
**`session.fetch`** on that profile's session, so the request lands in the right partition, the block
engine sees it, and a private profile's jar takes the cookie and drops it on exit. The handler
re-checks the scheme — the chrome builds these, but they still arrive over a protocol boundary —
requires an `image/` content type, and fetches with `credentials: 'omit'`: a favicon is decoration and
must never carry ambient authority.

Doing the resolution inside `Favicon` rather than at each call site covers the tab strip, history,
bookmarks and the reader's header by construction. Every failure path returns 404, which the component
already renders as its globe glyph — so the blast radius of this being wrong is "no favicons", not a
crash.

**Not fixed here:** the reader's own inline images take the same path and still reach the default
session. Recorded in [BUGS.md](BUGS.md); routing those through the same protocol is what lets `https:`
come out of the chrome's `img-src`, which is what would make this enforced rather than merely intended.

Pinned by `tests/unit/favicon-url.test.ts` and an integration test asserting the site-chosen URL never
reaches the DOM.

### P1 · Every popup was blocked — `window.open()` returned `null`, so OAuth could not complete

`setWindowOpenHandler` denied **all** popups and re-opened the URL as a tab. Confirmed by evaluating
`window.open(...)` in a real page: it returned `null`.

Any flow that depends on a popup **and its opener** was broken. "Sign in with Google" and most OAuth
buttons open a popup and wait on `window.opener.postMessage` to hand back the credential; with no
opener there is no channel home, so even a successful sign-in delivered nothing. Substituting a tab
looks like a reasonable fallback and is not one — it severs exactly the thing the flow needs.

**Fix.** `disposition === 'new-window'` — `window.open()` with features, the only disposition whose
opener matters — now opens a real popup on the opener's session with `{ action: 'allow' }`, keeping
the opener chain. `foreground-tab` / `background-tab` (i.e. `target="_blank"` links) still become
tabs, which is what a browser does and what this already did right. The popup gets the same lockdown
as a tab's view (`sandbox`, `contextIsolation`, no `nodeIntegration`, `webSecurity`) rather than
inheriting anything by accident, and `outlivesOpener: false`.

**The `popups` permission is no longer dead.** It existed as a `PermissionType` and rendered as a real
row in the Permissions page, but nothing consulted it — the handler denied unconditionally, settling
the question before any rule was read. The decision is now read, and an unset rule **allows**: Chromium
blocks popups without a user gesture, `setWindowOpenHandler` is not told whether there was one, so the
honest choice is allow-and-let-people-block rather than a prompt in front of every sign-in button.

The rule is also **recorded on first use**, which is what actually makes the control reachable:
`PermissionsPage` only edits rules that already exist and nothing prompts for popups, so without that
the Block half would have stayed unreachable — a differently-dead control rather than a fixed one.

### P3 · Page-controlled URLs reached `loadURL` with no scheme allowlist

Fixed with the above, because it is the same code path. `setWindowOpenHandler` passed the
page-supplied `url` into `createTab` → `activate` → `loadURL`, and `zUrl` validates only length, never
scheme. A page calling `window.open('dandelion://passwords')` reached `isInternalUrl`, which destroyed
the web view and rendered the **internal password manager** in the privileged chrome.

Because the navigation is main-process-initiated, Chromium's renderer-side scheme restrictions are
never in the path — the allowlist has to exist where the page-supplied URL is accepted. `isWebContentUrl`
now guards it: `http:`, `https:`, and `about:blank` (which a popup opener writes into directly).

Deliberately **not** applied to `navigate()`: the chrome navigates to `dandelion://settings` legitimately.
The rule is about who supplied the URL, not which function receives it.

Pinned by `tests/unit/web-content-url.test.ts`, including the `dandelion://passwords` reproduction.

### P1 · History grew without bound; the documented 90-day retention never ran

`HistoryService.prune()` was dead code. Its JSDoc said "called periodically" and nothing called it —
a grep for `prune` across `src/` found only `repos.sessions.prune(15)`, the definition, and the repo
method. `LIMITS.historyRetentionDays = 90` was referenced **only from inside the function that never
ran**, so the retention policy was documented, correct, and unenforced. History grew for the life of
the install, and `history_visits` grew with it, since its rows only leave via `ON DELETE CASCADE`
from a parent entry that was never deleted.

**Fix.** `AppContext.bootstrap()` prunes every profile. Boot is the moment: the one point where the
cost is invisible and no navigation is waiting on the main process. A window left open for weeks will
not prune until it next starts — a bounded overshoot, rather than the unbounded growth it replaces,
and cheaper than the timer the dead `LIMITS.tabSweepIntervalMs`/`sessionAutosaveMs` constants suggest
was once planned. Failures are caught and logged: retention is housekeeping and must never stop the
browser opening. `prune` returns the count so the log can say what happened.

Verified that the cascade claim actually holds rather than trusting the schema comment:
`history_visits.entry_id` is `REFERENCES history_entries(id) ON DELETE CASCADE` and
`PRAGMA foreign_keys = ON` is set in `database.ts`, so pruning entries really does take their visits.

**Knock-on.** The omnibox's per-keystroke full scan (still open in [BUGS.md](BUGS.md)) was unbounded
only because of this. It is now bounded by the retention window rather than by the age of the
install.

Pinned by `tests/unit/history-prune.test.ts` — the cutoff arithmetic, the returned count, and
`0 = keep forever`.

### P1 · The bookmark star never reflected `⌘D` or the command palette

Press `⌘D`: the bookmark is saved, the star stays hollow, no toast, zero feedback. Press it again and
the bookmark is silently **removed**. Mixing inputs inverted the indicator outright — click the star
(optimistic → filled), then `⌘D` (removes it, star stays filled), and the star now claimed bookmarked
on an unbookmarked page.

Two sources of truth and no link between them. `⌘D` → `executeCommand` → `forwardToRenderer` →
`toggleBookmarkActive()` mutates the DB and returns. There was **no** `bookmark:*` event, and the
Toolbar's `bookmarked` state only refreshed via an effect keyed on `[profileId, canBookmark, tab,
tab?.url]` — none of which change when a bookmark toggles. Its only other update path was the
optimistic `setBookmarked(v => !v)` in the star's own `onClick`, which is a guess about a mutation it
does not own.

**Fix.** `BookmarksService` takes the `EventBus` and announces `bookmark:changed` from `add` and
`remove`; `toggle` now routes through `remove` rather than reaching past it to the repo, and `update`
announces **both** URLs when an edit moves one, since that unbookmarks one page and bookmarks
another. The star drops its optimistic toggle and renders what main reports. Same shape as the AI
provider fix, and the same reason: the state has one owner, so the owner announces it.

**Secondary, fixed with it.** The effect depended on the whole `tab` object, so it refired an
`isBookmarked` IPC query on every `tab:updated` — title, favicon, status — for the length of every
page load, and an in-flight response could clobber the optimistic toggle. It now depends only on the
URL it actually reads.

### P2 · Bookmark import never decoded HTML entities, corrupting every URL with a query string

`exportHtml` escapes the href — `escape(bookmark.url)` turns `&` into `&amp;` — but `importHtml` read
the capture group raw, so `https://example.com/?a=1&amp;b=2` was stored verbatim. Titles were equally
affected: the export also encodes `<`, `>`, `"`, and the import only stripped tags, never decoded.

Dandelion's **own** export → import round trip therefore broke any URL with more than one query
parameter and mangled any title containing `&` into `Tips &amp; Tricks`. Chrome and Firefox escape
hrefs the same way, so importing a real browser's file corrupted those URLs too. Imports are silent,
so the damage only showed when a link was clicked.

**Fix.** A `decodeEntities` inverse of the export's escaping, applied to both href and title. `&amp;`
is decoded **last** on purpose: decoding it first would turn `&amp;lt;` into `&lt;` and then into
`<`, inventing markup the file never contained. Pinned by a real round-trip test through
`exportHtml`, so the two can no longer drift apart.

### P1 · Every `Switch` and `Slider` had no accessible name — Settings was unnavigable by screen reader

32 `toggleRow` call sites, 4 `sliderRow` call sites and one Switch per extension row all announced as
"switch, on" / "slider, 100". Nothing said _which_ setting.

`SwitchProps` and `SliderProps` declared only `checked`/`value` and a change handler — there was no
`aria-label` prop to pass. Radix renders `<button role="switch">` over an empty thumb and
`role="slider"` on an empty thumb: it supplies the role and the state but cannot invent a name, and
the label sat in `SettingsRow` as a bare `<p>` with no `id`/`htmlFor`/`aria-labelledby`. Adjacent
text is not an accessible name.

A defect rather than unbuilt work: the sibling primitives already carry labels — `Select` accepts
`'aria-label'?` and `SegmentedControl` **requires** it. These two were simply never given the prop.

**Fix.** Both now **require** `'aria-label'`, following `SegmentedControl` rather than `Select` — the
type then finds every call site, which is how the one in `ExtensionsPage` surfaced. `toggleRow` and
`sliderRow` already had the row's `title` in hand, so all 36 rows were named by two lines. `Slider`
also gained `valueText`, wired to the same `format()` the read-out uses, so it speaks "30 min" rather
than "30" — the unit lives in a sibling `<span>` that is not announced, and that span is now
`aria-hidden` since it duplicates the value.

### P2 · `outline-none` silently killed the global focus ring

Verified by compiling this project's Tailwind: `.outline-none` emits `{ outline-style: none }` into
`@layer utilities`, while the single global `:focus-visible` rule sits in `@layer base`. Cascade
layers are compared **before** specificity, so utilities won and the focus treatment was overridden
everywhere it was used. (Tailwind v4 renamed the v3 behaviour people expect here to
`outline-hidden`.)

Four components used it with nothing in its place, so keyboard focus was **invisible**: `Switch`,
`Slider`, `Select` (focused-but-closed), and `List`'s row button — whose `focus-visible:text-text`
was a no-op anyway, since both children set their own colour and nothing inherited it.

**Fix.** Removed from those four; the global rule applies again. Modern Chromium only paints its own
default ring on `:focus-visible`, and author styles beat the UA sheet, so nothing regresses for mouse
users. Deliberately left elsewhere: text inputs pair it with `focus:border-accent` (the field is its
own indicator), cmdk/menu rows render `data-[selected]`/`data-[highlighted]` state, and
`SplitDivider` replaces it with a ring.

### P2 · `--tab-height` was a dead token: "Compact" density didn't shrink tabs

`--tab-height` was defined (34px → 29px under `[data-density='compact']`) and read by **nothing**.
`TabItem` hardcoded `h-[34px]` and `TabsPanel`'s enter animation hardcoded `height: 34` — both exactly
the default value, so it looked right and was inert. Every sibling density token _was_ consumed
(`--toolbar-height`, `--row-py`, `--field-height`), and the `globals.css` comment claimed tabs read
these tokens.

Settings → Appearance → Density is real and works: Compact retuned the toolbar, list rows and form
fields while the tab rows stayed 34px, so the sidebar read as half-converted.

**Fix.** `TabItem` reads `h-[var(--tab-height)]`. `TabsPanel`'s motion constant lives at module scope
and cannot read a CSS variable, so it animates to `height: 'auto'` — which resolves to the row's own
token and follows any future density without another hardcoded number.

### P1 · The AI chat wedged forever on its first use

Fresh install, no API key → open the AI sidebar, send a message → the message appears, the panel
enters its thinking state and never leaves. No error, ever. `send()` early-returns on `busy`, so the
chat was then bricked until the user found Stop or Clear. This was the primary onboarding path.

The renderer learns `requestId` only **after** the mutation resolves, but main emitted its early-exit
failures **before** returning one:

```ts
const requestId = createId('ai');
if (provider.requiresApiKey && !apiKey) {
  this.emitChunk(requestId, '', true, `${provider.name} is not configured`);
  return requestId;
}
```

`emitChunk` → `EventBus.emit` is a plain synchronous `EventEmitter`, and `ipc-host` forwards it with
`webContents.send` **inside the still-running `ipcMain.handle` callback**, so the event reached the
renderer strictly before the invoke reply. `applyChunk`'s guard compared `'ai_x' !== null` and dropped
it. Deterministic, not racy — the guard could never match. `busy` is only cleared by `applyChunk`'s
error/done branches, both unreachable once the only chunk was gone.

**Fix.** A failure knowable before the stream exists is a failure of the _call_, not an event in a
stream — so `complete()` and `pageAction()` now **throw** instead of emitting a terminal chunk. The
renderer already had the machinery: its `catch` synthesises a local chunk with an empty `requestId`,
which the guard deliberately lets through. `serializeError` keeps `error.message` for a plain `Error`
and the IPC link rebuilds it, so the user reads "OpenAI is not configured" rather than "Request
failed". Deferring the emit would have worked by timing; this removes the ordering question.

Also fixed here: **`pageAction` ignored the model picker.** The store passed `providerId`/`model` and
then `void`ed them, so Summarise/Explain/Translate always used the default provider's first model
while chat honoured the picker — the two paths silently disagreed. Both are now sent, with the
default as a fallback rather than the rule.

Pinned by `tests/unit/ai-service.test.ts`, which asserts both the throw **and** that nothing reached
the event bus.

### P1 · Saving an API key never reached an already-open sidebar

Open the AI sidebar (providers load, `configured: false`) → Settings → paste key → Save ("API key
saved") → back to the sidebar: composer still disabled, still "Assistant unavailable". Only a
renderer reload fixed it. This is the natural setup order — the user finds the sidebar unavailable,
goes to configure it, and it stays broken behind a success toast.

`loadProviders` sets `providersLoaded: true` permanently and its only call site is guarded by that
same flag, so it runs exactly once per renderer. `configured` is derived **in main** from the stored
key, but `ai.configure` emitted nothing and Settings only toasted. Nothing could flip it false → true
in a live window, and Settings is an internal page in the _same_ renderer, so the module-level store
survived the whole journey.

**Fix.** `configure` emits `ai:providers` carrying the recomputed list, following the `vault:state`
and `app:update-status` precedent: main owns the state, so main announces it. The renderer applies it
through the existing event bridge. A refetch would have worked too, but only for the one caller that
remembered — the event is correct for every future one.

### P1 · Every normal quit saved an _empty_ session, then pruned the real ones away

"Restore previous session" restored nothing after a normal quit, and each quit destroyed one more
genuine snapshot.

`saveSession()` was only reached from `shutdown()`, wired to `before-quit`. On the ordinary
Windows/Linux quit path that ordering is fatal: closing the last window fires
`browserWindow.on('closed')`, which deletes it from `windows` and notifies `closeListeners` →
`TabManager.handleWindowClosed()` drops every tab of that window. Only then does `window-all-closed`
→ `app.quit()` → `before-quit` → `shutdown()` run. By that point both maps are empty, so
`this.windows.all().map(...)` yields `[]`. The snapshot was written **unconditionally** and then
`prune(15)` kept the 15 newest — so after 15 quits every real snapshot had been evicted by an empty
one. The `'Empty session'` fallback in `listSessions` was the symptom being papered over.

**Fix, in two halves.**

_Capture at a moment where there is something to capture._ `WindowManager` gained
`onWindowWillClose`, fired from `browserWindow.on('close')` — while the window is still in the map
and its tabs are still live, which `'closed'` is one step too late for. `AppContext` snapshots there
when the window going away is the last one. `close` → `closed` runs to completion per window, so
"last" is `windows.all().length === 1` at that point, and a quit begun by `app.quit()` (menu,
palette, `Cmd+Q`) has already snapshotted every window in `shutdown()` — a `quitting` flag stops the
closes that follow from each taking another snapshot of what is left.

_Refuse to write a snapshot that restores nothing._ `saveSession` returns `null` instead of
persisting an empty one, which is what made the bug destructive rather than merely useless. This also
covers the shutdown save on the X path, which now no-ops instead of evicting. `sessions.saveCurrent`
returns that as a boolean, so "Save current" with nothing open reports "Nothing open to save" rather
than a success toast over a write that did not happen.

Also fixed here, same subsystem: **`restoreSession` ignored the calling window.** It resolved its
target with `this.windows.first()` and the router never passed `ctx.windowId`, so with two windows
open, restoring from window B dumped every tab into window A. It now takes `windowId` and the router
passes `requireWindowId(ctx)`, like every other window-scoped route.

Not pinned by a test: `AppContext` news up its own `Db` and every service eagerly, so it cannot be
constructed in one. That gap is now the top item in [TODO.md](TODO.md) § Testing — it is precisely
why this survived.

### P1 · `Ctrl/Cmd+N` stole a tab out of the window you were using

Opening a new window moved the _current_ window's active tab into the new one. Window 1's content
area went blank while its strip still drew that tab as active; clicking it did nothing visible,
because it now drove window 2.

`openWindow()` created the window with `activeWorkspaceId = null`, so the new renderer's `bootstrap()`
queried `initialState`, where `dandelionWindow?.activeWorkspaceId ?? workspaces[0]?.id` fell through
to **the workspace window 1 already had**. `restoreWorkspace` then hit its "already open" branch —
`listByWorkspace` spanned every window — and `reparent()`ed window 1's live tab into window 2. Window
1's `layout()` never re-ran, and `tab:activated` for window 2 was filtered out by the renderer's
`windowId` check, so window 1's chrome never learned the tab had left. `window.newPrivate` was
unaffected precisely because it pre-set `created.activeWorkspaceId` before the renderer booted.

Deferred from v0.2.1 because the mechanical fix is **not sufficient**: window-filtering `alreadyOpen`
alone falls through to the persisted branch and re-materialises the same stored tabs into the new
window, duplicating them. It needed the model decision first — **may two windows share a workspace?**

**Resolved: yes, and each window keeps the tabs it holds.** A tab carries one `windowId` and owns one
`WebContentsView`, so it can only render in one window; two windows on a workspace show different
tabs from it. That makes window scope the unit for anything driving one window's UI — hence
`listInWindow(windowId, workspaceId)`, used by restore, `Ctrl+Tab` and `Ctrl+1..9` (the latter two
cycled a workspace-wide list and could activate a tab living in another window — the same root cause).
Restore now materialises only persisted tabs no window has claimed, so a window opening an occupied
workspace gets a fresh tab instead of duplicating. `window.new` carries the current workspace over
explicitly, fixing the quieter half where `Ctrl+N` from any other space landed in the first one.
`reparent()` was the theft vector and had no other caller; it is gone. The model is documented in
[ARCHITECTURE.md](../docs/ARCHITECTURE.md) § Windows and workspaces.

Pinned by `tests/unit/tab-window-scope.test.ts` — including the duplication trap that made the naive
fix wrong.

---

## v0.2.1

### P1 · Third-party cookie blocking stripped cookies from first-party navigations

`blockThirdPartyCookies` is on by default and deleted the `Cookie` header from any request it deemed
third-party. It decided third-party by comparing the request against the tab's **last committed**
URL, resolved through a `topUrlResolver` callback into `TabManager`.

A top-level navigation's request is sent _before_ the new URL commits, so the comparison ran against
the **previous** page. Navigating to any site from a different site — or from `dandelion://newtab` —
classified the destination as third-party against itself and stripped its cookies. Every cross-site
navigation lost its cookies on the first request, so any site requiring a session appeared
logged-out on first hit. Reproduced against the real Google sign-in flow, where the entire entry
chain went out cookieless.

**Root cause.** A live request was judged against lagging state. `new URL('dandelion://newtab')`
also parses `newtab` as a hostname, so an internal page reads as a domain matching nothing — but
that was a symptom, not the cause: navigating from _any_ other origin classified the same way.

**Fix.** A top-level document request is first-party by definition, so `mainFrame` is never
stripped. Everything else is judged against the document owning its frame tree, read live from
`details.frame.top.url` instead of tab state. The `topUrlResolver` coupling was removed entirely
rather than patched. The decision now lives in a pure function,
[`third-party.ts`](../src/main/services/privacy/third-party.ts) `shouldStripCookies`.

**Pinned by** [tests/unit/third-party.test.ts](../tests/unit/third-party.test.ts) — including the
exact reproduction (`mainFrame` from `dandelion://newtab` to `accounts.google.com`).

### P1 · Camera permission checks consulted the microphone rule

`setPermissionCheckHandler` dropped Electron's 4th `details` argument, which carries `mediaType`.
`handleCheck` therefore called `mapPermission(permission)` with no media types, and
`mediaTypes?.includes('video')` on `undefined` is falsy — so **`media` could never map to `camera`
on the check path**. The _request_ path forwarded `mediaTypes` correctly, so grants were written as
`camera` and read back as `microphone`.

Two consequences: a camera grant looked absent (reported denied despite an explicit grant), and —
the security half — an explicit camera **Block** was bypassed whenever the microphone was allowed,
because the check found the microphone's `allow`.

**Fix.** Forward `details.mediaType` into `handleCheck` and normalise it to the array shape
`mapPermission` already expects, so both paths resolve the same `PermissionType`.

**Pinned by** [tests/unit/permission-check.test.ts](../tests/unit/permission-check.test.ts).

### P1 · Downloads silently overwrote an existing file of the same name

Downloading `report.pdf` twice destroyed the first copy — no prompt, no rename, no warning. This was
the **default** path, since `askWhereToSaveDownloads` defaults to `false`.

**Root cause.** Chromium uniquifies download targets itself (`report (1).pdf`), but only while it
owns the decision. Calling `item.setSavePath()` opts out of that routine entirely, so the fixed path
was written straight through, truncating the existing file.

**Fix.** `uniqueSavePath` walks `name (n).ext` until a free path is found before `setSavePath`.

**Pinned by** [tests/unit/unique-save-path.test.ts](../tests/unit/unique-save-path.test.ts),
including extension-less files and dotfiles.

### P2 · `Ctrl/Cmd+9` (Switch to Last Tab) was a dead command

The ordinal prefix guard in [command-executor.ts](../src/main/app/command-executor.ts) ran before
the switch and swallowed the id: `'tab.select.last'` matched `startsWith('tab.select.')`,
`Number('last')` is `NaN`, so the guard returned having done nothing. `case 'tab.select.last'` was
unreachable, and the `-1` sentinel in `selectTabByOrdinal` was dead with it.

**Fix.** The guard is now digits-only (`/^tab\.select\.(\d+)$/`), so `tab.select.last` reaches the
switch that already handled it.

### P2 · Duplicate Tab opened the duplicate in the wrong window

`TabManager.duplicate()` never forwarded the source tab's `windowId`, so `createTab` fell back to
`windows.first()` — the _first-created_ window, not the caller's. With two windows open, duplicating
a tab in the second window put the copy in the first (and raised it). If that window was on another
workspace, nothing appeared to happen at all.

**Fix.** `duplicate()` passes `windowId: live.state.windowId`.

### P3 · Sleeping a split pane left a dead half in the window

`sleep()` guarded the active tab but not split membership, so sleeping the _other_ half of a split
destroyed its view while `splitTabIds` still listed it. `layout()` then skipped it on the null-view
guard, leaving a blank rect until the tab was clicked again.

**Fix.** The guard now also refuses to sleep a tab in `splitTabIds` — a pane on screen is by
definition not inactive. This also protects the auto-sleep sweep, if that is ever built.

### P3 · Reopened tabs lost their pinned state, position and window

`close()` faithfully recorded `pinned` and `index` into the `ClosedTab`, and `reopenClosed()`
discarded both — so `Ctrl+Shift+T` returned a pinned tab unpinned and appended to the end of the
strip. It also always reopened in `windows.first()`, since `ClosedTab` had no `windowId`.

**Fix.** `ClosedTab` gained `windowId`; `reopenClosed(windowId?)` restores `index` and re-applies
`pinned`, and reopens in the window that asked for it (as every browser does), falling back to the
window it was closed from.
