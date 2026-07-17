import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import type { BrowserEvent, PermissionRequest } from '@shared/types';
import { PermissionPrompt } from '@renderer/components/chrome/PermissionPrompt';
import { useBrowserStore } from '@renderer/stores/browser.store';

vi.mock('@renderer/lib/trpc/client', () => ({
  trpc: { permissions: { respond: { mutate: vi.fn(() => Promise.resolve(true)) } } },
}));

/** Main's push channel, reduced to the one hook `onBrowserEventOf` subscribes to. */
let publish: ((event: BrowserEvent) => void) | null = null;

beforeEach(() => {
  publish = null;
  (window as unknown as { dandelion: unknown }).dandelion = {
    windowId: 'window_1',
    events: {
      subscribe: (handler: (event: BrowserEvent) => void) => {
        publish = handler;
        return () => {
          publish = null;
        };
      },
    },
  };
  useBrowserStore.setState({ windowId: 'window_1' });
});

afterEach(() => useBrowserStore.setState({ windowId: '' }));

function cameraRequest(windowId: string): PermissionRequest {
  return {
    id: `permreq_${windowId}`,
    tabId: 'tab_1',
    windowId,
    origin: 'https://meet.example.com',
    type: 'camera',
  };
}

function ask(windowId: string): void {
  act(() => publish?.({ type: 'permission:request', request: cameraRequest(windowId) }));
}

describe('PermissionPrompt — which window answers', () => {
  it('asks in the window holding the tab that requested', () => {
    render(<PermissionPrompt />);
    ask('window_1');

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText('https://meet.example.com')).toBeInTheDocument();
  });

  // The defect: events fan out to every window, and the request carried no
  // windowId at all — so this component structurally could not filter and every
  // open window rendered the same prompt, each auto-focusing "Allow", for a tab
  // it does not contain and a site its user is not looking at.
  it('stays silent for a request belonging to another window', () => {
    render(<PermissionPrompt />);
    ask('window_2');

    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('keeps answering its own requests after ignoring another window’s', () => {
    render(<PermissionPrompt />);
    ask('window_2');
    ask('window_1');

    expect(screen.getAllByRole('alertdialog')).toHaveLength(1);
  });
});
