# Google Sign-In Compatibility — Audit & Fix

_Status: fixed in `fix/google-signin-compat`._

## Summary

Signing into Google services (Gmail, YouTube, Google Accounts, "Sign in with
Google") failed because the privacy shield stripped **third-party cookies** from
Google's cross-domain sign-in requests. Google authentication is cross-domain by
design, so the browser was quietly logging the user out mid-flow.

The fix exempts Google's first-party sign-in infrastructure from third-party
cookie stripping and from request blocking, while leaving every other cross-site
cookie shielded and every non-Google (and third-party Google _ad_) domain
blockable. No security features were disabled and no browser identity was
spoofed.

## Root cause

`src/main/services/privacy/privacy.service.ts` attaches `onBeforeSendHeaders` /
`onHeadersReceived` filters that, when `privacy.blockThirdPartyCookies` is on
(**true by default** — `src/shared/constants/settings.defaults.ts`), delete the
`Cookie` header on outgoing cross-site subresource requests and strip
`Set-Cookie` on their responses (`shouldStripCookies` in
`src/main/services/privacy/third-party.ts`).

Google sign-in relies on cookies crossing registrable-domain boundaries:

| Flow                            | Cross-site request that was stripped                 |
| ------------------------------- | ---------------------------------------------------- |
| Signed-in state on YouTube      | `youtube.com` → `google.com` / `accounts.google.com` |
| Gmail data / API auth           | `mail.google.com` → `googleapis.com` (SAPISID auth)  |
| "Sign in with Google" / One Tap | any site → `accounts.google.com` iframe              |
| OAuth / GIS token acquisition   | embedder → `accounts.google.com` / `apis.google.com` |

Because these are different registrable domains, `isThirdParty` classified them
as third-party and the shield sent them cookieless — so Google never saw the
session and sign-in failed, looped, or showed the user as logged out.

## What was already correct (verified, no change)

The audit confirmed the following were **not** the problem and were left as-is:

- **Persistent sessions.** Non-private profiles use `persist:dandelion-<id>`
  partitions (`src/main/services/profile.service.ts`), so cookies, Local
  Storage, IndexedDB, Cache Storage and Service Workers persist to disk. Private
  profiles intentionally use in-memory partitions.
- **User-Agent (partition sessions).** `SessionManager.chromeUserAgent` strips
  the ` Electron/<ver>` and ` Dandelion/<ver>` tokens from every partition
  session's UA, so tab pages see a stock Chrome UA at the real bundled Chromium
  version — no `Electron` token, no impossible/spoofed version. _(But see the
  v0.2.8 follow-up: OAuth popups were **not** using a partition session.)_
- **Security flags.** Tab views and popups use `webSecurity: true`,
  `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`. There is
  no `webSecurity: false`, no `allowRunningInsecureContent`, and no experimental
  flags. Nothing was weakened.
- **Block list.** No Google _authentication_ domain is in the built-in blocklist;
  only Google's ad/analytics domains (`doubleclick.net`, `googlesyndication.com`,
  `google-analytics.com`, `googletagmanager.com`, …) are.

## Changes made

| File                                                       | Change                                                                              | Why                                                                                                                         |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `src/main/services/privacy/google-auth-domains.ts` _(new)_ | `GOOGLE_AUTH_DOMAINS` list + `isGoogleAuthUrl(url)`                                 | Single source of truth for "this request is Google sign-in infrastructure".                                                 |
| `src/main/services/privacy/third-party.ts`                 | `shouldStripCookies` returns `false` for `isGoogleAuthUrl(requestUrl)`              | Lets Google's cross-domain SSO cookies flow (both `Cookie` and `Set-Cookie`, since both directions call this one function). |
| `src/main/services/privacy/privacy.service.ts`             | Skip the block-engine match when `isGoogleAuthUrl(url)`                             | Guarantees a Google auth request is never cancelled, even if a user-loaded hosts/EasyList blocklist would match it.         |
| `src/main/browser/session-manager.ts`                      | Opt-in `traceAuthCookies` (env `DANDELION_AUTH_DEBUG=1`) + debug-log the applied UA | Diagnostics: see exactly which Google cookies are stored/dropped, with SameSite/Secure flags, and confirm the UA.           |
| `tests/unit/google-auth-domains.test.ts` _(new)_           | Unit tests for `isGoogleAuthUrl` (incl. look-alike domains)                         | Prevent `notgoogle.com`/suffix-confusion regressions.                                                                       |
| `tests/unit/third-party.test.ts`                           | Added "Google sign-in exemption" cases                                              | Lock in that Google cookies survive while non-Google trackers are still stripped on Google pages.                           |

