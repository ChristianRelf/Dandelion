import type { Download, DownloadSafety, DownloadState } from '@shared/types';
import type { SqliteDatabase } from '../database';
import { updateColumns } from './helpers';

interface DownloadRow {
  id: string;
  profile_id: string;
  url: string;
  filename: string;
  save_path: string;
  mime_type: string;
  state: string;
  received_bytes: number;
  total_bytes: number;
  referrer: string | null;
  safety: string;
  started_at: number;
  completed_at: number | null;
}

const toDownload = (row: DownloadRow): Download => {
  const state = row.state as DownloadState;
  return {
    id: row.id,
    profileId: row.profile_id,
    url: row.url,
    filename: row.filename,
    savePath: row.save_path,
    mimeType: row.mime_type,
    state,
    receivedBytes: row.received_bytes,
    totalBytes: row.total_bytes,
    // Runtime-only fields default here; the DownloadService overlays live values.
    speed: 0,
    etaSeconds: null,
    paused: state === 'paused',
    canResume: state === 'paused' || state === 'interrupted',
    safety: row.safety as DownloadSafety,
    referrer: row.referrer,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
};

export class DownloadsRepository {
  constructor(private readonly db: SqliteDatabase) {}

  list(profileId: string): Download[] {
    const rows = this.db
      .prepare('SELECT * FROM downloads WHERE profile_id = ? ORDER BY started_at DESC')
      .all(profileId) as DownloadRow[];
    return rows.map(toDownload);
  }

  get(id: string): Download | null {
    const row = this.db.prepare('SELECT * FROM downloads WHERE id = ?').get(id) as
      DownloadRow | undefined;
    return row ? toDownload(row) : null;
  }

  insert(download: Download): void {
    this.db
      .prepare(
        `INSERT INTO downloads
           (id, profile_id, url, filename, save_path, mime_type, state, received_bytes, total_bytes, referrer, safety, started_at, completed_at)
         VALUES (@id, @profile_id, @url, @filename, @save_path, @mime_type, @state, @received_bytes, @total_bytes, @referrer, @safety, @started_at, @completed_at)`,
      )
      .run({
        id: download.id,
        profile_id: download.profileId,
        url: download.url,
        filename: download.filename,
        save_path: download.savePath,
        mime_type: download.mimeType,
        state: download.state,
        received_bytes: download.receivedBytes,
        total_bytes: download.totalBytes,
        referrer: download.referrer,
        safety: download.safety,
        started_at: download.startedAt,
        completed_at: download.completedAt,
      });
  }

  update(
    id: string,
    patch: Partial<
      Pick<
        Download,
        'state' | 'receivedBytes' | 'totalBytes' | 'safety' | 'completedAt' | 'savePath'
      >
    >,
  ): void {
    updateColumns(this.db, 'downloads', id, {
      state: patch.state,
      received_bytes: patch.receivedBytes,
      total_bytes: patch.totalBytes,
      safety: patch.safety,
      completed_at: patch.completedAt,
      save_path: patch.savePath,
    });
  }

  remove(id: string): void {
    this.db.prepare('DELETE FROM downloads WHERE id = ?').run(id);
  }

  clearCompleted(profileId: string): void {
    this.db
      .prepare("DELETE FROM downloads WHERE profile_id = ? AND state IN ('completed', 'cancelled')")
      .run(profileId);
  }
}
