import type { ProfileId, ReadingItemId } from './ids';

/**
 * A page saved to read later.
 *
 * Deliberately its own entity rather than a bookmark folder with a flag: a
 * reading-list item has a read/unread lifecycle and no folders, tags or
 * ordering, and it is meant to be emptied as it is read — the opposite of a
 * bookmark, which is kept. Modelling it separately keeps each of the two clean.
 */
export interface ReadingItem {
  id: ReadingItemId;
  profileId: ProfileId;
  url: string;
  title: string;
  favicon: string | null;
  read: boolean;
  createdAt: number;
  /** When the item was marked read, or `null` while it is still unread. */
  readAt: number | null;
}
