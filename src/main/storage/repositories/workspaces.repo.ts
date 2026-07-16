import type { Workspace, WorkspaceWallpaper } from '@shared/types';
import type { SqliteDatabase } from '../database';
import { parseJson, updateColumns } from './helpers';

interface WorkspaceRow {
  id: string;
  profile_id: string;
  name: string;
  icon: string;
  accent_color: string;
  wallpaper: string | null;
  order_index: number;
  created_at: number;
  updated_at: number;
}

const toWorkspace = (row: WorkspaceRow): Workspace => ({
  id: row.id,
  profileId: row.profile_id,
  name: row.name,
  icon: row.icon,
  accentColor: row.accent_color,
  wallpaper: parseJson<WorkspaceWallpaper | null>(row.wallpaper, null),
  order: row.order_index,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export class WorkspacesRepository {
  constructor(private readonly db: SqliteDatabase) {}

  listByProfile(profileId: string): Workspace[] {
    const rows = this.db
      .prepare('SELECT * FROM workspaces WHERE profile_id = ? ORDER BY order_index ASC')
      .all(profileId) as WorkspaceRow[];
    return rows.map(toWorkspace);
  }

  listAll(): Workspace[] {
    const rows = this.db
      .prepare('SELECT * FROM workspaces ORDER BY order_index ASC')
      .all() as WorkspaceRow[];
    return rows.map(toWorkspace);
  }

  get(id: string): Workspace | null {
    const row = this.db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id) as
      WorkspaceRow | undefined;
    return row ? toWorkspace(row) : null;
  }

  insert(workspace: Workspace): void {
    this.db
      .prepare(
        `INSERT INTO workspaces
           (id, profile_id, name, icon, accent_color, wallpaper, order_index, created_at, updated_at)
         VALUES (@id, @profile_id, @name, @icon, @accent_color, @wallpaper, @order_index, @created_at, @updated_at)`,
      )
      .run({
        id: workspace.id,
        profile_id: workspace.profileId,
        name: workspace.name,
        icon: workspace.icon,
        accent_color: workspace.accentColor,
        wallpaper: workspace.wallpaper ? JSON.stringify(workspace.wallpaper) : null,
        order_index: workspace.order,
        created_at: workspace.createdAt,
        updated_at: workspace.updatedAt,
      });
  }

  update(
    id: string,
    patch: Partial<Pick<Workspace, 'name' | 'icon' | 'accentColor' | 'wallpaper' | 'order'>>,
  ): void {
    updateColumns(this.db, 'workspaces', id, {
      name: patch.name,
      icon: patch.icon,
      accent_color: patch.accentColor,
      wallpaper:
        patch.wallpaper === undefined
          ? undefined
          : patch.wallpaper === null
            ? null
            : JSON.stringify(patch.wallpaper),
      order_index: patch.order,
      updated_at: Date.now(),
    });
  }

  reorder(orderedIds: string[]): void {
    const stmt = this.db.prepare('UPDATE workspaces SET order_index = ? WHERE id = ?');
    const run = this.db.transaction((ids: string[]) => {
      ids.forEach((id, index) => stmt.run(index, id));
    });
    run(orderedIds);
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM workspaces WHERE id = ?').run(id);
  }

  nextOrder(profileId: string): number {
    const row = this.db
      .prepare('SELECT COALESCE(MAX(order_index), -1) AS max FROM workspaces WHERE profile_id = ?')
      .get(profileId) as { max: number };
    return row.max + 1;
  }
}
