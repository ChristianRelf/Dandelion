import type { Download, DownloadState } from '@shared/types';
import { formatBytes, formatDuration, formatRelativeTime, formatSpeed } from '@shared/utils';

/** Friendly, human-readable label for each download state — never the raw enum. */
export const STATE_LABEL: Record<DownloadState, string> = {
  in_progress: 'Downloading',
  paused: 'Paused',
  completed: 'Completed',
  cancelled: 'Cancelled',
  interrupted: 'Failed',
};

/** Whether a download is still moving, and so can be paused, resumed or cancelled. */
export function isActive(download: Download): boolean {
  return download.state === 'in_progress' || download.state === 'paused';
}

/** Completion in [0, 1], or 0 when the total size is unknown. */
export function progressOf(download: Download): number {
  return download.totalBytes > 0 ? Math.min(1, download.receivedBytes / download.totalBytes) : 0;
}

/** Map a download to a Lucide file-type icon (kebab name) from its mime/extension. */
export function fileIconName(download: Download): string {
  const mime = download.mimeType.toLowerCase();
  const ext = download.filename.includes('.')
    ? (download.filename.split('.').pop() ?? '').toLowerCase()
    : '';

  const has = (...exts: string[]): boolean => exts.includes(ext);

  if (
    mime.startsWith('image/') ||
    has('png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif', 'heic')
  ) {
    return 'image';
  }
  if (mime.startsWith('video/') || has('mp4', 'mkv', 'mov', 'avi', 'webm', 'm4v')) return 'film';
  if (mime.startsWith('audio/') || has('mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a')) return 'music';
  if (mime === 'application/pdf' || ext === 'pdf') return 'file-text';
  if (
    has('zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz') ||
    mime.includes('zip') ||
    mime.includes('compressed') ||
    mime.includes('tar')
  ) {
    return 'file-archive';
  }
  if (has('csv', 'xls', 'xlsx') || mime.includes('spreadsheet') || mime.includes('csv')) {
    return 'file-spreadsheet';
  }
  if (
    has(
      'js',
      'ts',
      'jsx',
      'tsx',
      'json',
      'html',
      'css',
      'py',
      'rs',
      'go',
      'java',
      'c',
      'cpp',
      'sh',
      'yml',
      'yaml',
      'xml',
    ) ||
    mime.includes('json') ||
    mime.includes('javascript')
  ) {
    return 'file-code';
  }
  if (has('exe', 'dmg', 'pkg', 'deb', 'rpm', 'msi', 'appimage')) return 'package';
  if (mime.startsWith('text/') || has('txt', 'md', 'rtf', 'doc', 'docx')) return 'file-text';
  return 'file';
}

export function sizeSummary(download: Download): string {
  if (download.totalBytes > 0) {
    return `${formatBytes(download.receivedBytes)} of ${formatBytes(download.totalBytes)}`;
  }
  return formatBytes(download.receivedBytes);
}

/** The state-aware second line: always leads with the friendly state label. */
export function describe(download: Download): string {
  const label = STATE_LABEL[download.state];
  switch (download.state) {
    case 'in_progress': {
      const parts = [label, sizeSummary(download)];
      if (download.speed > 0) parts.push(formatSpeed(download.speed));
      if (download.etaSeconds != null && download.etaSeconds > 0) {
        parts.push(`${formatDuration(download.etaSeconds)} left`);
      }
      return parts.join(' · ');
    }
    case 'paused':
      return `${label} · ${sizeSummary(download)}`;
    case 'completed': {
      const size = formatBytes(download.totalBytes || download.receivedBytes);
      const when = download.completedAt ? formatRelativeTime(download.completedAt) : null;
      return when ? `${label} · ${size} · ${when}` : `${label} · ${size}`;
    }
    default:
      return label;
  }
}