### Exempt domains

`google.com`, `googleapis.com`, `gstatic.com`, `googleusercontent.com`,
`youtube.com` (each including all subdomains — `accounts.google.com`,
`apis.google.com`, `oauth2.googleapis.com`, etc.).

## Diagnostics

Run the app with `DANDELION_AUTH_DEBUG=1` to log each Google sign-in cookie as it
is stored or dropped, e.g.:

```
[auth] cookie stored name=SID domain=.google.com sameSite=no_restriction secure=true httpOnly=true cause=explicit profile=profile_1
```

A cookie that never appears is one Chromium rejected — typically a
`SameSite=None` cookie missing `Secure`, or one the shield stripped. The
session's applied User-Agent is also logged at debug level. For live inspection,
open DevTools on the auth tab (⌥⌘I / Ctrl+Shift+I) and watch the Network and
Application → Cookies panels.

## Trade-offs & limitations

- **One accepted privacy cost.** Exempting `google.com` from the request blocker
  also unblocks Google's _own_ ad/analytics subdomains under that root (e.g.
  `adservice.google.com`, `analytics.google.com`). This is deliberate: the auth
  flow touches many hosts under `google.com`, and reliability of sign-in was
  prioritised for Google's first-party domains. Third-party Google ad domains
  (`doubleclick.net`, `google-analytics.com`, `googletagmanager.com`,
  `googlesyndication.com`, `googleadservices.com`) are separate registrable
  domains and **remain blocked**.
- **Third-party-cookie phase-out.** This exemption mirrors the temporary
  carve-out stock Chromium grants Google's own auth while third-party cookies are
  deprecated. Long term, Google is moving sign-in to **FedCM**; if a flow
  requires FedCM and Electron's build lacks it, that is a platform limitation, not
  something this browser can work around.
- **Google-imposed limits remain.** Google may still gate certain flows it deems
  to originate from an embedded/automated browser. Because Dandelion now presents
  a genuine stock-Chrome UA over a real Chromium engine with standard security,
  the common "This browser or app may not be secure" block should not trigger —
  but any residual restriction enforced by Google (e.g. hardware-key/WebAuthn
  edge cases, enterprise SSO policies) is outside the browser's control and is not
  bypassed.

## Verification

- `npm run typecheck` (node + web), `npm run lint`, `prettier --check`: clean.
- `npx vitest run`: full suite green, including the new auth-domain and
  third-party exemption tests.
- Manual QA (recommended): with default settings, sign into
  `https://accounts.google.com`, then load `https://youtube.com` and
  `https://mail.google.com` and confirm the account is recognised without a
  re-login loop. Repeat a "Sign in with Google" button on a third-party site.

## Follow-up: v0.2.8

Two bugs the cookie fix above did not cover, both in the `window.open` path
(`src/main/browser/tab-manager.ts`).

### The "Sign in with Google" popup used the wrong session

**Symptom.** Only the "Sign in with Google" _popup_ failed — with Google's
unsupported-browser page ("JavaScript isn't enabled") — while tabs and every
other site worked.

**Cause.** `createView` sets `webPreferences.session` to the profile's configured
session for a tab's view, but `popupResult` did not. Overriding `webPreferences`
at all stops a `window.open` child inheriting the opener's session, so the popup
fell back to Electron's **default** session: a User-Agent still carrying the
`Electron` token (only partition sessions are stripped) and an empty cookie jar.
Google served that popup its "unsupported / secure browser" page. The code's own
comment claimed the popup "shares the opener's session" — it never did.

**Fix.** `popupResult` now sets `webPreferences.session` to
`sessions.getSession(profile)`, exactly as `createView` does — so the popup gets
the stock Chrome UA and shares the profile's cookies.

### `blob:` downloads threw a page error

**Symptom.** A JavaScript error on the page when downloading from some sites.

**Cause.** "Download", "Export" and "Open PDF" buttons commonly call
`window.open(URL.createObjectURL(blob))`. `isWebContentUrl` only accepts
`http/https/about:blank`, so the window-open handler **denied** the `blob:` URL
and returned `null` to the page — and the site's own script then threw
dereferencing the null window.

**Fix.** The handler now allows a `blob:` `window.open` through the popup path
(which shares the opener's session, so the popup's renderer can resolve the
blob). `data:` and other schemes stay denied, matching Chromium's own top-level
navigation rules.

Both are covered by `tests/unit/tab-window-open.test.ts`.

## Follow-up: v0.2.12 — the "This browser or app may not be secure" block

