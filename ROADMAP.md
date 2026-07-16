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

- [ ] Polish existing UI
- [ ] Complete all unfinished buttons
- [ ] Improve animations
- [ ] Eliminate placeholder components
- [ ] Improve responsiveness
- [ ] Optimise startup time
- [ ] Fix memory leaks
- [ ] Improve tab performance

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
- [x] Pause / Resume
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

- [ ] Wallpapers — `WorkspaceWallpaper` (colour/gradient/image, blur, overlay)
      already exists as a type with no picker UI behind it
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
- [x] Third-party cookie controls
- [x] HTTPS upgrade

## Privacy

- [x] Clear browsing data
- [x] Auto-clear on exit
- [x] Site permissions manager
- [x] Permission prompts

## Incognito

- [x] True isolated sessions
- [ ] Temporary downloads
- [x] Separate cookies

---

# v0.6 — Performance

## Browser

- [ ] Smarter tab sleeping
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
- [ ] Automatic updates

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
