import type { PermissionDecision, PermissionType, SitePermissionRule } from '@shared/types';
import { createId } from '@shared/utils';
import type { SqliteDatabase } from '../database';

interface PermissionRow {
  id: string;
  profile_id: string;
  origin: string;
  type: string;
  decision: string;
  updated_at: number;
}

const toRule = (row: PermissionRow): SitePermissionRule => ({
  id: row.id,
  profileId: row.profile_id,
  origin: row.origin,
  type: row.type as PermissionType,
  decision: row.decision as PermissionDecision,
  updatedAt: row.updated_at,
});

export class PermissionsRepository {
  constructor(private readonly db: SqliteDatabase) {}

  list(profileId: string, origin?: string): SitePermissionRule[] {
    const rows = origin
      ? (this.db
          .prepare(
            'SELECT * FROM permissions WHERE profile_id = ? AND origin = ? ORDER BY origin, type',
          )
          .all(profileId, origin) as PermissionRow[])
      : (this.db
          .prepare('SELECT * FROM permissions WHERE profile_id = ? ORDER BY origin, type')
          .all(profileId) as PermissionRow[]);
    return rows.map(toRule);
  }

  get(profileId: string, origin: string, type: PermissionType): SitePermissionRule | null {
    const row = this.db
      .prepare('SELECT * FROM permissions WHERE profile_id = ? AND origin = ? AND type = ?')
      .get(profileId, origin, type) as PermissionRow | undefined;
    return row ? toRule(row) : null;
  }

  set(
    profileId: string,
    origin: string,
    type: PermissionType,
    decision: PermissionDecision,
  ): SitePermissionRule {
    const now = Date.now();
    this.db
      .prepare(
        `INSERT INTO permissions (id, profile_id, origin, type, decision, updated_at)
         VALUES (@id, @profile_id, @origin, @type, @decision, @updated_at)
         ON CONFLICT(profile_id, origin, type)
           DO UPDATE SET decision = excluded.decision, updated_at = excluded.updated_at`,
      )
      .run({
        id: createId('perm'),
        profile_id: profileId,
        origin,
        type,
        decision,
        updated_at: now,
      });
    return this.get(profileId, origin, type)!;
  }

  remove(id: string): void {
    this.db.prepare('DELETE FROM permissions WHERE id = ?').run(id);
  }

  removeByOrigin(profileId: string, origin: string): void {
    this.db
      .prepare('DELETE FROM permissions WHERE profile_id = ? AND origin = ?')
      .run(profileId, origin);
  }
}
