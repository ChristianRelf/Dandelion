# Assessment — Migrating Dandelion from Electron to a Chromium Fork

This document evaluates a single proposal: **abandon Electron and build Dandelion on a fork of
Chromium**, motivated by Google blocking sign-in inside Dandelion with its "embedded user-agent"
error page.

It exists so that the decision is made against measured numbers rather than intuition.

**Recommendation: do not migrate.** The evidence below shows the proposal rests on a premise that
does not hold — Electron already _is_ Chromium — and that the migration cannot be shown to fix the
problem that motivates it, while costing the entire existing codebase and taking on a weekly
security obligation indefinitely.

---

## 1. The question

> Google refuses to authenticate inside Dandelion. Would shipping a real Chromium fork fix it?

Everything below serves that question. A Chromium fork may be defensible for _other_ reasons
(§7), but those are a different decision and should not be smuggled in under this one.

## 2. What was measured

All findings are from driving the real sign-in flow under Dandelion's own session configuration
(Electron 43.1.1, Windows 11).

| Finding                                                         | Result                                                                                        |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Chromium version Electron ships                                 | **`Chrome/150.0.7871.114`** — current, genuine Chromium                                       |
| User agent after `chromeUserAgent()` strip                      | Clean stock Chrome; no `Electron` token, in both the request header and `navigator.userAgent` |
| Google's response to the **raw** Electron UA                    | Navigation rejected outright (`ERR_FAILED`)                                                   |
| Google's response to the **stripped** UA                        | Sign-in page renders normally                                                                 |
| Requests blocked by the blocklist on Google pages               | **Zero**                                                                                      |
| `Sec-CH-UA` Client Hints sent (verified server-side over HTTPS) | **None** — `sec-fetch-*` sent normally, all three `sec-ch-ua*` headers absent                 |
| `--enable-features=UserAgentClientHint`                         | Does **not** restore them; Electron disables this below the switch layer                      |
| `navigator.userAgentData.brands`                                | `[Not;A=Brand, Chromium]` — no `"Google Chrome"` brand                                        |

Two genuine defects surfaced during the investigation. **Neither is the cause of the Google block**,
and both are fixable within Electron:

