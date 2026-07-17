import { app, BrowserWindow, protocol } from 'electron';
import { APP_ID, APP_NAME, MEDIA_SCHEME } from '@shared/constants';
import { AppContext } from './app/app-context';
import { registerIpcHost } from './ipc/ipc-host';
import { buildApplicationMenu } from './app/menu';
import { registerMediaProtocol } from './app/media-protocol';
import { installSecurityHardening } from './app/security';
import { rootLogger } from './core/logger';

app.setName(APP_NAME);

// Must run before `whenReady`: a scheme cannot be given privileges once the
// protocol registry is frozen. `standard` gives it an origin, so the chrome can
// load it from an <img>.
protocol.registerSchemesAsPrivileged([
  { scheme: MEDIA_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

let context: AppContext | null = null;

function focusExistingWindow(): void {
  const window = context?.windows.first()?.browserWindow;
  if (!window) return;
  if (window.isMinimized()) window.restore();
  window.focus();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', focusExistingWindow);

  void app.whenReady().then(() => {
    if (process.platform === 'win32') app.setAppUserModelId(APP_ID);

    installSecurityHardening();

    context = new AppContext();
    context.bootstrap();
    registerIpcHost(context);
    registerMediaProtocol(context);
    buildApplicationMenu(context);

    context.settings.onChange(() => {
      if (!context) return;
      buildApplicationMenu(context);
      context.sessions.applySecureDns();
    });

    context.openWindow();
    rootLogger.info('Dandelion ready');

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) context?.openWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', () => {
    context?.shutdown();
    context = null;
  });
}
