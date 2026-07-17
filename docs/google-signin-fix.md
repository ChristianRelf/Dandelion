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

| Flow | Cross-site request that was stripped |
| --- | --- |
| Signed-in state on YouTube | `youtube.com` → `google.com` / `accounts.google.com` |
| Gmail data / API auth | `mail.google.com` → `googleapis.com` (SAPISID auth) |
| "Sign in with Google" / One Tap | any site → `accounts.google.com` iframe |
| OAuth / GIS token acquisition | embedder → `accounts.google.com` / `apis.google.com` |

Because these are different registrable domains, `isThirdParty` classified them
as third-party and the shield sent them cookieless — so Google never saw the
session and sign-in failed, looped, or showed the user as logged out.

## What was already correct (verified, no change)

The audit confirmed the following were **not** the problem and were left as-is:

- **Persistent sessions.** Non-private profiles use `persist:dandelion-<id>`
  partitions (`src/main/services/profile.service.ts`), so cookies, Local
  Storage, IndexedDB, Cache Storage and Service Workers persist to disk. Private
  profiles intentionally use in-memory partitions.
- **User-Agent.** `SessionManager.chromeUserAgent` strips the ` Electron/<ver>`
  and ` Dandelion/<ver>` tokens from every partition session's UA, so pages
  (tabs and OAuth popups, which share the opener's partition session) see a stock
  Chrome UA at the real bundled Chromium version — no `Electron` token, no
  impossible/spoofed version.
- **Security flags.** Tab views and popups use `webSecurity: true`,
  `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`. There is
  no `webSecurity: false`, no `allowRunningInsecureContent`, and no experimental
  flags. Nothing was weakened.
- **OAuth popups.** `window.open` popups (disposition `new-window`) are allowed
  with `outlivesOpener: false`, preserving `window.opener` so the OAuth popup can
  `postMessage` its result back to the opener.
- **Block list.** No Google _authentication_ domain is in the built-in blocklist;
  only Google's ad/analytics domains (`doubleclick.net`, `googlesyndication.com`,
  `google-analytics.com`, `googletagmanager.com`, …) are.

## Changes made

| File | Change | Why |
| --- | --- | --- |
| `src/main/services/privacy/google-auth-domains.ts` _(new)_ | `GOOGLE_AUTH_DOMAINS` list + `isGoogleAuthUrl(url)` | Single source of truth for "this request is Google sign-in infrastructure". |
| `src/main/services/privacy/third-party.ts` | `shouldStripCookies` returns `false` for `isGoogleAuthUrl(requestUrl)` | Lets Google's cross-domain SSO cookies flow (both `Cookie` and `Set-Cookie`, since both directions call this one function). |
| `src/main/services/privacy/privacy.service.ts` | Skip the block-engine match when `isGoogleAuthUrl(url)` | Guarantees a Google auth request is never cancelled, even if a user-loaded hosts/EasyList blocklist would match it. |
| `src/main/browser/session-manager.ts` | Opt-in `traceAuthCookies` (env `DANDELION_AUTH_DEBUG=1`) + debug-log the applied UA | Diagnostics: see exactly which Google cookies are stored/dropped, with SameSite/Secure flags, and confirm the UA. |
| `tests/unit/google-auth-domains.test.ts` _(new)_ | Unit tests for `isGoogleAuthUrl` (incl. look-alike domains) | Prevent `notgoogle.com`/suffix-confusion regressions. |
| `tests/unit/third-party.test.ts` | Added "Google sign-in exemption" cases | Lock in that Google cookies survive while non-Google trackers are still stripped on Google pages. |

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