**Symptom.** Sign-in still ended on Google's _"Couldn't sign you in — This browser
or app may not be secure"_ page, even though the UA string presented as stock
Chrome and cookies now flowed.

**Cause.** The UA string was only half of the browser's advertised identity.
Chromium **also** announces its brand through **User-Agent Client Hints**, and
there it still told on itself: the default `Sec-CH-UA` carries an `"Electron"`
brand and **never** `"Google Chrome"`. So a server saw `Chrome/138…` in
`User-Agent` while the client hints said Electron — and that UA↔hints mismatch is
one of the signals Google's sign-in uses to flag a browser as "may not be
secure". Stripping the UA string alone never reached the hints, so the block
survived every fix above.

**Fix.** `src/shared/utils/client-hints.ts` (new) rewrites the
`Sec-CH-UA` / `Sec-CH-UA-Full-Version-List` brand lists on every outgoing request
(wired into the existing `onBeforeSendHeaders` filter in
`privacy.service.ts`) so the hints tell the same stock-Chrome story the UA does:

- the `"Electron"` brand is dropped;
- a `"Google Chrome"` brand is added, mirroring the version Chromium already
  stamped on its own `"Chromium"` brand — **no version is invented**;
- the greased `"Not A Brand"` entry (whose purpose is to be unpredictable) is
  left untouched.

It is anchored to Chromium's real reported version, so `Sec-CH-UA` (major) and
`Sec-CH-UA-Full-Version-List` (full) each come out consistent with the UA, and
the transform is idempotent. Applied to every request, not just Google's, so the
identity is consistent everywhere — the same reasoning as the always-on UA strip,
and it removes a fingerprinting mismatch rather than adding one.

Covered by `tests/unit/client-hints.test.ts`.

**What this does and does not promise.** It clears the specific "may not be
secure" block that the UA↔hints mismatch triggers. It does **not** claim to defeat
every server-side embedded-browser heuristic Google may apply — if Google gates a
flow by other means (enterprise SSO policy, WebAuthn edge cases, or a future
detection), that remains outside the browser's control, exactly as noted below in
`Work/BUGS.md`.

## Correction: v0.2.15 — v0.2.12 was necessary but not sufficient

Tested against the live flow, **v0.2.12 did not clear the block.** The console on
the rejected page (`ec=65620`, `GlifWebSignIn`) told the real story:

```text
navigator.userAgentData.brands = [ {"Not;A=Brand"}, {"Chromium", v150} ]
```

Two things this proves and v0.2.12 got wrong:

1. **This Electron build leaks no `"Electron"` brand at all** — the client hints
   are clean `Chromium`. The v0.2.12 premise ("the hints say Electron") was wrong
   for current Electron.
2. **A header rewrite can't reach `navigator.userAgentData`.** v0.2.12 made the
   `Sec-CH-UA` **header** claim `"Google Chrome"`, but the page's **JavaScript**
   still reported only `"Chromium"`. That header↔JS mismatch is an inconsistency a
   real browser never has — arguably a _worse_ tell than plain Chromium.

`ec=65620` is Google's **`disallowed_useragent`** policy: it blocks anything that
isn't a recognised standalone browser. Brave/Opera/Vivaldi/Arc/Edge pass because
they are compiled Chromium **browser forks** with their own product branding;
Dandelion is an **Electron app** reporting the generic `"Chromium"` identity, which
Google treats as "not a real browser." This is not cleanly fixable — the honest
resolution would be to be a real fork, which Electron isn't.

**What v0.2.15 ships:** an **opt-in** spoof (`privacy.spoofChromeIdentity`, off by
default; Settings → Privacy → "Present as Google Chrome"). When on, it makes both
halves claim Chrome _consistently_:

- the header rewrite (`harmonizeClientHints`) is now **gated on this setting**
  instead of always-on;
- `src/main/browser/chrome-identity.ts` (new) injects a script at document-start
  (via CDP `Page.addScriptToEvaluateOnNewDocument` — the only main-world,
  pre-page-script hook that doesn't disable context isolation) that adds a
  `"Google Chrome"` brand to `navigator.userAgentData`, mirroring the real
  Chromium version, and pins `navigator.webdriver` to `false`.

The honest caveats, restated in the Settings copy and in `Work/BUGS.md`: it is a
**spoof** — it runs a script in every page's main world (the one thing tab views
otherwise never do), Google can still detect it by other signals and re-block at
any time, and opening DevTools on a tab pauses it (both want the debugger
channel). It is off by default because presenting a false identity is a trade the
browser shouldn't make for everyone. Covered by
`tests/unit/chrome-identity.test.ts`.
