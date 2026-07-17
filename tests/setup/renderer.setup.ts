import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// React Testing Library: unmount and clear the DOM after every test.
afterEach(() => {
  cleanup();
});

// jsdom does not implement matchMedia; several components (theme, motion) read it.
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

// jsdom lacks ResizeObserver / IntersectionObserver used by Radix + virtualization.
class MockObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn(() => []);
}

globalThis.ResizeObserver ??= MockObserver as unknown as typeof ResizeObserver;
globalThis.IntersectionObserver ??= MockObserver as unknown as typeof IntersectionObserver;

// jsdom does not implement scrollIntoView.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}

// The preload bridge. Any chrome component may reach for it — toolbar popovers
// read `windowId` to address their popup surface, and everything talks tRPC —
// so it is stubbed once here rather than in each test that happens to render one.
// `subscribe` returns its unsubscribe, because effects call it on unmount.
if (!('dandelion' in window)) {
  Object.defineProperty(window, 'dandelion', {
    writable: true,
    value: {
      windowId: 'window_test',
      trpc: { invoke: vi.fn(async () => ({ ok: true, data: { json: null } })) },
      events: { subscribe: vi.fn(() => vi.fn()) },
      platform: {
        os: 'win32',
        arch: 'x64',
        isMac: false,
        isWindows: true,
        isLinux: false,
        appVersion: '0.0.0-test',
      },
    },
  });
}
