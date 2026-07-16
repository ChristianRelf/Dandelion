# Dandelion — Known Bugs

Defects found while auditing the browser. A bug here is something **broken against what already
exists** — not work that hasn't been built yet. Planned features live in [TODO.md](TODO.md).

Priorities: **P1** = fix before a public release · **P2** = noticeable / worth fixing · **P3** =
rough edge.

Status: **Confirmed** = reproduced, with the reproduction recorded · **Suspected** = observed once,
not yet isolated.

---

## Privacy engine

### P1 · Confirmed · Third-party cookie blocking strips cookies from first-party navigations

`blockThirdPartyCookies` is on by default and deletes the `Cookie` header from any request it deems
third-party ([privacy.service.ts:98-105](../src/main/services/privacy/privacy.service.ts#L98-L105)).
It decides third-party by comparing the request against `live.state.url` — the tab's **last
committed** URL ([tab-manager.ts:958-963](../src/main/browser/tab-manager.ts#L958-L963)).

A top-level navigation's request is sent _before_ the new URL commits, so the comparison runs against
the **previous** page. Navigating to any site from a different site — or from `dandelion://newtab` —
classifies the destination as third-party against itself and strips its cookies.

**Reproduction.** Driving the real Google sign-in flow, the entire entry chain went out cookieless:

```
GET https://accounts.google.com/ServiceLogin
GET https://accounts.google.com/InteractiveLogin?dsh=...
GET https://accounts.google.com/v3/signin/identifier?dsh=...
```

`rootDomain("newtab") !== "google.com"` → treated as third-party → `Cookie` deleted.

**Impact.** The first request of _every_ cross-site navigation loses its cookies, so any site
requiring a session appears logged-out on first hit. This is not Google-specific.

**Fix.** A top-level document request is first-party by definition: skip stripping when
`details.resourceType === 'mainFrame'`, and resolve the top URL from `details.frame?.top?.url`
(live at request time) rather than the lagging tab state. Verified to reduce stripped requests to
zero on the same flow. Needs a unit test over the first/third-party classifier.

### P2 · Confirmed · Third-party cookies are stored, only never sent

The same feature deletes the `Cookie` **request** header but there is no `onHeadersReceived`, so
`Set-Cookie` still lands and `document.cookie` is untouched. Third-party cookies are therefore still
written to disk — the feature does not deliver the privacy it advertises in the README and settings
UI. Either strip `Set-Cookie` too, or narrow the claim.

## Tabs & windows

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
