# Ad blocking

Dandelion blocks ads with the same filter lists and filter syntax the major
content blockers use — EasyList, EasyPrivacy and the uBlock Origin lists,
compiled by [`@ghostery/adblocker`](https://github.com/ghostery/adblocker).

This document covers how that is wired, and — just as importantly — what it does
not do.

## The two engines, and why there are two

| | `FilterEngineService` | `BlockEngine` |
|---|---|---|
| Source | EasyList / EasyPrivacy / uBO, downloaded | ~90 curated domains, bundled |
| Syntax | Full Adblock Plus | Hostname suffix only |
| Cosmetic filtering | Yes | No |
| Available | After the first list download | Immediately |

`BlockEngine` predates the filter engine and is deliberately kept. The filter
lists are fetched over the network, so on a cold first run there is a window —
usually a few seconds — in which no compiled engine exists. Without a fallback
the browser would ship with ad blocking advertised and nothing blocking. The
bundled list covers the common ad and tracker domains during that window.

Once an engine has loaded it takes precedence, and `BlockEngine` is consulted
**only** when the filter lists express no opinion at all. In particular an
exception rule (`@@…`) suppresses the fallback: the lists use exceptions to keep
sites working, and letting a coarser blocklist re-block what EasyList
deliberately allowed would reintroduce the breakage the exception exists to fix.

## One engine per category

There is one engine for each of `ad`, `tracker` and `fingerprinter` rather than
a single merged engine. A merged engine returns one verdict, which cannot
answer either question the UI needs to ask:

- **Which counter does this belong to?** The per-tab shield report distinguishes
  ads from trackers from fingerprinters.
- **Is this category even enabled?** The three Settings toggles are independent,
  and a merged engine cannot honour `blockAds` on while `blockTrackers` is off.

The cost is roughly 25 MB of resident memory in the main process for the three
compiled engines.

## What each toggle now does

- **Block ads** — EasyList, uBO filters and uBO annoyances. This is the toggle
  that also drives **cosmetic filtering** (element hiding), scriptlet injection,
  and `$csp` directives, because those rules live almost entirely in the ad
  lists.
- **Block trackers** — EasyPrivacy and uBO privacy.
- **Block fingerprinting** — uBO badware and resource-abuse (this is also where
  cryptominers are covered).

## Cosmetic filtering

Network blocking stops an ad from loading; it does not remove the empty slot,
the "please disable your ad blocker" interstitial, or ads served from the site's
own origin. Cosmetic filtering handles those by injecting CSS and scriptlets
into each frame.

This uses the frame preload shipped by `@ghostery/adblocker-electron-preload`,
which reports a document's classes, ids and hrefs to the main process and
applies the rules it gets back. Its two IPC handlers are process-global rather
than per-session, so they are registered once; the preload script itself is
registered per session.

## Caching and refreshing

Compiled engines are serialised to `userData/Filters/<category>.engine.bin`
alongside a `.meta.json` recording the list set and build time.

- On launch, a valid cache is deserialised in milliseconds.
- A cache is rejected — and rebuilt — when the list catalogue changed (an app
  update edited `filter-lists.ts`) or when the serialisation format does not
  match the installed `@ghostery/adblocker`.
- Lists older than three days are refreshed in the background. Freshness is
  re-checked every six hours, because a browser stays open for days.

Startup never waits on the network. `initialize()` awaits only the disk cache;
downloads continue in the background.

The scriptlet resources URL is pinned to the git tag of the
`@ghostery/adblocker` release actually installed, derived from its
`package.json`. That file is parsed by the installed package's own reader, so a
newer format than the parser understands would be rejected wholesale — deriving
the tag means the two cannot drift when the dependency is upgraded.

## Failure behaviour

Every failure degrades rather than throws:

| Failure | Result |
|---|---|
| A list will not download | Category keeps its previous engine, or falls back to `BlockEngine` |
| Cache unreadable or stale format | Rebuilt from the network |
| Preload cannot be resolved | Network blocking continues; cosmetic filtering is disabled and logged |
| Malformed URL in a `$csp` lookup | Response passes through unmodified |

## Interaction with existing privacy features

- **Google sign-in** stays exempt. `isGoogleAuthUrl` short-circuits both network
  blocking and cosmetic injection, for the reasons in
  [`google-signin-fix.md`](./google-signin-fix.md).
- **Main-frame requests are never blocked** by the filter engine. Cancelling one
  replaces the page the user asked for with a network error, which is a
  navigation failure rather than an ad being hidden.
- **CSP directives are merged, never replaced.** A site's own
  `Content-Security-Policy` is preserved and the filter's directives are
  appended, because CSP intersects and the strictest policy wins. Replacing the
  header would let a `$csp` filter silently *relax* a site's protection, turning
  an ad-blocking rule into a security downgrade.

## Known limitations

- **No per-site allowlist.** There is no "pause blocking on this site" control
  yet. When a site breaks, the only remedy is turning a category off globally.
  This is the most significant gap and the natural next piece of work.
- **The shield report has no UI.** `PrivacyService` counts what it blocks and
  emits `shield:report`, but no renderer component consumes it, so the counts
  are currently invisible.
- **No user-supplied custom filters or extra list subscriptions.**
- **`$removeparam`, `$replace` and HTML filtering are not applied** — only the
  network, cosmetic and CSP rule types described above.
