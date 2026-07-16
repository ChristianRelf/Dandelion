import { beforeEach, describe, expect, it } from 'vitest';
import type { WindowState } from '@shared/types';
import {
  selectSplitActive,
  selectSplitTabIds,
  useBrowserStore,
} from '@renderer/stores/browser.store';

const WINDOW_ID = 'window-1';

function windowState(patch: Partial<WindowState> = {}): WindowState {
  return {
    id: WINDOW_ID,
    bounds: { x: 0, y: 0, width: 1280, height: 800 },
    chromeState: 'normal',
    focused: true,
    activeWorkspaceId: 'workspace-1',
    activeTabId: 'tab-a',
    tabLayout: 'vertical',
    sidebarCollapsed: false,
    splitTabIds: [],
    splitOrientation: 'vertical',
    ...patch,
  };
}

describe('browser store: split view state', () => {
  beforeEach(() => {
    useBrowserStore.setState({ windowId: WINDOW_ID, windowState: null });
  });

  it('reports no split before window state is hydrated', () => {
    const state = useBrowserStore.getState();
    expect(selectSplitTabIds(state)).toEqual([]);
    expect(selectSplitActive(state)).toBe(false);
  });

  it('returns a referentially stable empty array so subscribers do not re-render', () => {
    const first = selectSplitTabIds(useBrowserStore.getState());
    const second = selectSplitTabIds(useBrowserStore.getState());
    expect(first).toBe(second);
  });

  it('adopts the split carried on a window:state event', () => {
    useBrowserStore.getState().applyEvent({
      type: 'window:state',
      window: windowState({ splitTabIds: ['tab-a', 'tab-b'], splitOrientation: 'horizontal' }),
    });

    const state = useBrowserStore.getState();
    expect(selectSplitTabIds(state)).toEqual(['tab-a', 'tab-b']);
    expect(selectSplitActive(state)).toBe(true);
    expect(state.windowState?.splitOrientation).toBe('horizontal');
  });

  it('clears the split when main broadcasts an empty one', () => {
    const store = useBrowserStore.getState();
    store.applyEvent({
      type: 'window:state',
      window: windowState({ splitTabIds: ['tab-a', 'tab-b'] }),
    });
    store.applyEvent({ type: 'window:state', window: windowState({ splitTabIds: [] }) });

    expect(selectSplitActive(useBrowserStore.getState())).toBe(false);
  });

  it('ignores window state belonging to another window', () => {
    useBrowserStore.getState().applyEvent({
      type: 'window:state',
      window: windowState({ id: 'window-2', splitTabIds: ['tab-a', 'tab-b'] }),
    });

    expect(selectSplitActive(useBrowserStore.getState())).toBe(false);
  });

  it('does not treat a single pane as a split', () => {
    useBrowserStore.getState().applyEvent({
      type: 'window:state',
      window: windowState({ splitTabIds: ['tab-a'] }),
    });

    expect(selectSplitActive(useBrowserStore.getState())).toBe(false);
  });
});
