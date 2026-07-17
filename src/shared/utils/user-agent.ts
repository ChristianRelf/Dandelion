/**
 * Strip the `Electron/<ver>` and app-name (`Dandelion/<ver>`) tokens from a
 * default Electron user agent, leaving a stock Chrome UA at the real bundled
 * Chromium version — no impossible/spoofed version.
 *
 * Applied in two places so every context presents the *same* identity: globally
 * via `app.userAgentFallback` (which the default session — and the `window.open`
 * popups that fall back to it — use) and per partition session. Google refuses
 * OAuth sign-in to a user agent that still admits it is Electron, so a popup left
 * on the default, un-stripped UA is turned away even though the tabs are not.
 */
export function stripBrandingFromUserAgent(userAgent: string, appName: string): string {
  return userAgent
    .replace(/ Electron\/[\d.]+/, '')
    .replace(new RegExp(` ${appName}\\/[\\d.]+`, 'i'), '');
}
