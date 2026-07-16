# Dandelion — Known Bugs

Defects found while auditing the browser. A bug here is something **broken against what already
exists** — not work that hasn't been built yet. Planned features live in [TODO.md](TODO.md), and
defects that have been fixed move to [BUGS-FIXED.md](BUGS-FIXED.md).

Priorities: **P1** = fix before a public release · **P2** = noticeable / worth fixing · **P3** =
rough edge.

Status: **Confirmed** = reproduced, with the reproduction recorded · **Suspected** = observed once,
not yet isolated.

---

## Privacy engine

### P2 · Confirmed · Third-party cookies are stored, only never sent

The same feature deletes the `Cookie` **request** header but there is no `onHeadersReceived`, so
`Set-Cookie` still lands and `document.cookie` is untouched. Third-party cookies are therefore still
written to disk — the feature does not deliver the privacy it advertises in the README and settings
UI. Either strip `Set-Cookie` too, or narrow the claim.

## Tabs & windows

### P1 · Confirmed · `Ctrl/Cmd+N` steals a tab out of the window you were using

Opening a new window moves the *current* window's active tab into the new one. Window 1's content
area goes blank while its tab strip still renders that tab as active; clicking it does nothing
visible, because it now drives window 2.

**Reproduction.** Browse to a page, press `Ctrl+N`. The new window shows the tab you were just on;
the original is left empty.

**Why.** `openWindow()` ([app-context.ts](../src/main/app/app-context.ts)) creates the window with
`activeWorkspaceId = null`. The new renderer's `bootstrap()` queries `initialState`, where
`dandelionWindow?.activeWorkspaceId ?? workspaces[0]?.id` falls through to **the workspace window 1
already has**. `restoreWorkspace` then hits its "already open" branch — `listByWorkspace` is not
window-filtered — and `reparent()`s window 1's live tab into window 2. Window 1's `layout()` is
never re-run, and `tab:activated` for window 2 is filtered out by the renderer's `windowId` check,
so window 1's chrome never learns the tab left.

`window.newPrivate` is unaffected precisely because it pre-sets `created.activeWorkspaceId` before
the renderer boots; `window.new` does not, which is the asymmetry that exposes this.

**Why it is still open.** The mechanical fix (filter `alreadyOpen` by `windowId`) is not sufficient:
the code then falls through to the `persisted` branch and re-materialises the *same* stored tabs
into the new window, duplicating them. It needs a decision first — **may two windows share a
workspace?** If yes, tab lists must become window-scoped throughout; if no, `Ctrl+N` should create
or adopt its own workspace. Deferred from v0.2.1 as design work, not a patch.

### P1 · Confirmed · Every popup is blocked — `window.open()` returns `null`

`setWindowOpenHandler` denies **all** popups and re-opens the URL as a tab
([tab-manager.ts:724-733](../src/main/browser/tab-manager.ts#L724-L733)). Confirmed by evaluating
`window.open(...)` in a real page: it returns `null`.

**Impact.** Any flow that depends on a popup and its opener is broken. "Sign in with Google" and
most OAuth buttons open a popup and wait for `window.opener.postMessage` to hand back the
credential; with no opener there is no channel home, so even a successful sign-in delivers nothing.

**Fix.** Match real browser behaviour: route `disposition === 'new-window'` (i.e. `window.open` with
features) to an actual popup window on the same session via `{ action: 'allow' }`, preserving the
opener chain, and keep `foreground-tab` / `background-tab` (i.e. `target="_blank"` links) becoming
tabs.

## Appearance

### P3 · Suspected · Active tab pill keeps light styling after switching to dark

Switching Theme → Dark from Settings left the active tab pill rendered light while the rest of the
chrome went dark; a later capture (after tabs re-rendered) showed it correctly dark. `data-theme`
flips on `<html>` and `body` background updates immediately, so this looks like the tab row not
restyling until it re-renders — but it was observed in a screenshot mid-session and has not been
isolated. Reproduce before fixing; it may just be the theme transition animation.

## Chrome & commands

_Carried over from earlier audits; not yet re-verified against current `main`._

- **P2** The rounded content frame doesn't clip the native `WebContentsView` — web pages render
  square-cornered inside the rounded frame
  ([ContentArea.tsx](../src/renderer/components/chrome/ContentArea.tsx)). Round the native view in
  the main process, or accept + document.
- **P2** `tools.print` (⌘P) forwards to the renderer but has no handler → it's a dead command. Add a
  main-side `webContents.print()` proc.
- **P3** `tools.clearBrowsingData` opens Settings instead of a dedicated "Clear browsing data"
  dialog (a `privacy.clearData` dialog with time-range + category checkboxes).
- **P3** `downloads.start` accepts a `savePath` that is ignored by `startOnSession`.
- **P3** Permissions support "allow once" vs "always" but there's no durable "allow for this
  session" scope (would need a session-scoped grant map + `expiresAt`/`scope` on
  `SitePermissionRule`).

---

## Not a bug

Recorded so they are not re-investigated:

- **Google sign-in fails with an "embedded user-agent" error.** Deliberate on Google's side, and
  correct by their published definition — an embedded user-agent is any library that can "insert
  arbitrary scripts, alter the default routing of a request to the Google OAuth server, or access
  session cookies", and Dandelion does all three by design (reader mode, HTTPS-upgrade redirects,
  the cookie manager). Not fixable from here; switching to a Chromium fork would not change it,
  since Electron already ships real Chromium and Google's own error page names other real-Chromium
  embedders. The cookie bug above is a genuine defect found while investigating this, but it is not
  the cause.
- **The user-agent strip in `SessionManager.chromeUserAgent()` looks like a hack but is
  load-bearing.** With the stock Electron UA, Google rejects the sign-in navigation outright
  (`ERR_FAILED`). Don't "simplify" it away.