- **Third-party cookie misclassification.** `topUrlForWebContents` ([tab-manager.ts:958](../src/main/browser/tab-manager.ts#L958))
  returns the tab's _last-committed_ URL, but a navigation's request is sent before the new URL
  commits. Google therefore gets classified as third-party against itself, and
  `/ServiceLogin`, `/InteractiveLogin` and `/v3/signin/identifier` were all observed going out
  **cookieless**. This affects the first request of _every_ cross-site navigation.
- **All popups denied.** `setWindowOpenHandler` ([tab-manager.ts:724](../src/main/browser/tab-manager.ts#L724))
  returns `{ action: 'deny' }` for every `window.open()`, which was confirmed to return `null` to the
  page. This independently breaks every "Sign in with Google" button, which needs `window.opener` to
  post the credential back.

## 3. Why the engine is not the gate

The proposal assumes Google objects to Electron's engine. It does not.

1. **Electron already ships real Chromium** — `150.0.7871.114`, measured above. There is no engine
   upgrade available here; Dandelion renders with the same code Chrome renders with.
2. **The error page Google serves names CEF explicitly.** CEF is also real Chromium. A real-Chromium
   embedder is precisely what is _on_ the blocklist, so "being real Chromium" is demonstrably not the
   criterion that passes.
3. **Google's published definition is about the embedding surface, not the renderer.** Per the
   [OAuth 2.0 policies](https://developers.google.com/identity/protocols/oauth2/policies), an
   embedded user-agent is:

   > "software libraries that allow a developer to insert arbitrary scripts, alter the default
   > routing of a request to the Google OAuth server, or access session cookies."

   Dandelion satisfies all three, by design and deliberately:

   | Criterion                | Where                                                                                                                                   |
   | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
   | insert arbitrary scripts | [tab-manager.ts:466](../src/main/browser/tab-manager.ts#L466), [:520](../src/main/browser/tab-manager.ts#L520) — reader-mode extraction |
   | alter default routing    | [privacy.service.ts:74](../src/main/services/privacy/privacy.service.ts#L74) — HTTPS-upgrade `redirectURL`                              |
   | access session cookies   | [session-manager.ts:111](../src/main/browser/session-manager.ts#L111) — cookie manager                                                  |

   **A Chromium fork does not shed these.** They are Dandelion's features. Reader mode still needs
   script injection; the shields still need request rerouting; the cookie manager still reads
   cookies. Chrome itself permits all three via extensions — so capability was never the real line.

The practical conclusion: Google's gate is **browser recognition**, not engine provenance. That is an
identity property, and it is not purchased by changing build systems. A brand-new Chromium fork
shipped by one developer has no more recognition than an Electron app does.

### 3.1 The one real engine difference

Client Hints are a genuine, structural gap: real Chromium sends `sec-ch-ua`, `sec-ch-ua-mobile` and
`sec-ch-ua-platform` on every HTTPS request; Electron sends none and cannot be switched into sending
them. A fork would fix this specific signal.

This is the strongest argument for migrating, and it is still not sufficient — because it is
unverifiable whether Client Hints are what Google is gating on (§6), and because the same signal can
be forged from `onBeforeSendHeaders` at near-zero cost if that is genuinely all that stands in the
way. Forging it is not recommended: `navigator.userAgentData.brands` would still lack `"Google
Chrome"`, so the headers and the JS would contradict each other and the mismatch is trivially
detectable.

## 4. What the migration costs

### 4.1 Build infrastructure

From Chromium's [official Windows build instructions](https://chromium.googlesource.com/chromium/src/+/main/docs/windows_build_instructions.md):

| Requirement              | Value                                                  |
| ------------------------ | ------------------------------------------------------ |
| Free disk space          | **"At least 100GB … on an NTFS-formatted hard drive"** |
| Git cache                | **~30 GB** for Chromium alone                          |
| Initial `fetch chromium` | **"over an hour on even a fast connection"**           |
| RAM                      | 8 GB minimum, **16 GB+ strongly recommended**          |
| CPU                      | more cores better; **"20+ not excessive"**             |
| Toolchain                | Visual Studio 2026 (≥17.0.0), Desktop C++ + MFC/ATL    |
| Windows SDK              | 10.0.26100.7705                                        |

This is a permanent tax on every contributor and every CI machine, not a one-off setup.

### 4.2 The security treadmill — the decisive cost

From Chromium's [release cycle](https://chromium.googlesource.com/chromium/src/+/main/docs/process/release_cycle.md):

> "Chrome ships a new milestone (major version) to the stable channel every four weeks."
>
> "**The stable channel is refreshed every week**, and the extended stable channel is refreshed every
> two weeks."

A fork inherits that cadence as an obligation. **Every week**, upstream ships security fixes for
vulnerabilities that are public and, often, actively exploited. A fork that lags is shipping a
knowingly exploitable browser to its users, and a browser is the single most attacked program on a
user's machine. Missing that treadmill is not a quality problem; it is a duty-of-care problem.

Today Electron absorbs this entirely: it tracks even-numbered Chromium releases on an 8-week major
cadence and supports the **latest three stable majors** with security updates. That work is currently
free. Forking means buying it, weekly, forever — and it is the single largest line item in this
proposal.

Brave and Vivaldi both handle this by maintaining a continuously-rebased _patch set_ against upstream
Chromium rather than truly forking it, and both staff dedicated engineers for that treadmill alone.
(Earlier in discussion I cited specific headcounts for these teams; I could not verify those figures
and they should not be relied upon. The structural point — that this is a staffed, ongoing function —
stands.)

### 4.3 What gets deleted

This is not a port. It is a rewrite:

| Area           | Files   | Lines      | Fate under a Chromium fork                                                                                                                                                         |
| -------------- | ------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/main`     | 63      | 7,180      | **Discarded.** `TabManager`, `SessionManager`, `PrivacyService`, tRPC IPC routers, `better-sqlite3` storage and every service are written against Electron APIs. Rewritten in C++. |
| `src/renderer` | 75      | 8,165      | **Rewritten** as Chromium WebUI or C++ Views.                                                                                                                                      |
| `src/preload`  | 1       | 41         | **Discarded.** No equivalent concept.                                                                                                                                              |
| `src/shared`   | 46      | 3,015      | Mostly portable (types, schemas, utils) — the only meaningful survivor.                                                                                                            |
| **Total**      | **185** | **18,401** | **~84% discarded or rewritten**                                                                                                                                                    |

Also lost or rebuilt from scratch: the design system, the 35-test suite, the Playwright e2e harness,
electron-builder packaging, code signing, and `electron-updater`.

## 5. What is actually being traded

A working browser — with a design system, a green test suite, and a documented architecture — is
exchanged for a multi-year project requiring a build farm and a permanent security function, in order
to fix **one login**, with no evidence the login works at the end.

## 6. The unverifiable core

The decisive weakness of this proposal is not its cost. It is that **the payoff cannot be validated
before the cost is paid.**

Confirming that a Chromium fork unblocks Google sign-in requires authenticating a real Google account
through a real fork. There is no cheap experiment, no spike that answers it, and no way to know from
outside. Google does not publish the signals, and iterates them deliberately.

So the honest framing is: this is a multi-year, unbounded investment against an **unfalsifiable
hypothesis**, aimed at a gate whose owner actively moves it. That is the argument against — not the
disk space.

## 7. Reasons that _would_ justify a Chromium fork

To be fair to the proposal, these are real and worth naming — they are simply not this decision:

- **Independence from Electron's release cadence** and control over which Chromium features ship.
- **Engine-level features Electron cannot express** — true per-site process isolation policy, custom
  network stack behaviour, Client Hints (§3.1), a real extensions system.
- **A serious, staffed, long-horizon browser product** where the fork is the product strategy.

If any of these become the actual goal, this assessment should be redone against _that_ goal. It
would then be a green-field project that reuses Dandelion's design language and product thinking, not
a migration of this repository.

## 8. Recommendation

1. **Do not migrate.** The premise does not hold and the payoff is unverifiable.
2. **Accept the limitation.** Google sign-in does not work in Electron-based browsers. Record it as a
   known structural limitation with this reasoning. It does not affect anything else in the browser.
3. **Fix the real defects** found on the way (§2) — the cookie misclassification and the denied
   popups. Both are genuine correctness bugs, both are Dandelion's own, and both are cheap.
4. **Do not forge Client Hints** to evade the check. It is detectable via the JS/header brand
   mismatch, it is an arms race against a maintained control, and it risks the user's Google account
   being flagged.

## 9. If the fork proceeds anyway

Then it should start with a **measurement spike, not a migration**, in this order:

1. Install `depot_tools`, run `fetch chromium`, and complete one baseline build on the target
   hardware. Record wall-clock time, peak disk, and peak RAM.
2. Apply one trivial patch (e.g. a brand string), rebuild, and record the **incremental** build time.
   This is the number that governs daily life in a fork.
3. Rebase that patch across one upstream milestone bump and record the effort.
4. Only then estimate the port.

Steps 1–3 cost days, not years, and will settle the question more honestly than any further
argument. Note that they still do **not** answer §6.

---

## Appendix — reproduction

The findings in §2 were produced by driving `accounts.google.com` under Dandelion's session
configuration and reading headers from the server side (an HTTPS echo endpoint) rather than from
`webRequest` observers, which do not see the full set of headers Chromium appends late in the
network stack. Client Hints absence was confirmed both with and without `setUserAgent`, ruling out
the UA override as the cause.
