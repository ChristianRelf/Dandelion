import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ dialog: {} }));

const { ExtensionsService } = await import('@main/services/extensions.service');
import type { ProfileService } from '@main/services/profile.service';
import type { SessionManager } from '@main/browser/session-manager';
import type { Logger } from '@main/core/logger';

interface FakeExtension {
  id: string;
  name: string;
  version: string;
  manifest: Record<string, unknown>;
}

/** A session whose extension registry behaves like Electron's. */
function makeService(loaded: FakeExtension[] = []) {
  const registry = new Map(loaded.map((extension) => [extension.id, extension]));
  const session = {
    extensions: {
      getAllExtensions: () => [...registry.values()],
      removeExtension: (id: string) => registry.delete(id),
      loadExtension: (path: string) =>
        Promise.resolve({ id: 'ext_1', name: 'Test', version: '1.0.0', path }),
    },
    getPreloads: () => [],
  };

  const service = new ExtensionsService(
    { getSession: () => session } as unknown as SessionManager,
    {
      getDefault: () => ({ id: 'profile_1', partition: 'persist:x' }),
    } as unknown as ProfileService,
    { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} } as unknown as Logger,
  );

  return { service, registry };
}

describe('ExtensionsService.remove', () => {
  it('removes a loaded extension', () => {
    const { service } = makeService([
      { id: 'ext_1', name: 'Test', version: '1.0.0', manifest: {} },
    ]);
    expect(service.list()).toHaveLength(1);

    service.remove('ext_1');
    expect(service.list()).toEqual([]);
  });

  // The defect: `setEnabled(id, false)` unloads the extension and parks it in
  // the in-memory `disabled` map, so `removeExtension` then no-ops — nothing was
  // loaded to remove. Nothing deleted the parked entry, and `list()` unions the
  // session with `disabled`, so a disabled extension reappeared forever with no
  // way to get rid of it from the UI.
  it('removes one that was disabled first', () => {
    const { service } = makeService([
      { id: 'ext_1', name: 'Test', version: '1.0.0', manifest: {} },
    ]);
    service.setEnabled('ext_1', false);
    expect(service.list()).toHaveLength(1);
    expect(service.list()[0]?.enabled).toBe(false);

    service.remove('ext_1');
    expect(service.list()).toEqual([]);
  });
});
