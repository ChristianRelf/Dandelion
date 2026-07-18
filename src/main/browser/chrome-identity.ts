import type { WebContents } from 'electron';
import type { Logger } from '../core/logger';

/**
 * An **opt-in** compatibility spoof: make the browser present as Google Chrome to
 * pages, so Google's sign-in ("this browser or app may not be secure") lets it
 * through.
 *
 * The header side is handled by {@link harmonizeClientHints} (it rewrites the
 * `Sec-CH-UA` request headers). This is the other half: the page's *JavaScript*
 * reads `navigator.userAgentData`, which no header rewrite can touch, and Electron
 * reports the generic `"Chromium"` brand there — with no `"Google Chrome"` — which
 * is exactly the identity Google treats as "not a real browser". The two halves
 * must move together, or the browser claims Google Chrome in its headers while its
 * JS says only Chromium, an inconsistency a real browser never has.
 *
 * This is a deliberate trade the browser otherwise avoids: it runs a script in the
 * page's **main world** (the reason tab views ship no preload), and it is a spoof
 * Google can detect by other signals and break at any time. It is therefore off by
 * default and gated behind `privacy.spoofChromeIdentity`.
 *
 * The script is injected at document-start via CDP
 * (`Page.addScriptToEvaluateOnNewDocument`) — the one hook that runs in the main
 * world *before* the page's own scripts, so the augmented brand is in place by the
 * time Google reads it. It only ever *adds* a `"Google Chrome"` brand mirroring the
 * real Chromium version — no version is invented — matching the header rewrite.
 */
export const CHROME_IDENTITY_SCRIPT = `(() => {
  try {
    const add = (brands) => {
      if (!Array.isArray(brands)) return brands;
      const hasChromium = brands.some((b) => b && /chromium/i.test(b.brand));
      const hasChrome = brands.some((b) => b && /google chrome/i.test(b.brand));
      if (!hasChromium || hasChrome) return brands.map((b) => ({ brand: b.brand, version: b.version }));
      const out = [];
      for (const b of brands) {
        out.push({ brand: b.brand, version: b.version });
        if (/chromium/i.test(b.brand)) out.push({ brand: 'Google Chrome', version: b.version });
      }
      return out;
    };
    const uad = navigator.userAgentData;
    if (uad) {
      const proto = Object.getPrototypeOf(uad);
      const brandsDesc = Object.getOwnPropertyDescriptor(proto, 'brands');
      if (brandsDesc && brandsDesc.get) {
        const getBrands = brandsDesc.get;
        Object.defineProperty(uad, 'brands', {
          configurable: true,
          enumerable: true,
          get() { return add(getBrands.call(this)); },
        });
      }
      const nativeGHEV = proto.getHighEntropyValues;
      if (typeof nativeGHEV === 'function') {
        const patched = function getHighEntropyValues(hints) {
          return nativeGHEV.call(uad, hints).then((values) => {
            const next = Object.assign({}, values);
            if (next.brands) next.brands = add(next.brands);
            if (next.fullVersionList) next.fullVersionList = add(next.fullVersionList);
            return next;
          });
        };
        try { patched.toString = nativeGHEV.toString.bind(nativeGHEV); } catch (e) {}
        Object.defineProperty(uad, 'getHighEntropyValues', { configurable: true, writable: true, value: patched });
      }
    }
    // A browser under automation reports true here; a real one does not. Electron
    // is not automated, but pin it so the spoof presents a coherent story.
    try { Object.defineProperty(navigator, 'webdriver', { configurable: true, get: () => false }); } catch (e) {}
  } catch (e) {
    // Never break the page over a compatibility spoof.
  }
})();`;

/**
 * The webContents whose debugger *we* attached, so {@link removeChromeIdentity}
 * never detaches one the DevTools front-end owns (that would break DevTools), and
 * {@link applyChromeIdentity} never stacks a second copy of the script.
 */
const attachedByUs = new WeakSet<WebContents>();

/**
 * Register {@link CHROME_IDENTITY_SCRIPT} to run at document-start on every future
 * navigation in `webContents`, via the Chrome DevTools Protocol.
 *
 * CDP is the only hook that reaches the main world before page scripts without
 * turning off context isolation. The cost is that the DevTools front-end wants the
 * same debugger channel — {@link TabManager.toggleDevTools} releases this first so
 * DevTools can still open. The script only affects **future** documents, so a page
 * already loaded needs a reload to pick it up.
 */
export function applyChromeIdentity(webContents: WebContents, logger: Logger): void {
  // Already attached — either we set it up (don't stack a second script) or the
  // DevTools front-end holds the channel (we can't, and shouldn't fight it).
  if (webContents.isDestroyed() || webContents.debugger.isAttached()) return;
  try {
    webContents.debugger.attach('1.3');
  } catch (error) {
    logger.warn('chrome-identity: could not attach debugger', error);
    return;
  }
  attachedByUs.add(webContents);
  void webContents.debugger
    .sendCommand('Page.enable')
    .then(() =>
      webContents.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument', {
        source: CHROME_IDENTITY_SCRIPT,
      }),
    )
    .catch((error) => logger.warn('chrome-identity: could not register document script', error));
}

/** Release the spoof's debugger — only when we were the ones holding it. */
export function removeChromeIdentity(webContents: WebContents): void {
  if (webContents.isDestroyed() || !attachedByUs.has(webContents)) return;
  attachedByUs.delete(webContents);
  try {
    webContents.debugger.detach();
  } catch {
    // Already detached.
  }
}
