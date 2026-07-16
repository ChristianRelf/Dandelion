import { app } from 'electron';

/**
 * Process-wide security hardening applied once at startup. Per-window and
 * per-session hardening lives in the WindowManager and SessionManager; this
 * covers app-level guards that apply to every `WebContents`.
 */
export function installSecurityHardening(): void {
  app.on('web-contents-created', (_event, contents) => {
    // Disallow the legacy <webview> tag entirely — tabs use WebContentsView.
    contents.on('will-attach-webview', (event) => event.preventDefault());
  });
}
