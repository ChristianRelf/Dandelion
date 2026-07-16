import type { SearchEngine } from '@shared/types';
import type { SqliteDatabase } from '../database';
import { fromBool, toBool, updateColumns } from './helpers';

interface EngineRow {
  id: string;
  name: string;
  keyword: string;
  search_url: string;
  suggest_url: string | null;
  favicon: string | null;
  is_default: number;
  is_builtin: number;
  order_index: number;
}

const toEngine = (row: EngineRow): SearchEngine => ({
  id: row.id,
  name: row.name,
  keyword: row.keyword,
  searchUrl: row.search_url,
  suggestUrl: row.suggest_url,
  favicon: row.favicon,
  isDefault: toBool(row.is_default),
  isBuiltIn: toBool(row.is_builtin),
});

export class SearchEnginesRepository {
  constructor(private readonly db: SqliteDatabase) {}

  list(): SearchEngine[] {
    const rows = this.db
      .prepare('SELECT * FROM search_engines ORDER BY order_index ASC')
      .all() as EngineRow[];
    return rows.map(toEngine);
  }

  get(id: string): SearchEngine | null {
    const row = this.db.prepare('SELECT * FROM search_engines WHERE id = ?').get(id) as
      EngineRow | undefined;
    return row ? toEngine(row) : null;
  }

  getDefault(): SearchEngine | null {
    const row = this.db
      .prepare('SELECT * FROM search_engines WHERE is_default = 1 LIMIT 1')
      .get() as EngineRow | undefined;
    return row ? toEngine(row) : null;
  }

  getByKeyword(keyword: string): SearchEngine | null {
    const row = this.db.prepare('SELECT * FROM search_engines WHERE keyword = ?').get(keyword) as
      EngineRow | undefined;
    return row ? toEngine(row) : null;
  }

  isEmpty(): boolean {
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM search_engines').get() as { n: number };
    return row.n === 0;
  }

  insert(engine: SearchEngine, orderIndex: number): void {
    this.db
      .prepare(
        `INSERT INTO search_engines
           (id, name, keyword, search_url, suggest_url, favicon, is_default, is_builtin, order_index)
         VALUES (@id, @name, @keyword, @search_url, @suggest_url, @favicon, @is_default, @is_builtin, @order_index)`,
      )
      .run({
        id: engine.id,
        name: engine.name,
        keyword: engine.keyword,
        search_url: engine.searchUrl,
        suggest_url: engine.suggestUrl,
        favicon: engine.favicon,
        is_default: fromBool(engine.isDefault),
        is_builtin: fromBool(engine.isBuiltIn),
        order_index: orderIndex,
      });
  }

  seed(engines: readonly SearchEngine[]): void {
    const run = this.db.transaction((list: readonly SearchEngine[]) => {
      list.forEach((engine, index) => this.insert(engine, index));
    });
    run(engines);
  }

  update(
    id: string,
    patch: Partial<Pick<SearchEngine, 'name' | 'keyword' | 'searchUrl' | 'suggestUrl' | 'favicon'>>,
  ): void {
    updateColumns(this.db, 'search_engines', id, {
      name: patch.name,
      keyword: patch.keyword,
      search_url: patch.searchUrl,
      suggest_url: patch.suggestUrl,
      favicon: patch.favicon,
    });
  }

  setDefault(id: string): void {
    const run = this.db.transaction((engineId: string) => {
      this.db.prepare('UPDATE search_engines SET is_default = 0').run();
      this.db.prepare('UPDATE search_engines SET is_default = 1 WHERE id = ?').run(engineId);
    });
    run(id);
  }

  remove(id: string): void {
    this.db.prepare('DELETE FROM search_engines WHERE id = ? AND is_builtin = 0').run(id);
  }
}
