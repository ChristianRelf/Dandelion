import { describe, expect, it } from 'vitest';
import { NotesService } from '@main/services/notes.service';
import type { Note } from '@shared/types';
import type { Repositories } from '@main/storage';

const PROFILE = 'profile_1';

/** An in-memory notes repo — enough for create/update/remove/list. */
function makeService() {
  const rows = new Map<string, Note>();

  const repos = {
    notes: {
      list: (profileId: string) =>
        [...rows.values()]
          .filter((note) => note.profileId === profileId)
          .sort((a, b) => b.updatedAt - a.updatedAt),
      get: (id: string) => rows.get(id) ?? null,
      insert: (note: Note) => rows.set(note.id, note),
      updateContent: (id: string, content: string, updatedAt: number) => {
        const note = rows.get(id);
        if (note) rows.set(id, { ...note, content, updatedAt });
      },
      remove: (id: string) => rows.delete(id),
    },
  } as unknown as Repositories;

  return { service: new NotesService(repos), rows };
}

describe('NotesService', () => {
  it('creates an empty note', () => {
    const { service } = makeService();
    const note = service.create(PROFILE);
    expect(note.content).toBe('');
    expect(service.list(PROFILE)).toHaveLength(1);
  });

  it('updates content and returns the saved note', () => {
    const { service } = makeService();
    const note = service.create(PROFILE);
    const result = service.update(note.id, 'Shopping\nmilk\neggs');
    expect(result.ok).toBe(true);
    expect(service.list(PROFILE)[0]?.content).toBe('Shopping\nmilk\neggs');
  });

  it('returns an error updating a note that does not exist', () => {
    const { service } = makeService();
    const result = service.update('note_missing', 'x');
    expect(result.ok).toBe(false);
  });

  it('removes a note', () => {
    const { service } = makeService();
    const note = service.create(PROFILE);
    service.remove(note.id);
    expect(service.list(PROFILE)).toHaveLength(0);
  });
});
