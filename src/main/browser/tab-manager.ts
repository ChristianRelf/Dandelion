import { WebContentsView, type WebContents } from 'electron';
import type {
  ClosedTab,
  Profile,
  ReaderArticle,
  ReaderBlock,
  SplitOrientation,
  Tab,
  TabGroup,
  TabGroupColor,
  TabThumbnail,
  VisitTransition,
} from '@shared/types';
import { INTERNAL_PAGES, isInternalUrl, LIMITS } from '@shared/constants';
import {
  clampSplitRatio,
  createId,
  getHostname,
  prettifyUrl,
  splitPaneBounds,
} from '@shared/utils';
import type { Repositories } from '../storage';
import type { PersistedTab } from '../storage';
import type { EventBus } from '../core/event-bus';
import type { Logger } from '../core/logger';
import type { WindowManager } from './window-manager';
import type { SessionManager } from './session-manager';
import type { WorkspaceService } from '../services/workspace.service';
import type { ProfileService } from '../services/profile.service';
import type { HistoryService } from '../services/history.service';
import type { PrivacyService } from '../services/privacy/privacy.service';
import type { PermissionsService } from '../services/permissions.service';
import type { SettingsService } from '../services/settings.service';

interface LiveTab {
  state: Tab;
  view: WebContentsView | null;
  loaded: boolean;
}

export interface TabManagerDeps {
  windows: WindowManager;
  sessions: SessionManager;
  workspaces: WorkspaceService;
  profiles: ProfileService;
  history: HistoryService;
  privacy: PrivacyService;
  permissions: PermissionsService;
  settings: SettingsService;
  repos: Repositories;
  events: EventBus;
  logger: Logger;
}

export interface CreateTabInput {
  workspaceId: string;
  url?: string;
  groupId?: string | null;
  index?: number;
  active?: boolean;
  openerTabId?: string | null;
  windowId?: string;
}

const round = (value: number): number => Math.round(value);

/**
 * The heart of the browser. Owns every live tab and its backing
 * {@link WebContentsView}, positions content beneath the chrome, wires the full
 * navigation/media event surface, records history, and implements sleeping,
 * grouping, split view and session persistence.
 */
export class TabManager {
  private readonly tabs = new Map<string, LiveTab>();
  private readonly recentlyClosed: ClosedTab[] = [];

  constructor(private readonly deps: TabManagerDeps) {
    this.deps.permissions.setTabResolver((webContents) => this.tabIdForWebContents(webContents));
    this.deps.windows.onWindowClosed((windowId) => this.handleWindowClosed(windowId));
  }

  /* ------------------------------------------------------------------ *
   * Queries
   * ------------------------------------------------------------------ */

  get(tabId: string): Tab | null {
    return this.tabs.get(tabId)?.state ?? null;
  }

  listByWorkspace(workspaceId: string): Tab[] {
    return [...this.tabs.values()]
      .filter((live) => live.state.workspaceId === workspaceId)
      .map((live) => live.state)
      .sort((a, b) => a.index - b.index);
  }

  listAll(): Tab[] {
    return [...this.tabs.values()].map((live) => live.state);
  }

  listGroups(workspaceId: string): TabGroup[] {
    return this.deps.repos.tabs.listGroups(workspaceId);
  }

  recentlyClosedTabs(): ClosedTab[] {
    return [...this.recentlyClosed];
  }

  /* ------------------------------------------------------------------ *
   * Lifecycle
   * ------------------------------------------------------------------ */

  createTab(input: CreateTabInput): Tab {
    const workspace = this.deps.workspaces.get(input.workspaceId);
    if (!workspace) throw new Error(`Unknown workspace: ${input.workspaceId}`);

    const windowId = input.windowId ?? this.deps.windows.first()?.id ?? null;
    const url = input.url ?? this.deps.settings.get().behavior.newTabPage;
    const now = Date.now();
    const id = createId('tab');

    const tab: Tab = {
      id,
      workspaceId: input.workspaceId,
      windowId,
      groupId: input.groupId ?? null,
      index: input.index ?? this.nextIndex(input.workspaceId),
      url,
      pendingUrl: null,
      title: this.initialTitle(url),
      favicon: null,
      themeColor: null,
      status: 'idle',
      navigation: { canGoBack: false, canGoForward: false, isLoading: false },
      loadingProgress: 0,
      audible: false,
      muted: false,
      pinned: false,
      asleep: false,
      createdAt: now,
      lastActiveAt: now,
      openerTabId: input.openerTabId ?? null,
    };

    const live: LiveTab = { state: tab, view: null, loaded: false };
    this.tabs.set(id, live);
    this.persist(live);
    this.deps.events.emit({ type: 'tab:created', tab: { ...tab } });

    if (input.active !== false && windowId) {
      this.activate(id);
    }
    return { ...tab };
  }

