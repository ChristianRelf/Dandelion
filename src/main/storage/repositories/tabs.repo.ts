import type { TabGroup, TabGroupColor } from '@shared/types';
import type { SqliteDatabase } from '../database';
import { fromBool, toBool, updateColumns } from './helpers';

/** The persisted subset of a tab; runtime fields live only in the TabManager. */
export interface PersistedTab {
  id: string;
  workspaceId: string;
  groupId: string | null;
  index: number;
  url: string;
  title: string;
  favicon: string | null;
  pinned: boolean;
  createdAt: number;
  lastActiveAt: number;
}

interface TabRow {
  id: string;
  workspace_id: string;
  group_id: string | null;
  order_index: number;
  url: string;
  title: string;
  favicon: string | null;
  pinned: number;
  created_at: number;
  last_active_at: number;
}

interface GroupRow {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
  collapsed: number;
  order_index: number;
  created_at: number;
}

const toTab = (row: TabRow): PersistedTab => ({
  id: row.id,
  workspaceId: row.workspace_id,
  groupId: row.group_id,
  index: row.order_index,
  url: row.url,
  title: row.title,
  favicon: row.favicon,
  pinned: toBool(row.pinned),
  createdAt: row.created_at,
  lastActiveAt: row.last_active_at,
});

const toGroup = (row: GroupRow): TabGroup => ({
  id: row.id,
  workspaceId: row.workspace_id,
  name: row.name,
  color: row.color as TabGroupColor,
  collapsed: toBool(row.collapsed),
  index: row.order_index,
  createdAt: row.created_at,
});

export class TabsRepository {
  constructor(private readonly db: SqliteDatabase) {}

  /* ---- Tabs ---- */

  listByWorkspace(workspaceId: string): PersistedTab[] {
    const rows = this.db
      .prepare('SELECT * FROM tabs WHERE workspace_id = ? ORDER BY order_index ASC')
      .all(workspaceId) as TabRow[];
    return rows.map(toTab);
  }

  upsert(tab: PersistedTab): void {
    this.db
      .prepare(
        `INSERT INTO tabs
           (id, workspace_id, group_id, order_index, url, title, favicon, pinned, created_at, last_active_at)
         VALUES (@id, @workspace_id, @group_id, @order_index, @url, @title, @favicon, @pinned, @created_at, @last_active_at)
         ON CONFLICT(id) DO UPDATE SET
           workspace_id = excluded.workspace_id,
           group_id     = excluded.group_id,
           order_index  = excluded.order_index,
           url          = excluded.url,
           title        = excluded.title,
           favicon      = excluded.favicon,
           pinned       = excluded.pinned,
           last_active_at = excluded.last_active_at`,
      )
      .run({
        id: tab.id,
        workspace_id: tab.workspaceId,
        group_id: tab.groupId,
        order_index: tab.index,
        url: tab.url,
        title: tab.title,
        favicon: tab.favicon,
        pinned: fromBool(tab.pinned),
        created_at: tab.createdAt,
        last_active_at: tab.lastActiveAt,
      });
  }

  update(id: string, patch: Partial<Omit<PersistedTab, 'id' | 'workspaceId' | 'createdAt'>>): void {
    updateColumns(this.db, 'tabs', id, {
      group_id: patch.groupId,
      order_index: patch.index,
      url: patch.url,
      title: patch.title,
      favicon: patch.favicon,
      pinned: patch.pinned === undefined ? undefined : fromBool(patch.pinned),
      last_active_at: patch.lastActiveAt,
    });
  }

  remove(id: string): void {
    this.db.prepare('DELETE FROM tabs WHERE id = ?').run(id);
  }

  removeByWorkspace(workspaceId: string): void {
    this.db.prepare('DELETE FROM tabs WHERE workspace_id = ?').run(workspaceId);
  }

  reorder(orderedIds: string[]): void {
    const stmt = this.db.prepare('UPDATE tabs SET order_index = ? WHERE id = ?');
    const run = this.db.transaction((ids: string[]) => {
      ids.forEach((id, index) => stmt.run(index, id));
    });
    run(orderedIds);
  }

  /* ---- Groups ---- */

  listGroups(workspaceId: string): TabGroup[] {
    const rows = this.db
      .prepare('SELECT * FROM tab_groups WHERE workspace_id = ? ORDER BY order_index ASC')
      .all(workspaceId) as GroupRow[];
    return rows.map(toGroup);
  }

  getGroup(id: string): TabGroup | null {
    const row = this.db.prepare('SELECT * FROM tab_groups WHERE id = ?').get(id) as
      GroupRow | undefined;
    return row ? toGroup(row) : null;
  }

  insertGroup(group: TabGroup): void {
    this.db
      .prepare(
        `INSERT INTO tab_groups (id, workspace_id, name, color, collapsed, order_index, created_at)
         VALUES (@id, @workspace_id, @name, @color, @collapsed, @order_index, @created_at)`,
      )
      .run({
        id: group.id,
        workspace_id: group.workspaceId,
        name: group.name,
        color: group.color,
        collapsed: fromBool(group.collapsed),
        order_index: group.index,
        created_at: group.createdAt,
      });
  }

  updateGroup(
    id: string,
    patch: Partial<Pick<TabGroup, 'name' | 'color' | 'collapsed' | 'index'>>,
  ): void {
    updateColumns(this.db, 'tab_groups', id, {
      name: patch.name,
      color: patch.color,
      collapsed: patch.collapsed === undefined ? undefined : fromBool(patch.collapsed),
      order_index: patch.index,
    });
  }

  removeGroup(id: string): void {
    this.db.prepare('DELETE FROM tab_groups WHERE id = ?').run(id);
  }
}
