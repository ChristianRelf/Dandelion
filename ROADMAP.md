# 🌼 Dandelion Browser Roadmap

> Building a beautiful, fast and privacy-conscious browser with a modern desktop experience.

**Status: working developer preview.** A ticked box means the feature is built and working in the
app today — not that it is polished or free of rough edges. Known limitations of shipped features
and open defects are tracked separately in the `Work/` folder and the
[issue tracker](https://github.com/ChristianRelf/Dandelion/issues).

Tick a box in the same pull request that ships the feature, so this file can never drift from the
code.

---

# Current Focus

**v0.2.2 — make the shipped features true.** A full subsystem audit
([`Work/BUGS.md`](Work/BUGS.md)) found that the gap between Dandelion and a
production browser is not missing features — it is shipped features that do not
do what their UI says. Sessions save empty. History never prunes. The AI chat
bricks on first use. Settings is unnavigable by screen reader. Those are worth
more than anything new, so v0.2.2 is a correctness release.

- [ ] **Nothing lies.** Every control that renders either works or stops
      rendering: dead commands (`tools.print`, `workspace.switcher`), dead
      settings (`security.safeBrowsing`, `isolateSites`), dead tokens
      (`--tab-height`), dead permissions (`popups`). Auto-sleep was one of
      these until v0.2.6 wired the sweep its settings always implied.
- [ ] **Nothing silently fails.** Errors reach the user or the log — never
      `void`ed away, never a success toast over a failure.
- [ ] **Nothing grows without bound.** History retention, `history_visits`,
      download rows, `PrivacyService.counters`.
- [ ] Complete all unfinished buttons
- [ ] Eliminate placeholder components
- [ ] Polish existing UI
- [ ] Improve animations
- [ ] Improve responsiveness
- [ ] Optimise startup time
- [ ] Fix memory leaks
- [ ] Improve tab performance

## Themes running through the audit

Worth naming, because each explains several defects at once and the fix is
structural rather than local:

1. **Scope confusion — workspace vs. window.** Fixed for tabs in v0.2.2a
   (`listInWindow`); the same shape remains in `restoreSession`
   (`windows.first()`) and `permission:request` (broadcast to every window).
2. **State with two owners.** The bookmark star guesses optimistically because
   no `bookmark:*` event exists; the AI sidebar cannot learn a key was saved
   because `ai.configure` emits nothing. Both want an event, not a refetch.
3. **In-memory maps mistaken for state.** Downloads' `live` map, extensions'
   `disabled` map. Both present controls after a restart that silently do
   nothing, because the row on disk outlives the handle in memory.
4. **Emitting before the caller can listen.** The AI chunk defect: main emits a
   terminal chunk inside the still-running `ipcMain.handle`, so it lands
   before the `requestId` the renderer needs to match it. Deterministic, not
   racy.
5. **Primitives missing the prop that makes them accessible.** `Switch` and
   `Slider` never took `aria-label`; `Select` and `SegmentedControl` do.

---

# v0.2 — Browser Foundation

## Tabs

- [x] Drag & reorder tabs
- [x] Duplicate tab
- [x] Pin tabs
- [x] Mute tab
- [x] Tab groups
- [x] Tab preview thumbnails
- [x] Sleeping tabs
- [x] Recently closed tabs
- [ ] Reopen closed window — **blocked on a model decision**, see below

> **Reopen closed window — open question.** Closing a window does not close its
> tabs: `handleWindowClosed` drops them from memory but never removes them from
> the database, so they are restored whenever that workspace is next opened.
> Dandelion's model is workspace-centric — tabs belong to workspaces, windows
> are views onto them — while "reopen closed window" is a window-centric Chrome
> concept. Recreating the tabs explicitly would duplicate them (persistence
> restores them too); leaning on persistence instead hits `restoreWorkspace`'s
> reparent path and would steal tabs from another window on the same workspace.
> Needs a decision on whether closing a window **closes** its tabs or **parks**
> them, which changes session-restore semantics.

## Navigation

- [x] Better address bar
- [x] URL suggestions
- [x] Search suggestions
- [x] Search history
- [x] Quick calculator
- [x] Unit conversions
- [x] Timezone conversion
- [x] Clipboard URL detection

## Downloads

- [x] Download manager
- [x] Progress popup
- [x] Pause / Resume — **within a session only.** The live `DownloadItem` lives
      in an in-memory map, so after a restart the buttons render but do nothing;
      see [`Work/BUGS.md`](Work/BUGS.md)
- [ ] Resume across restarts — needs `session.createInterruptedDownload` to
      rebuild a `DownloadItem` from the persisted row, plus the offset/ETag the
      row does not currently store
- [ ] Reconcile orphaned rows at boot — a download interrupted by quitting stays
      `in_progress` forever and cannot be cleared
- [ ] Virus scan hooks — needs a spec: which scanner, and what happens on a hit
- [x] Open file location

## History

- [x] Full history page
- [x] Search history
- [x] Delete by day
- [x] Recently visited

## Bookmarks

- [x] Bookmark manager
- [x] Bookmark folders
- [x] Import bookmarks
- [x] Export bookmarks
- [x] Bookmark sidebar

---

# v0.3 — Productivity

## Sidebar

- [x] Bookmarks
- [x] History
- [x] Downloads
- [ ] Notes — needs storage of its own; nothing in the app persists user text yet
- [ ] Reading list — needs storage, and a decision on whether it is a bookmark
      folder with a read/unread flag or its own entity
- [ ] Split screen controls

## Omnibox

- [ ] Weather answers — `enableWeather` and the `weather` result kind already
      exist, but no provider ever produces one, so the setting is currently dead
- [ ] Currency conversion — deliberately excluded from the unit converter
      because it needs live rates; wants a cached provider and an offline story
- [ ] Per-result actions (copy, open in new tab, remove from history)

## Split View

- [x] Two tabs side by side
- [x] Vertical split
- [x] Horizontal split
- [x] Resize divider
- [ ] Drag tabs between splits

## Workspaces

- [x] Workspace switching
- [x] Colour coded workspaces
- [x] Workspace icons
- [x] Workspace persistence

## Reading Mode

- [x] Distraction-free mode
- [x] Font controls
- [ ] Themes
- [ ] Text-to-speech

---

# v0.4 — Personalisation

## Themes

- [x] Dark
- [x] Light
- [x] AMOLED
- [x] Custom accent colours
- [x] Blur effects
- [x] Transparency controls

## New Tab Page

- [x] Wallpapers — colour, gradient or image per space, with blur and dim, from
      "Wallpaper…" in the space's context menu. Images are copied into the
      profile and served over `dandelion-media:`, because the chrome's `img-src`
      allows no `file:` and a data URL would put the picture through every
      `workspace:changed` broadcast
- [ ] Weather widget
- [x] Quick links
- [x] Search box
- [ ] Recent tabs
- [ ] Notes widget
- [ ] Custom widgets

## Appearance

- [x] Compact mode
- [x] Vertical tabs
- [ ] Floating tabs
- [ ] Custom toolbar
- [ ] Hide titlebar
- [x] Window vibrancy

---

# v0.5 — Privacy

## Tracking Protection

- [x] Tracker blocking
- [x] Fingerprinting protection
- [x] Third-party cookie controls — `Cookie` stripped on the way out and
      `Set-Cookie` on the way back, so third-party cookies are no longer stored.
      A third-party frame's own `document.cookie` writes are still out of reach:
      `webRequest` never sees them
- [x] Public-suffix list — bundled from publicsuffix.org and regenerated with
      `npm run psl`; the shield resolves real registrable domains instead of
      counting labels
- [x] HTTPS upgrade

## Privacy

- [x] Clear browsing data
- [x] Auto-clear on exit
- [x] Site permissions manager
- [x] Permission prompts

## Incognito

- [x] True isolated sessions — **except favicons.** The chrome renderer has no
      session of its own, so it fetches every site-chosen favicon URL through
      the persistent default session, outside the private partition and outside
      the block engine. The isolation is real for page content and leaks at the
      chrome's edge; see [`Work/BUGS.md`](Work/BUGS.md)
- [ ] Temporary downloads
- [x] Separate cookies

---

# v0.6 — Performance

## Browser

- [x] Smarter tab sleeping — inactive tabs sleep on the `tabs.sleepAfterMinutes`
      threshold the settings always advertised. The sweeper spares whatever is on
      screen (including the far half of a split), audible tabs, and pinned tabs
      unless `sleepPinnedTabs` is on. Memory-pressure and site-heuristic inputs
      are still ahead
- [ ] GPU optimisation
- [ ] Faster startup
- [ ] Lazy renderer loading
- [ ] Background throttling

## Resource Monitor

- [ ] Per-tab CPU
- [ ] Per-tab RAM
- [ ] Network usage
- [ ] Energy usage

---

# v0.7 — Power Features

## Developer Tools

- [x] Custom DevTools launcher
- [ ] Inspect element
- [ ] Network monitor
- [ ] Console shortcuts

## Command Palette

(Ctrl + K)

- [x] Open pages
- [x] Search settings
- [x] Execute browser commands
- [x] Quick navigation

## Mouse Gestures

- [ ] Back
- [ ] Forward
- [ ] Refresh
- [ ] Close tab
- [ ] Reopen tab

## Keyboard Shortcuts

- [x] Fully configurable shortcuts
- [x] Shortcut editor

---

# v0.8 — Sync

## Dandelion Account

- [ ] Browser sync
- [ ] Bookmark sync
- [ ] History sync
- [ ] Tabs sync
- [ ] Settings sync
- [ ] Encrypted sync

## Import

- [ ] Chrome
- [ ] Edge
- [ ] Brave
- [ ] Firefox
- [ ] Opera
- [ ] Arc

---

# v0.9 — Extensions

## Extension Support

- [x] Chrome extension compatibility
- [x] Extension manager
- [ ] Permissions viewer
- [ ] Disable per site
- [x] Developer mode

---

# v1.0 — Premium Experience

## Browser Experience

- [ ] Smooth 120Hz animations
- [ ] Native feeling window controls
- [ ] Zero unfinished UI
- [ ] Complete accessibility support
- [ ] Crash recovery
- [x] Session restore
- [x] Automatic updates — Windows and Linux. macOS cannot apply unsigned
      updates, so it needs an Apple Developer certificate first; see
      [RELEASING.md](docs/RELEASING.md)

## Accessibility

The specifics behind "Complete accessibility support" above.

- [ ] Roving tabindex for the tab strips — every row is currently `tabIndex=0`,
      so a strip is one tab stop per tab instead of one stop with arrow keys
- [ ] Screen-reader pass (NVDA / VoiceOver) over the overlays: reader, sessions,
      zoom popover, downloads bubble, tab switcher
- [ ] High-contrast theme
- [ ] Verify accent-on-surface contrast in light mode

## Security

- [ ] Sandboxed renderer improvements
- [x] Secure credential storage
- [ ] Certificate viewer
- [ ] Password breach detection — `PasswordAuditIssue` exists as a type, but no
      service implements the audit behind it

---

# Future Ideas

## AI

- [x] AI webpage summary
- [x] AI sidebar
- [x] AI translation
- [ ] AI writing assistant
- [ ] AI search refinement

## Media

- [ ] Picture-in-picture improvements
- [ ] Mini player
- [ ] Audio controls
- [ ] Global media controls

## Utilities

- [ ] QR code generator
- [ ] Screenshot tool
- [ ] Colour picker
- [ ] PDF viewer
- [ ] Markdown viewer

## Advanced

- [x] Profiles
- [ ] Container tabs
- [ ] Workspace sharing
- [ ] Remote tab sharing
- [ ] Cloud clipboard
- [ ] Built-in terminal
- [ ] Web app mode
- [ ] Progressive Web App installer

---

# Polish Checklist

- [ ] Every interaction animated
- [ ] Consistent spacing
- [ ] Consistent iconography
- [ ] No placeholder UI
- [ ] Responsive at every window size
- [ ] Keyboard accessible
- [ ] No layout shift
- [ ] No flashing components
- [ ] Production logging
- [ ] Full automated tests
- [ ] Cross-platform support
- [ ] Native feeling on Windows, macOS and Linux

---

# Long-Term Vision

Create a browser that combines:

- Arc's polish
- Zen Browser's simplicity
- Vivaldi's power
- Brave's privacy
- Chrome's compatibility

...while remaining lightweight, elegant and developer-friendly.
