# Dandelion — Fixed Bugs

Defects that have been fixed, with the root cause and what pins them. Open defects live in
[BUGS.md](BUGS.md); unbuilt work lives in [TODO.md](TODO.md).

Kept so a regression is recognised rather than re-diagnosed from scratch.

---

## v0.2.2

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
