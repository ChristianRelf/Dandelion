import { useEffect, useState, type ReactElement } from 'react';
import { Minus, Plus, RotateCcw, Search } from 'lucide-react';
import { IconButton } from '../ui/IconButton';
import { Tooltip } from '../ui/Tooltip';
import { trpc } from '../../lib/trpc/client';
import { dispatchCommand } from '../../lib/commands';
import { useBrowserStore } from '../../stores/browser.store';
import { usePopupTrigger } from '../../popup/usePopupTrigger';

/**
 * The zoom popover's contents, rendered in the floating popup surface.
 *
 * It has to float rather than hide the page: the whole point of a zoom control
 * is watching the page resize under it, which is exactly what dimming the web
 * view — the treatment the omnibox gets — would take away.
 */
export function ZoomControlBody(): ReactElement {
  const tabId = useBrowserStore((state) => state.activeTabId);
  const [percent, setPercent] = useState(100);

  const refresh = (): void => {
    if (tabId)
      void trpc.tabs.getZoom
        .query({ tabId })
        .then(setPercent)
        .catch(() => undefined);
  };

  useEffect(refresh, [tabId]);

  const step = (command: string): void => {
    dispatchCommand(command);
    // Chromium applies the level asynchronously, so read it back rather than
    // predicting it — the steps are not a fixed ladder.
    setTimeout(refresh, 90);
  };

  return (
    <div className="flex items-center gap-1 p-1">
      <IconButton size="sm" onClick={() => step('view.zoomOut')} aria-label="Zoom out">
        <Minus className="h-4 w-4" />
      </IconButton>
      <button
        type="button"
        onClick={() => step('view.zoomReset')}
        aria-label="Reset zoom"
        className="min-w-16 rounded-md px-1 py-1 text-center text-[13px] text-text tabular-nums transition-colors hover:bg-surface-hover"
      >
        {percent}%
      </button>
      <IconButton size="sm" onClick={() => step('view.zoomIn')} aria-label="Zoom in">
        <Plus className="h-4 w-4" />
      </IconButton>
      <IconButton size="sm" onClick={() => step('view.zoomReset')} aria-label="Reset zoom">
        <RotateCcw className="h-4 w-4" />
      </IconButton>
    </div>
  );
}

/** Per-site zoom control. Chromium persists the level per host within the session. */
export function ZoomControl(): ReactElement {
  const { ref, open, toggle } = usePopupTrigger<HTMLButtonElement>('zoom');

  return (
    <Tooltip content="Zoom">
      <IconButton ref={ref} aria-label="Zoom" aria-expanded={open} active={open} onClick={toggle}>
        <Search className="h-[18px] w-[18px]" />
      </IconButton>
    </Tooltip>
  );
}
