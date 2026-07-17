import { beforeEach, describe, expect, it } from 'vitest';
import type { UpdateStatus } from '@shared/types';
import { selectChipStatus, useUpdateStore } from '@renderer/stores/update.store';

function downloading(percent: number, version = '1.2.0'): UpdateStatus {
  return {
    phase: 'downloading',
    version,
    percent,
    bytesPerSecond: 1_000,
    transferred: 1,
    total: 2,
  };
}

function ready(version = '1.2.0'): UpdateStatus {
  return {
    phase: 'ready',
    version,
    releasedAt: null,
    releaseUrl: `https://example.test/${version}`,
  };
}

/** The chip reads through the selector, so exercise it the way the chip does. */
function chip(): UpdateStatus | null {
  return selectChipStatus(useUpdateStore.getState());
}

beforeEach(() => {
  useUpdateStore.setState({ status: { phase: 'idle' }, dismissedVersion: null });
});

describe('update store: what the toolbar chip shows', () => {
  it('stays out of the toolbar until something is happening', () => {
    expect(chip()).toBeNull();

    useUpdateStore.getState().setStatus({ phase: 'checking' });
    expect(chip()).toBeNull();

    useUpdateStore.getState().setStatus({ phase: 'current', version: '1.0.0', checkedAt: 0 });
    expect(chip()).toBeNull();
  });

  it('keeps a failed background check out of the toolbar', () => {
    useUpdateStore.getState().setStatus({ phase: 'error', message: 'Could not reach it.' });
    expect(chip()).toBeNull();
  });

  it('shows a download in flight, and then the update waiting', () => {
    useUpdateStore.getState().setStatus(downloading(40));
    expect(chip()).toMatchObject({ phase: 'downloading', percent: 40 });

    useUpdateStore.getState().setStatus(ready());
    expect(chip()).toMatchObject({ phase: 'ready', version: '1.2.0' });
  });

  it('returns the status by reference, so an unchanged status cannot re-render', () => {
    const status = downloading(40);
    useUpdateStore.getState().setStatus(status);
    expect(chip()).toBe(status);
  });

  it('stops asking once the ready update is dismissed', () => {
    useUpdateStore.getState().setStatus(ready());
    useUpdateStore.getState().dismiss();
    expect(chip()).toBeNull();
  });

  it('asks again when a newer version becomes ready', () => {
    useUpdateStore.getState().setStatus(ready('1.2.0'));
    useUpdateStore.getState().dismiss();

    useUpdateStore.getState().setStatus(ready('1.3.0'));
    expect(chip()).toMatchObject({ phase: 'ready', version: '1.3.0' });
  });

  it('does not treat dismissing a download as dismissing the update', () => {
    useUpdateStore.getState().setStatus(downloading(40));
    useUpdateStore.getState().dismiss();

    expect(chip()).toMatchObject({ phase: 'downloading' });
    useUpdateStore.getState().setStatus(ready());
    expect(chip()).toMatchObject({ phase: 'ready' });
  });
});
