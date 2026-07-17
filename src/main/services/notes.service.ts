import type { Note, Result } from '@shared/types';
import { appError, err, ok } from '@shared/types';
import { createId } from '@shared/utils';
import type { Repositories } from '../storage';

/** Free-text notes kept in the sidebar. */
export class NotesService {
  constructor(private readonly repos: Repositories) {}

  list(profileId: string): Note[] {
    return this.repos.notes.list(profileId);
  }

  /** Create an empty note, ready to type into. */
  create(profileId: string): Note {
    const now = Date.now();
    const note: Note = {
      id: createId('note'),
      profileId,
      content: '',
      createdAt: now,
      updatedAt: now,
    };
    this.repos.notes.insert(note);
    return note;
  }

  update(id: string, content: string): Result<Note> {
    const existing = this.repos.notes.get(id);
    if (!existing) return err(appError('note/not-found', 'Note not found'));
    this.repos.notes.updateContent(id, content, Date.now());
    return ok(this.repos.notes.get(id)!);
  }

  remove(id: string): void {
    this.repos.notes.remove(id);
  }
}