  activate(tabId: string): void {
    const live = this.tabs.get(tabId);
    if (!live) return;
    const windowId = live.state.windowId;
    const dandelionWindow = windowId ? this.deps.windows.get(windowId) : null;
    if (!dandelionWindow) return;

    dandelionWindow.activeTabId = tabId;
    dandelionWindow.activeWorkspaceId = live.state.workspaceId;
    // Choosing a tab outside the split exits split view; choosing one of the
    // split's own panes keeps the arrangement.
    if (!dandelionWindow.splitTabIds.includes(tabId)) dandelionWindow.splitTabIds = [];
    live.state.lastActiveAt = Date.now();
    live.state.asleep = false;

    if (isInternalUrl(live.state.url)) {
      this.destroyView(live);
    } else {
      this.materialize(live);
      if (live.view && !live.loaded) {
        void live.view.webContents.loadURL(live.state.url);
        live.loaded = true;
        live.state.status = 'loading';
        live.state.navigation.isLoading = true;
      }
    }

    this.layout(dandelionWindow.id);
    this.persist(live);
    this.emitUpdate(live);
    this.deps.events.emit({ type: 'tab:activated', tabId, windowId: dandelionWindow.id });
    this.deps.windows.broadcastState(dandelionWindow);
  }

  close(tabId: string): void {
    const live = this.tabs.get(tabId);
    if (!live) return;
    const { workspaceId, windowId } = live.state;

    if (/^https?:/i.test(live.state.url) || isInternalUrl(live.state.url)) {
      this.recentlyClosed.unshift({
        url: live.state.url,
        title: live.state.title,
        favicon: live.state.favicon,
        workspaceId,
        windowId,
        groupId: live.state.groupId,
        pinned: live.state.pinned,
        index: live.state.index,
        closedAt: Date.now(),
      });
      if (this.recentlyClosed.length > LIMITS.maxRecentlyClosed) {
        this.recentlyClosed.length = LIMITS.maxRecentlyClosed;
      }
    }

    this.destroyView(live);
    this.tabs.delete(tabId);
    this.deps.repos.tabs.remove(tabId);
    this.deps.events.emit({ type: 'tab:removed', tabId, workspaceId });

    const dandelionWindow = windowId ? this.deps.windows.get(windowId) : null;
    if (!dandelionWindow) return;

    // A closed pane leaves the split, and a split needs two panes — so a lone
    // survivor returns to the full content area.
    const leftSplit = dandelionWindow.splitTabIds.includes(tabId);
    if (leftSplit) {
      const remaining = dandelionWindow.splitTabIds.filter((id) => id !== tabId);
      dandelionWindow.splitTabIds = remaining.length >= 2 ? remaining : [];
    }

    if (dandelionWindow.activeTabId === tabId) {
      const neighbor = this.pickNeighbor(workspaceId, windowId, live.state.index);
      dandelionWindow.activeTabId = null;
      if (neighbor) {
        this.activate(neighbor); // re-lays out and broadcasts the new state
        return;
      }
    } else if (!leftSplit) {
      return; // a background tab closed: the window's arrangement is unchanged
    }

    this.layout(dandelionWindow.id);
    this.deps.windows.broadcastState(dandelionWindow);
  }

  duplicate(tabId: string): Tab | null {
    const live = this.tabs.get(tabId);
    if (!live) return null;
    return this.createTab({
      workspaceId: live.state.workspaceId,
      url: live.state.url,
      groupId: live.state.groupId,
      index: live.state.index + 1,
      active: true,
      windowId: live.state.windowId ?? undefined,
    });
  }

