import type BetterSqlite3 from 'better-sqlite3';
import { up as up001 } from './001_init';

export interface Migration {
  version: number;
  name: string;
  up: (db: BetterSqlite3.Database) => void;
}

/** Ordered, append-only list of schema migrations. Never edit an applied one. */
export const MIGRATIONS: readonly Migration[] = [{ version: 1, name: 'init', up: up001 }];
