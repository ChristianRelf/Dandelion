import type { NoteId, ProfileId } from './ids';

/**
 * A free-text note. The first non-empty line is treated as the title in the UI,
 * so a note is a single `content` blob rather than a title/body pair — there is
 * nothing to keep in sync, and an empty note is simply an empty string.
 */
export interface Note {
  id: NoteId;
  profileId: ProfileId;
  content: string;
  createdAt: number;
  updatedAt: number;
}
