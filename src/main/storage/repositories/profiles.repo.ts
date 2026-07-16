import type { Profile } from '@shared/types';
import type { SqliteDatabase } from '../database';
import { fromBool, toBool, updateColumns } from './helpers';

interface ProfileRow {
  id: string;
  name: string;
  color: string;
  avatar: string | null;
  partition: string;
  is_default: number;
  is_private: number;
  created_at: number;
  updated_at: number;
}

const toProfile = (row: ProfileRow): Profile => ({
  id: row.id,
  name: row.name,
  color: row.color,
  avatar: row.avatar,
  partition: row.partition,
  isDefault: toBool(row.is_default),
  isPrivate: toBool(row.is_private),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export class ProfilesRepository {
  constructor(private readonly db: SqliteDatabase) {}

  list(): Profile[] {
    const rows = this.db
      .prepare('SELECT * FROM profiles ORDER BY is_default DESC, created_at ASC')
      .all() as ProfileRow[];
    return rows.map(toProfile);
  }

  get(id: string): Profile | null {
    const row = this.db.prepare('SELECT * FROM profiles WHERE id = ?').get(id) as
      ProfileRow | undefined;
    return row ? toProfile(row) : null;
  }

  getDefault(): Profile | null {
    const row = this.db.prepare('SELECT * FROM profiles WHERE is_default = 1 LIMIT 1').get() as
      ProfileRow | undefined;
    return row ? toProfile(row) : null;
  }

  insert(profile: Profile): void {
    this.db
      .prepare(
        `INSERT INTO profiles
           (id, name, color, avatar, partition, is_default, is_private, created_at, updated_at)
         VALUES (@id, @name, @color, @avatar, @partition, @is_default, @is_private, @created_at, @updated_at)`,
      )
      .run({
        id: profile.id,
        name: profile.name,
        color: profile.color,
        avatar: profile.avatar,
        partition: profile.partition,
        is_default: fromBool(profile.isDefault),
        is_private: fromBool(profile.isPrivate),
        created_at: profile.createdAt,
        updated_at: profile.updatedAt,
      });
  }

  update(id: string, patch: Partial<Pick<Profile, 'name' | 'color' | 'avatar'>>): void {
    updateColumns(this.db, 'profiles', id, {
      name: patch.name,
      color: patch.color,
      avatar: patch.avatar,
      updated_at: Date.now(),
    });
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM profiles WHERE id = ?').run(id);
  }

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM profiles').get() as { n: number };
    return row.n;
  }
}