  /**
   * Restores the most recently closed tab where it was — same slot, same pinned
   * state. It reopens in `windowId` (the window asking for it, as every browser
   * does), falling back to the window it was closed from.
   */
  reopenClosed(windowId?: string): Tab | null {
    const closed = this.recentlyClosed.shift();
    if (!closed) return null;
    const tab = this.createTab({
      workspaceId: closed.workspaceId,
      url: closed.url,
      groupId: closed.groupId,
      index: closed.index,
      active: true,
      windowId: windowId ?? closed.windowId ?? undefined,
    });
    if (closed.pinned) this.setPinned(tab.id, true);
    return tab;
  }

  /* ------------------------------------------------------------------ *
   * Navigation
   * ------------------------------------------------------------------ */

  navigate(tabId: string, url: string, _transition: VisitTransition = 'typed'): void {
    const live = this.tabs.get(tabId);
    if (!live) return;

    live.state.pendingUrl = url;
    if (isInternalUrl(url)) {
      this.destroyView(live);
      live.state.url = url;
      live.state.pendingUrl = null;
      live.state.title = this.initialTitle(url);
      live.state.status = 'complete';
      live.state.navigation = { canGoBack: false, canGoForward: false, isLoading: false };
      live.loaded = false;
    } else {
      this.materialize(live);
      if (live.view) {
        void live.view.webContents.loadURL(url);
        live.loaded = true;
        live.state.status = 'loading';
        live.state.navigation.isLoading = true;
      }
    }
    if (live.state.windowId) this.layout(live.state.windowId);
    this.persist(live);
    this.emitUpdate(live);
  }

  goToOffset(tabId: string, offset: number): void {
    const wc = this.tabs.get(tabId)?.view?.webContents;
    if (wc?.navigationHistory.canGoToOffset(offset)) wc.navigationHistory.goToOffset(offset);
  }

  reload(tabId: string, ignoreCache = false): void {
    const wc = this.tabs.get(tabId)?.view?.webContents;
    if (!wc) return;
    if (ignoreCache) wc.reloadIgnoringCache();
    else wc.reload();
  }

  stop(tabId: string): void {
    this.tabs.get(tabId)?.view?.webContents.stop();
  }

  toggleDevTools(tabId: string): void {
    const wc = this.tabs.get(tabId)?.view?.webContents;
    if (!wc) return;
    if (wc.isDevToolsOpened()) wc.closeDevTools();
    else wc.openDevTools({ mode: 'detach' });
  }

  /* ------------------------------------------------------------------ *
   * Tab state mutations
   * ------------------------------------------------------------------ */

  setMuted(tabId: string, muted: boolean): void {
    const live = this.tabs.get(tabId);
    if (!live) return;
    live.view?.webContents.setAudioMuted(muted);
    live.state.muted = muted;
    this.emitUpdate(live);
  }

  setPinned(tabId: string, pinned: boolean): void {
    const live = this.tabs.get(tabId);
    if (!live) return;
    live.state.pinned = pinned;
    this.persist(live);
    this.emitUpdate(live);
  }

  sleep(tabId: string): void {
    const live = this.tabs.get(tabId);
    if (!live || live.state.asleep) return;
    if (live.state.pinned && !this.deps.settings.get().tabs.sleepPinnedTabs) return;
    const dandelionWindow = live.state.windowId ? this.deps.windows.get(live.state.windowId) : null;
    // A tab on screen is not inactive. That includes the other half of a split,
    // which keeps its pane in the layout and would leave a dead rect behind.
    if (dandelionWindow?.activeTabId === tabId) return;
    if (dandelionWindow?.splitTabIds.includes(tabId)) return;
    this.destroyView(live);
    live.state.asleep = true;
    this.emitUpdate(live);
  }

  setZoom(tabId: string, level: number): void {
    const wc = this.tabs.get(tabId)?.view?.webContents;
    if (wc) wc.setZoomLevel(level);
  }

  adjustZoom(tabId: string, delta: number): void {
    const wc = this.tabs.get(tabId)?.view?.webContents;
    if (wc) wc.setZoomLevel(wc.getZoomLevel() + delta);
  }

  /** Current zoom as a percentage (100 = default). Chromium persists this per host. */
  getZoomPercent(tabId: string): number {
    const wc = this.tabs.get(tabId)?.view?.webContents;
    return wc ? Math.round(wc.getZoomFactor() * 100) : 100;
  }

  /* ------------------------------------------------------------------ *
   * Ordering, groups, split view
   * ------------------------------------------------------------------ */

