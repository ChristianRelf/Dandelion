import type { Note } from '@shared/types';
import type { SqliteDatabase } from '../database';

interface NoteRow {
  id: string;
  profile_id: string;
  content: string;
  created_at: number;
  updated_at: number;
}

const toNote = (row: NoteRow): Note => ({
  id: row.id,
  profileId: row.profile_id,
  content: row.content,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export class NotesRepository {
  constructor(private readonly db: SqliteDatabase) {}

  /** Most-recently-edited first — a notes list is a working set, not an archive. */
  list(profileId: string): Note[] {
    const rows = this.db
      .prepare('SELECT * FROM notes WHERE profile_id = ? ORDER BY updated_at DESC')
      .all(profileId) as NoteRow[];
    return rows.map(toNote);
  }

  get(id: string): Note | null {
    const row = this.db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as NoteRow | undefined;
    return row ? toNote(row) : null;
  }

  insert(note: Note): void {
    this.db
      .prepare(
        `INSERT INTO notes (id, profile_id, content, created_at, updated_at)
         VALUES (@id, @profile_id, @content, @created_at, @updated_at)`,
      )
      .run({
        id: note.id,
        profile_id: note.profileId,
        content: note.content,
        created_at: note.createdAt,
        updated_at: note.updatedAt,
      });
  }

  updateContent(id: string, content: string, updatedAt: number): void {
    this.db
      .prepare('UPDATE notes SET content = ?, updated_at = ? WHERE id = ?')
      .run(content, updatedAt, id);
  }

  remove(id: string): void {
    this.db.prepare('DELETE FROM notes WHERE id = ?').run(id);
  }
}
