import type { InputEvent } from 'electron';
import { getCommand } from '@shared/constants';
import { recognizeGesture, type GesturePoint } from '@shared/utils';
import type { EventBus } from '../core/event-bus';
import type { Logger } from '../core/logger';
import type { SettingsService } from '../services/settings.service';
import type { TabManager } from './tab-manager';
import type { WindowManager } from './window-manager';

/**
 * The mouse fields Electron delivers on `input-event` at runtime.
 *
 * `electron.d.ts` types the payload as the bare `InputEvent` — `type` and
 * `modifiers` only — but a mouse event arrives carrying `x`, `y` and `button`
 * as well (`MouseInputEvent`'s shape, minus the typing). Rather than assert the
 * wider type and hope, the fields are read defensively and a payload without
 * usable coordinates simply ends the stroke.
 */
type MaybeMouseEvent = InputEvent & {
  x?: unknown;
  y?: unknown;
  button?: unknown;
};

interface Stroke {
  points: GesturePoint[];
}

export interface GestureServiceDeps {
  tabs: TabManager;
  windows: WindowManager;
  settings: SettingsService;
  events: EventBus;
  /** Runs a command id against a window — `executeCommand`, injected. */
  run: (commandId: string, windowId: string | null) => void;
  logger: Logger;
}

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/**
 * Right-drag mouse gestures over page content.
 *
 * This lives in main and watches `input-event` on each tab's `webContents`,
 * which mirrors how keyboard shortcuts already work: nothing listens for a
 * keypress in a renderer either — the application menu's accelerators are
 * routed by Electron and land in `executeCommand`. Gestures take the same
 * route, and so inherit the whole command registry for free.
 *
 * The alternative was a preload injected into every page, which is the only way
 * to *swallow* the events as well as read them. It is not needed: Electron ships
 * no default page context menu and this app has never added a `context-menu`
 * handler, so a right-drag has nothing to fight. That is a standing contract —
 * see `handleUp`.
 */
export class GestureService {
  /** Tab id → the stroke in progress. Absent unless the right button is down. */
  private readonly strokes = new Map<string, Stroke>();

  constructor(private readonly deps: GestureServiceDeps) {
    // A tab closed mid-drag never sees its own mouseUp, so its stroke would sit
    // in the map for the life of the process under an id nothing can reach.
    this.deps.events.subscribe((event) => {
      if (event.type === 'tab:removed') this.forget(event.tabId);
    });
  }

  /** Fed every page input event by {@link TabManager}. */
  handle(tabId: string, event: InputEvent): void {
    const mouse = event as MaybeMouseEvent;
    switch (mouse.type) {
      case 'mouseDown':
        if (mouse.button !== 'right') return;
        this.begin(tabId, mouse);
        return;
      case 'mouseMove':
        this.extend(tabId, mouse);
        return;
      case 'mouseUp':
        if (mouse.button !== 'right') return;
        this.finish(tabId, mouse);
        return;
      // The pointer leaving mid-drag means the release will never be seen here.
      // Drop the stroke rather than let it join up with the next one.
      case 'mouseLeave':
        this.strokes.delete(tabId);
        return;
      default:
        return;
    }
  }

  /** Forget a tab's stroke — its contents are going away. */
  forget(tabId: string): void {
    this.strokes.delete(tabId);
  }

  private begin(tabId: string, event: MaybeMouseEvent): void {
    // Read the setting per stroke rather than caching it, so turning gestures
    // off takes effect on the next drag instead of the next restart.
    if (!this.deps.settings.get().gestures.enabled) return;
    const point = pointOf(event);
    if (!point) return;
    this.strokes.set(tabId, { points: [point] });
  }

  private extend(tabId: string, event: MaybeMouseEvent): void {
    const stroke = this.strokes.get(tabId);
    if (!stroke) return;
    const point = pointOf(event);
    if (!point) {
      this.strokes.delete(tabId);
      return;
    }
    stroke.points.push(point);
  }

  private finish(tabId: string, event: MaybeMouseEvent): void {
    const stroke = this.strokes.get(tabId);
    this.strokes.delete(tabId);
    if (!stroke) return;

    const point = pointOf(event);
    if (point) stroke.points.push(point);

    const gesture = recognizeGesture(stroke.points);
    // A plain right-click reduces to the empty stroke. Nothing to do, and
    // nothing to suppress: no page context menu exists to have been opened.
    if (!gesture) return;

    const binding = this.deps.settings
      .get()
      .gestures.bindings.find((entry) => entry.enabled && entry.gesture === gesture);
    if (!binding || !getCommand(binding.action)) return;

    const tab = this.deps.tabs.get(tabId);
    if (!tab?.windowId) return;

    // `executeCommand` reads the window's *active* tab. In a split, the gesture
    // may have landed on the other pane — so make the tab that was gestured on
    // the active one first, which is what the user meant by pointing at it.
    // `activate` keeps the split when the tab is one of its panes.
    if (this.deps.windows.get(tab.windowId)?.activeTabId !== tabId) {
      this.deps.tabs.activate(tabId);
    }

    this.deps.logger.debug(`gesture ${gesture} → ${binding.action}`);
    this.deps.run(binding.action, tab.windowId);
  }
}

function pointOf(event: MaybeMouseEvent): GesturePoint | null {
  return isNumber(event.x) && isNumber(event.y) ? { x: event.x, y: event.y } : null;
}