  reorder(workspaceId: string, orderedTabIds: string[]): void {
    orderedTabIds.forEach((id, index) => {
      const live = this.tabs.get(id);
      if (live && live.state.workspaceId === workspaceId) {
        live.state.index = index;
        this.emitUpdate(live);
      }
    });
    this.deps.repos.tabs.reorder(orderedTabIds);
  }

  move(
    tabId: string,
    toIndex: number,
    groupId: string | null | undefined,
    workspaceId: string | undefined,
  ): void {
    const live = this.tabs.get(tabId);
    if (!live) return;
    live.state.index = toIndex;
    if (groupId !== undefined) live.state.groupId = groupId;
    if (workspaceId !== undefined) live.state.workspaceId = workspaceId;
    this.persist(live);
    this.emitUpdate(live);
  }

  createGroup(workspaceId: string, name: string, color: TabGroupColor, tabIds: string[]): TabGroup {
    const group: TabGroup = {
      id: createId('grp'),
      workspaceId,
      name,
      color,
      collapsed: false,
      index: this.deps.repos.tabs.listGroups(workspaceId).length,
      createdAt: Date.now(),
    };
    this.deps.repos.tabs.insertGroup(group);
    for (const tabId of tabIds) {
      const live = this.tabs.get(tabId);
      if (live) {
        live.state.groupId = group.id;
        this.persist(live);
        this.emitUpdate(live);
      }
    }
    this.deps.events.emit({ type: 'tabGroup:changed', group });
    return group;
  }

  updateGroup(
    groupId: string,
    patch: Partial<Pick<TabGroup, 'name' | 'color' | 'collapsed'>>,
  ): void {
    this.deps.repos.tabs.updateGroup(groupId, patch);
    const group = this.deps.repos.tabs.getGroup(groupId);
    if (group) this.deps.events.emit({ type: 'tabGroup:changed', group });
  }

  removeGroup(groupId: string): void {
    const group = this.deps.repos.tabs.getGroup(groupId);
    for (const live of this.tabs.values()) {
      if (live.state.groupId === groupId) {
        live.state.groupId = null;
        this.persist(live);
        this.emitUpdate(live);
      }
    }
    this.deps.repos.tabs.removeGroup(groupId);
    if (group) {
      this.deps.events.emit({ type: 'tabGroup:removed', groupId, workspaceId: group.workspaceId });
    }
  }

  setSplit(windowId: string, tabIds: string[], orientation: SplitOrientation): void {
    const dandelionWindow = this.deps.windows.get(windowId);
    if (!dandelionWindow) return;
    for (const tabId of tabIds) {
      const live = this.tabs.get(tabId);
      if (live && !isInternalUrl(live.state.url)) {
        this.materialize(live);
        if (live.view && !live.loaded) {
          void live.view.webContents.loadURL(live.state.url);
          live.loaded = true;
        }
      }
    }
    dandelionWindow.splitTabIds = tabIds;
    dandelionWindow.splitOrientation = orientation;
    this.layout(windowId);
    this.deps.windows.broadcastState(dandelionWindow);
  }

  clearSplit(windowId: string): void {
    const dandelionWindow = this.deps.windows.get(windowId);
    if (!dandelionWindow || dandelionWindow.splitTabIds.length === 0) return;
    dandelionWindow.splitTabIds = [];
    this.layout(windowId);
    this.deps.windows.broadcastState(dandelionWindow);
  }

  /**
   * Resize a two-pane split. Called for every frame of a divider drag, so it
   * lays out immediately and skips the broadcast when the clamped ratio has not
   * actually moved — at the limits a drag would otherwise re-broadcast an
   * identical state on every pointer move.
   */
  setSplitRatio(windowId: string, ratio: number): void {
    const dandelionWindow = this.deps.windows.get(windowId);
    if (!dandelionWindow || dandelionWindow.splitTabIds.length < 2) return;
    const next = clampSplitRatio(ratio);
    if (next === dandelionWindow.splitRatio) return;
    dandelionWindow.splitRatio = next;
    this.layout(windowId);
    this.deps.windows.broadcastState(dandelionWindow);
  }

  /* ------------------------------------------------------------------ *
   * Find in page, capture
   * ------------------------------------------------------------------ */

  findInPage(tabId: string, query: string, forward: boolean, matchCase: boolean): void {
    this.tabs.get(tabId)?.view?.webContents.findInPage(query, { forward, matchCase });
  }

