import { router } from './trpc';
import { appRoutes, layoutRoutes, windowRoutes } from './routers/app.router';
import { tabRoutes } from './routers/tabs.router';
import { profileRoutes, workspaceRoutes } from './routers/workspaces.router';
import { bookmarkRoutes, downloadRoutes, historyRoutes } from './routers/browsing.router';
import { cookieRoutes, permissionRoutes, privacyRoutes } from './routers/privacy.router';
import { vaultRoutes } from './routers/vault.router';
import { aiRoutes, omniboxRoutes, searchRoutes } from './routers/discovery.router';
import { settingsRoutes, syncRoutes } from './routers/settings.router';
import { extensionRoutes } from './routers/extensions.router';

/** The complete typed API surface exposed to the renderer over IPC. */
export const appRouter = router({
  app: appRoutes,
  window: windowRoutes,
  layout: layoutRoutes,
  tabs: tabRoutes,
  profiles: profileRoutes,
  workspaces: workspaceRoutes,
  history: historyRoutes,
  bookmarks: bookmarkRoutes,
  downloads: downloadRoutes,
  permissions: permissionRoutes,
  cookies: cookieRoutes,
  privacy: privacyRoutes,
  vault: vaultRoutes,
  search: searchRoutes,
  omnibox: omniboxRoutes,
  ai: aiRoutes,
  settings: settingsRoutes,
  sync: syncRoutes,
  extensions: extensionRoutes,
});

export type AppRouter = typeof appRouter;
