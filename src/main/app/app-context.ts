import type { Profile, SessionReason, SessionTab, SessionWindow, Workspace } from '@shared/types';
import { createId } from '@shared/utils';
import { rootLogger, type Logger } from '../core/logger';
import { EventBus } from '../core/event-bus';
import { databasePath } from '../core/paths';
import { Db, Repositories } from '../storage';
import { SettingsService } from '../services/settings.service';
import { ProfileService } from '../services/profile.service';
import { WorkspaceService } from '../services/workspace.service';
import { HistoryService } from '../services/history.service';
import { BookmarksService } from '../services/bookmarks.service';
import { SearchService } from '../services/search.service';
import { PermissionsService } from '../services/permissions.service';
import { DownloadsService } from '../services/downloads.service';
import { PrivacyService } from '../services/privacy/privacy.service';
import { VaultService } from '../services/vault.service';
import { OmniboxService } from '../services/omnibox.service';
import { AIService } from '../services/ai/ai.service';
import { SyncService } from '../services/sync.service';
import { UpdateService } from '../services/update.service';
import { ExtensionsService } from '../services/extensions.service';
import { SessionManager } from '../browser/session-manager';
import { WindowManager } from '../browser/window-manager';
import { TabManager } from '../browser/tab-manager';
import type { DandelionWindow } from '../browser/dandelion-window';

/**
 * The composition root. Constructs every service and manager in dependency
 * order and wires their cross-references. A single instance is created at
 * startup and passed to the tRPC router as context.
 */
export class AppContext {
  readonly logger: Logger = rootLogger;
  readonly db: Db;
  readonly repos: Repositories;
  readonly events: EventBus;
  readonly settings: SettingsService;
  readonly profiles: ProfileService;
  readonly workspaces: WorkspaceService;
  readonly history: HistoryService;
  readonly bookmarks: BookmarksService;
  readonly search: SearchService;
  readonly permissions: PermissionsService;
  readonly downloads: DownloadsService;
  readonly privacy: PrivacyService;
  readonly sessions: SessionManager;
  readonly windows: WindowManager;
  readonly tabs: TabManager;
  readonly omnibox: OmniboxService;
  readonly vault: VaultService;
  readonly ai: AIService;
  readonly sync: SyncService;
  readonly updates: UpdateService;
  readonly extensions: ExtensionsService;

  constructor() {
    this.db = new Db(databasePath());
    this.repos = new Repositories(this.db);
    this.events = new EventBus();

    this.settings = new SettingsService(this.repos, this.events);
    this.profiles = new ProfileService(this.repos);
    this.workspaces = new WorkspaceService(this.repos, this.events);
    this.history = new HistoryService(this.repos);
    this.bookmarks = new BookmarksService(this.repos);
    this.search = new SearchService(this.repos, this.settings);

    this.privacy = new PrivacyService(this.settings, this.logger.child('privacy'));
    this.permissions = new PermissionsService(
      this.repos,
      this.events,
      this.logger.child('permissions'),
    );
    this.downloads = new DownloadsService(
      this.repos,
      this.events,
      this.settings,
      this.logger.child('downloads'),
    );
    this.sessions = new SessionManager(
      this.privacy,
      this.permissions,
      this.downloads,
      this.settings,
      this.logger.child('sessions'),
    );

    this.windows = new WindowManager(
      this.settings,
      this.events,
      this.repos.kv,
      this.logger.child('windows'),
    );
    this.tabs = new TabManager({
      windows: this.windows,
      sessions: this.sessions,
      workspaces: this.workspaces,
      profiles: this.profiles,
      history: this.history,
      privacy: this.privacy,
      permissions: this.permissions,
      settings: this.settings,
      repos: this.repos,
      events: this.events,
      logger: this.logger.child('tabs'),
    });

    this.omnibox = new OmniboxService({
      history: this.history,
      bookmarks: this.bookmarks,
      search: this.search,
      settings: this.settings,
      tabs: this.tabs,
    });
    this.vault = new VaultService(this.repos, this.events, this.logger.child('vault'));
    this.ai = new AIService(
      this.repos,
      this.events,
      this.settings,
      this.logger.child('ai'),
      (tabId) => this.tabs.getPageContext(tabId),
    );
    this.sync = new SyncService(this.repos, this.logger.child('sync'));
    this.updates = new UpdateService(this.events, this.logger.child('update'));
    this.extensions = new ExtensionsService(
      this.sessions,
      this.profiles,
      this.logger.child('extensions'),
    );
  }

  /** First-run guarantees: a default profile, workspace, DNS and session. */
  bootstrap(): { profile: Profile; workspace: Workspace } {
    const profile = this.profiles.ensureDefault();
    const workspace = this.workspaces.ensureDefault(profile.id);
    this.sessions.applySecureDns();
    this.sessions.getSession(profile);
    this.logger.info(`bootstrapped profile "${profile.name}" / workspace "${workspace.name}"`);
    return { profile, workspace };
  }

  openWindow(): DandelionWindow {
    return this.windows.createWindow();
  }

  /** Capture a restorable snapshot of all windows and tabs. */
  saveSession(reason: SessionReason): void {
    const windows: SessionWindow[] = this.windows.all().map((dandelionWindow) => {
      const tabs: SessionTab[] = this.tabs
        .listAll()
        .filter((tab) => tab.windowId === dandelionWindow.id)
        .sort((a, b) => a.index - b.index)
        .map((tab) => ({
          url: tab.url,
          title: tab.title,
          favicon: tab.favicon,
          workspaceId: tab.workspaceId,
          groupId: tab.groupId,
          pinned: tab.pinned,
          index: tab.index,
          active: tab.id === dandelionWindow.activeTabId,
        }));
      return {
        bounds: dandelionWindow.browserWindow.getBounds(),
        chromeState: dandelionWindow.chromeState(),
        activeWorkspaceId: dandelionWindow.activeWorkspaceId,
        tabLayout: dandelionWindow.tabLayout,
        tabs,
      };
    });

    this.repos.sessions.save({ id: createId('session'), reason, createdAt: Date.now(), windows });
    this.repos.sessions.prune(10);
  }

  shutdown(): void {
    try {
      this.saveSession('shutdown');
    } catch (error) {
      this.logger.warn('failed to save session on shutdown', error);
    }
    this.db.close();
  }
}