  stopFind(tabId: string, action: 'clearSelection' | 'keepSelection' | 'activateSelection'): void {
    this.tabs.get(tabId)?.view?.webContents.stopFindInPage(action);
  }

  /** Extract readable page text for AI actions (summarise/explain/translate). */
  async getPageContext(
    tabId: string,
  ): Promise<{ url: string; title: string; text: string } | null> {
    const live = this.tabs.get(tabId);
    const wc = live?.view?.webContents;
    if (!wc || !live) return null;
    try {
      const text = await wc.executeJavaScript(
        'String(document.body && document.body.innerText || "").slice(0, 12000)',
        true,
      );
      return { url: live.state.url, title: live.state.title, text: String(text) };
    } catch {
      return null;
    }
  }

  /**
   * Distil the page into reader-friendly content blocks. The extraction runs in
   * the page and returns only plain text + image URLs (never HTML), so the
   * chrome renderer can display it safely without any markup injection.
   */
  async getReaderContent(tabId: string): Promise<ReaderArticle | null> {
    const live = this.tabs.get(tabId);
    const wc = live?.view?.webContents;
    if (!wc || !live) return null;
    const script = `(function () {
      function txt(el) { return (el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim(); }
      var selectors = ['article','main','[role="main"]','.post-content','.article-content','.entry-content','.article-body','#content','.content'];
      var pool = [];
      selectors.forEach(function (s) { pool = pool.concat(Array.prototype.slice.call(document.querySelectorAll(s))); });
      if (pool.length === 0) pool = [document.body];
      var container = null, best = 0;
      pool.forEach(function (el) {
        var score = 0;
        el.querySelectorAll('p').forEach(function (p) { var l = txt(p).length; if (l > 40) score += l; });
        if (score > best) { best = score; container = el; }
      });
      if (!container) container = document.body;
      var blocks = [], total = 0;
      var nodes = container.querySelectorAll('h1,h2,h3,p,li,blockquote,pre,img');
      for (var i = 0; i < nodes.length && blocks.length < 500; i++) {
        var el = nodes[i], tag = el.tagName.toLowerCase();
        if (tag === 'img') { var src = el.currentSrc || el.src; if (src && src.indexOf('data:') !== 0) blocks.push({ type: 'img', src: src, alt: el.alt || '' }); continue; }
        var t = txt(el);
        if (t.length < 2) continue;
        blocks.push({ type: tag, text: t });
        total += t.length;
      }
      var h1 = document.querySelector('h1');
      var author = document.querySelector('[rel="author"], .author, .byline, [itemprop="author"]');
      return {
        title: (h1 && txt(h1)) || document.title || '',
        byline: author ? txt(author) : '',
        siteName: location.hostname.replace(/^www\\./, ''),
        blocks: blocks,
        length: total,
        excerpt: blocks.filter(function (b) { return b.type === 'p'; }).map(function (b) { return b.text; }).join(' ').slice(0, 280)
      };
    })()`;
    try {
      const raw = (await wc.executeJavaScript(script, true)) as {
        title?: string;
        byline?: string;
        siteName?: string;
        blocks?: ReaderBlock[];
        length?: number;
        excerpt?: string;
      } | null;
      const blocks = Array.isArray(raw?.blocks) ? raw.blocks.slice(0, 500) : [];
      if (blocks.length === 0) return null;
      return {
        url: live.state.url,
        title: String(raw?.title ?? live.state.title ?? ''),
        byline: String(raw?.byline ?? ''),
        siteName: String(raw?.siteName ?? ''),
        blocks,
        length: Number(raw?.length ?? 0),
        excerpt: String(raw?.excerpt ?? ''),
      };
    } catch {
      return null;
    }
  }

  async captureThumbnail(tabId: string): Promise<TabThumbnail | null> {
    const live = this.tabs.get(tabId);
    if (!live?.view) return null;
    const image = await live.view.webContents.capturePage();
    const resized = image.resize({ width: LIMITS.thumbnailWidth });
    const size = resized.getSize();
    return {
      tabId,
      dataUrl: resized.toDataURL(),
      width: size.width,
      height: size.height,
      capturedAt: Date.now(),
    };
  }

  /* ------------------------------------------------------------------ *
   * Layout coordination (driven by the renderer)
   * ------------------------------------------------------------------ */

