import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { UpdateStatus } from '@shared/types';
import { UpdateChip } from '@renderer/components/chrome/UpdateChip';
import { TooltipProvider } from '@renderer/components/ui/Tooltip';
import { useUpdateStore } from '@renderer/stores/update.store';

vi.mock('@renderer/lib/trpc/client', () => ({
  trpc: { app: { installUpdate: { mutate: vi.fn(() => Promise.resolve(true)) } } },
}));

function show(status: UpdateStatus) {
  useUpdateStore.setState({ status, dismissedVersion: null });
  return render(
    <TooltipProvider>
      <UpdateChip />
    </TooltipProvider>,
  );
}

beforeEach(() => {
  useUpdateStore.setState({ status: { phase: 'idle' }, dismissedVersion: null });
});

describe('UpdateChip', () => {
  it('takes up no space in the toolbar with nothing to say', () => {
    const { container } = show({ phase: 'idle' });
    expect(container).toBeEmptyDOMElement();
  });

  it('draws the ring to match how much has downloaded', () => {
    const { container } = show({
      phase: 'downloading',
      version: '1.2.0',
      percent: 25,
      bytesPerSecond: 1_000,
      transferred: 250,
      total: 1_000,
    });

    const ring = container.querySelector('[stroke-dashoffset]');
    const circumference = 2 * Math.PI * 8;
    // A quarter downloaded leaves three quarters of the ring still to draw.
    expect(Number(ring?.getAttribute('stroke-dashoffset'))).toBeCloseTo(circumference * 0.75, 5);
  });

  it('announces download progress to a screen reader', () => {
    show({
      phase: 'downloading',
      version: '1.2.0',
      percent: 62,
      bytesPerSecond: 1_000,
      transferred: 620,
      total: 1_000,
    });

    expect(screen.getByLabelText('Downloading version 1.2.0 — 62%')).toBeInTheDocument();
  });

  it('offers the update once it is waiting', () => {
    const { container } = show({
      phase: 'ready',
      version: '1.2.0',
      releasedAt: null,
      releaseUrl: 'https://example.test/v1.2.0',
    });

    expect(screen.getByLabelText('Update to version 1.2.0')).toBeInTheDocument();
    // The ring gives way to the arrow rather than sitting alongside it.
    expect(container.querySelector('[stroke-dashoffset]')).toBeNull();
  });
});
