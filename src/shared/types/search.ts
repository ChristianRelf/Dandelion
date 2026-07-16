import type { SearchEngineId } from './ids';

export interface SearchEngine {
  id: SearchEngineId;
  name: string;
  /** Short keyword/bang that activates this engine inline (e.g. `g`, `ddg`). */
  keyword: string;
  /** Query template containing a single `%s` placeholder. */
  searchUrl: string;
  /** Optional suggestions endpoint template (`%s`), or `null` if unsupported. */
  suggestUrl: string | null;
  favicon: string | null;
  isDefault: boolean;
  isBuiltIn: boolean;
}