  setContentBounds(
    windowId: string,
    bounds: { x: number; y: number; width: number; height: number },
  ): void {
    this.deps.windows.setContentBounds(windowId, bounds);
    this.layout(windowId);
  }

  setContentVisible(windowId: string, visible: boolean): void {
    const dandelionWindow = this.deps.windows.get(windowId);
    if (!dandelionWindow) return;
    dandelionWindow.contentHidden = !visible;
    this.layout(windowId);
  }

  /* ------------------------------------------------------------------ *
   * Session restore
   * ------------------------------------------------------------------ */

  restoreWorkspace(windowId: string, workspaceId: string): void {
    const dandelionWindow = this.deps.windows.get(windowId);
    if (!dandelionWindow) return;
    dandelionWindow.activeWorkspaceId = workspaceId;

    const alreadyOpen = this.listByWorkspace(workspaceId);
    if (alreadyOpen.length > 0) {
      // A renderer reload re-runs this for the workspace already on screen, so
      // prefer the window's current tab — falling back to the first tab is only
      // right when arriving from another workspace.
      const current = alreadyOpen.find((tab) => tab.id === dandelionWindow.activeTabId);
      const active = current ?? alreadyOpen[0]!;
      this.reparent(active.id, windowId);
      this.activate(active.id);
      return;
    }

    const persisted = this.deps.repos.tabs.listByWorkspace(workspaceId);
    if (persisted.length === 0) {
      this.createTab({ workspaceId, active: true, windowId });
      return;
    }

    let firstId: string | null = null;
    for (const record of persisted) {
      const tab = this.tabFromPersisted(record, windowId);
      this.tabs.set(tab.id, { state: tab, view: null, loaded: false });
      this.deps.events.emit({ type: 'tab:created', tab: { ...tab } });
      firstId ??= tab.id;
    }
    if (firstId) this.activate(firstId);
  }

  /* ------------------------------------------------------------------ *
   * Internal helpers
   * ------------------------------------------------------------------ */

  private materialize(live: LiveTab): void {
    if (live.view || !live.state.windowId) return;
    const dandelionWindow = this.deps.windows.get(live.state.windowId);
    if (!dandelionWindow) return;
    const profile = this.profileForWorkspace(live.state.workspaceId);
    if (!profile) return;

    const view = this.createView(profile);
    this.wireWebContents(live, view);
    live.view = view;
    dandelionWindow.browserWindow.contentView.addChildView(view, 0);
    view.setVisible(false);
  }

  private createView(profile: Profile): WebContentsView {
    const session = this.deps.sessions.getSession(profile);
    const view = new WebContentsView({
      webPreferences: {
        session,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
        safeDialogs: true,
        backgroundThrottling: true,
      },
    });
    const radius = this.deps.settings.get().appearance.cornerRadius;
    const withRadius = view as unknown as { setBorderRadius?: (r: number) => void };
    withRadius.setBorderRadius?.(radius);
    return view;
  }

  private destroyView(live: LiveTab): void {
    if (!live.view) return;
    const dandelionWindow = live.state.windowId ? this.deps.windows.get(live.state.windowId) : null;
    try {
      dandelionWindow?.browserWindow.contentView.removeChildView(live.view);
    } catch {
      /* view may already be detached */
    }
    const wc = live.view.webContents as unknown as {
      destroy?: () => void;
      isDestroyed?: () => boolean;
    };
    try {
      if (wc.isDestroyed && !wc.isDestroyed() && wc.destroy) wc.destroy();
    } catch {
      /* best-effort */
    }
    live.view = null;
    live.loaded = false;
  }

  private layout(windowId: string): void {
    const dandelionWindow = this.deps.windows.get(windowId);
    if (!dandelionWindow) return;
    const bounds = dandelionWindow.contentBounds;

    for (const live of this.tabs.values()) {
      if (live.state.windowId === windowId && live.view) live.view.setVisible(false);
    }
    if (dandelionWindow.contentHidden) return;

    const splitIds = dandelionWindow.splitTabIds;
    if (splitIds.length >= 2) {
      const rects = splitPaneBounds(
        bounds,
        splitIds.length,
        dandelionWindow.splitOrientation,
        dandelionWindow.splitRatio,
      );
      splitIds.forEach((tabId, i) => {
        const live = this.tabs.get(tabId);
        const rect = rects[i];
        if (!live?.view || !rect) return;
        live.view.setBounds(rect);
        live.view.setVisible(true);
      });
      return;
    }

    const activeId = dandelionWindow.activeTabId;
    if (!activeId) return;
    const live = this.tabs.get(activeId);
    if (live?.view && !isInternalUrl(live.state.url)) {
      live.view.setBounds({
        x: round(bounds.x),
        y: round(bounds.y),
        width: round(bounds.width),
        height: round(bounds.height),
      });
      live.view.setVisible(true);
    }
  }

