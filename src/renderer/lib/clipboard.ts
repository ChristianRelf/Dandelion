import { toast } from '../stores/toast.store';

/**
 * Copy text and say so.
 *
 * `navigator.clipboard.writeText` rejects when the document is not focused,
 * which is not hypothetical in a browser whose chrome sits beside a focused
 * page — so the failure is reported rather than dropped. Renderer-side is the
 * established write path: main owns clipboard *reads* (the omnibox's URL
 * detection) and exposes no write.
 */
export async function copyText(text: string, description?: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard', description ? { description } : undefined);
  } catch {
    toast.error('Could not copy to clipboard');
  }
}
