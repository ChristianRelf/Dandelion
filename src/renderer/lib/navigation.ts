import { trpc } from './trpc/client';
import { useBrowserStore } from '../stores/browser.store';
import { toast } from '../stores/toast.store';

/**
 * Send a URL to the active tab, falling back to a new tab when the window has
 * none. Chrome surfaces that open a link — panels, pages, the omnibox — all
 * want this behaviour, so it lives here rather than in each of them.
 */
export async function openUrl(url: string): Promise<void> {
  const { activeTabId, activeWorkspaceId } = useBrowserStore.getState();
  if (activeTabId) {
    await trpc.tabs.navigate.mutate({ tabId: activeTabId, url });
  } else if (activeWorkspaceId) {
    await trpc.tabs.create.mutate({ workspaceId: activeWorkspaceId, url, active: true });
  }
}

/**
 * {@link openUrl} for click handlers: reports failure to the user rather than
 * rejecting, so a dead link can never surface as an unhandled rejection.
 */
export function openUrlOrToast(url: string, failureMessage: string): void {
  void openUrl(url).catch(() => toast.error(failureMessage));
}

/**
 * Open a URL in a background tab beside the current one.
 *
 * `active: false` because this is the "keep what I am doing, queue that for
 * later" action; `openerTabId` so it lands next to the tab it came from rather
 * than at the end of the strip.
 */
export async function openUrlInNewTab(url: string): Promise<void> {
  const { activeTabId, activeWorkspaceId } = useBrowserStore.getState();
  if (!activeWorkspaceId) return;
  await trpc.tabs.create.mutate({
    workspaceId: activeWorkspaceId,
    url,
    active: false,
    openerTabId: activeTabId,
  });
}