  private wireWebContents(live: LiveTab, view: WebContentsView): void {
    const wc = view.webContents;
    const profile = this.profileForWorkspace(live.state.workspaceId);

    wc.setWindowOpenHandler(({ url, disposition }) => {
      this.createTab({
        workspaceId: live.state.workspaceId,
        url,
        active: disposition !== 'background-tab',
        openerTabId: live.state.id,
        windowId: live.state.windowId ?? undefined,
      });
      return { action: 'deny' };
    });

    wc.on('did-start-loading', () => {
      live.state.status = 'loading';
      live.state.navigation.isLoading = true;
      live.state.loadingProgress = 0.1;
      this.emitUpdate(live);
    });

    wc.on('did-stop-loading', () => {
      live.state.status = 'complete';
      live.state.navigation.isLoading = false;
      live.state.loadingProgress = 1;
      this.refreshNavState(live);
      this.emitUpdate(live);
    });

    wc.on('did-start-navigation', (details) => {
      if (!details.isMainFrame) return;
      live.state.pendingUrl = details.url;
      live.state.loadingProgress = 0.3;
      this.deps.privacy.resetCounters(wc.id);
      this.emitUpdate(live);
    });

    wc.on('did-navigate', (_event, url) => {
      live.state.url = url;
      live.state.pendingUrl = null;
      live.state.title = live.state.title || prettifyUrl(url);
      this.refreshNavState(live);
      // The tab deliberately keeps the old title until the new one arrives, so
      // it is not this page's title — `page-title-updated` fills it in.
      this.recordVisit(live, profile, url, 'typed', '');
      this.persist(live);
      this.emitUpdate(live);
      this.emitShieldReport(live, wc);
    });

    wc.on('did-navigate-in-page', (_event, url, isMainFrame) => {
      if (!isMainFrame) return;
      live.state.url = url;
      this.refreshNavState(live);
      // Same document, so the tab's title already belongs to this URL.
      this.recordVisit(live, profile, url, 'link', live.state.title);
      this.emitUpdate(live);
    });

    wc.on('page-title-updated', (_event, title) => {
      live.state.title = title;
      if (profile) this.deps.history.setTitle(profile.id, live.state.url, title);
      this.persist(live);
      this.emitUpdate(live);
    });

    wc.on('page-favicon-updated', (_event, favicons) => {
      const favicon = favicons[0] ?? null;
      live.state.favicon = favicon;
      if (favicon && profile) this.deps.history.setFavicon(profile.id, live.state.url, favicon);
      this.persist(live);
      this.emitUpdate(live);
    });

    wc.on('did-fail-load', (_event, errorCode, _desc, _validatedUrl, isMainFrame) => {
      if (!isMainFrame || errorCode === -3) return; // -3 = aborted (user navigation)
      live.state.status = 'complete';
      live.state.navigation.isLoading = false;
      this.emitUpdate(live);
    });

    wc.on('render-process-gone', () => {
      live.state.status = 'crashed';
      this.emitUpdate(live);
    });

    wc.on('media-started-playing', () => {
      live.state.audible = true;
      this.emitUpdate(live);
    });
    wc.on('media-paused', () => {
      live.state.audible = false;
      this.emitUpdate(live);
    });

    wc.on('found-in-page', (_event, result) => {
      this.deps.events.emit({
        type: 'find:result',
        result: {
          tabId: live.state.id,
          activeMatchOrdinal: result.activeMatchOrdinal,
          matches: result.matches,
        },
      });
    });
  }

  private refreshNavState(live: LiveTab): void {
    const wc = live.view?.webContents;
    if (!wc) return;
    live.state.navigation.canGoBack = wc.navigationHistory.canGoBack();
    live.state.navigation.canGoForward = wc.navigationHistory.canGoForward();
  }

  /**
   * Record a visit. `title` is passed explicitly rather than read from the tab,
   * because on a cross-document navigation the tab still shows the previous
   * page's title — recording that would label the entry with the wrong page.
   * An empty title leaves any known title intact.
   */
  private recordVisit(
    live: LiveTab,
    profile: Profile | null,
    url: string,
    transition: VisitTransition,
    title: string,
  ): void {
    if (!profile || profile.isPrivate) return;
    this.deps.history.record({
      profileId: profile.id,
      url,
      title,
      transition,
      workspaceId: live.state.workspaceId,
    });
  }

  private emitShieldReport(live: LiveTab, wc: WebContents): void {
    const origin = getHostname(live.state.url);
    if (!origin) return;
    this.deps.events.emit({
      type: 'shield:report',
      tabId: live.state.id,
      report: this.deps.privacy.report(wc.id, origin),
    });
  }

  private emitUpdate(live: LiveTab): void {
    this.deps.events.emit({ type: 'tab:updated', tab: { ...live.state } });
  }

  private persist(live: LiveTab): void {
    const profile = this.profileForWorkspace(live.state.workspaceId);
    if (profile?.isPrivate) return;
    const record: PersistedTab = {
      id: live.state.id,
      workspaceId: live.state.workspaceId,
      groupId: live.state.groupId,
      index: live.state.index,
      url: live.state.url,
      title: live.state.title,
      favicon: live.state.favicon,
      pinned: live.state.pinned,
      createdAt: live.state.createdAt,
      lastActiveAt: live.state.lastActiveAt,
    };
    this.deps.repos.tabs.upsert(record);
  }

  private tabFromPersisted(record: PersistedTab, windowId: string): Tab {
    return {
      id: record.id,
      workspaceId: record.workspaceId,
      windowId,
      groupId: record.groupId,
      index: record.index,
      url: record.url,
      pendingUrl: null,
      title: record.title || this.initialTitle(record.url),
      favicon: record.favicon,
      themeColor: null,
      status: 'idle',
      navigation: { canGoBack: false, canGoForward: false, isLoading: false },
      loadingProgress: 0,
      audible: false,
      muted: false,
      pinned: record.pinned,
      asleep: true,
      createdAt: record.createdAt,
      lastActiveAt: record.lastActiveAt,
      openerTabId: null,
    };
  }

  private reparent(tabId: string, windowId: string): void {
    const live = this.tabs.get(tabId);
    if (!live || live.state.windowId === windowId) return;
    const view = live.view;
    if (view) {
      const oldWindow = live.state.windowId ? this.deps.windows.get(live.state.windowId) : null;
      const newWindow = this.deps.windows.get(windowId);
      try {
        oldWindow?.browserWindow.contentView.removeChildView(view);
        newWindow?.browserWindow.contentView.addChildView(view, 0);
      } catch {
        /* best-effort reparent */
      }
    }
    live.state.windowId = windowId;
  }

  private handleWindowClosed(windowId: string): void {
    for (const [id, live] of this.tabs) {
      if (live.state.windowId === windowId) {
        this.destroyView(live);
        this.tabs.delete(id);
      }
    }
  }

  private pickNeighbor(workspaceId: string, windowId: string | null, index: number): string | null {
    const siblings = [...this.tabs.values()]
      .filter((live) => live.state.workspaceId === workspaceId && live.state.windowId === windowId)
      .map((live) => live.state)
      .sort((a, b) => a.index - b.index);
    if (siblings.length === 0) return null;
    const after = siblings.find((tab) => tab.index > index);
    return (after ?? siblings[siblings.length - 1])?.id ?? null;
  }

  private nextIndex(workspaceId: string): number {
    const tabs = this.listByWorkspace(workspaceId);
    return tabs.length === 0 ? 0 : Math.max(...tabs.map((tab) => tab.index)) + 1;
  }

  private initialTitle(url: string): string {
    if (url === INTERNAL_PAGES.newTab) return 'New Tab';
    if (isInternalUrl(url)) return 'Dandelion';
    return prettifyUrl(url) || 'New Tab';
  }

  private profileForWorkspace(workspaceId: string): Profile | null {
    const workspace = this.deps.workspaces.get(workspaceId);
    if (!workspace) return null;
    return this.deps.profiles.get(workspace.profileId);
  }

  private tabIdForWebContents(webContents: WebContents): string | null {
    for (const live of this.tabs.values()) {
      if (live.view?.webContents === webContents) return live.state.id;
    }
    return null;
  }
}
