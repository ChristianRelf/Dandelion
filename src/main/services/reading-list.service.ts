import type { ReadingItem } from '@shared/types';
import { createId } from '@shared/utils';
import type { Repositories } from '../storage';

export interface AddReadingItemInput {
  profileId: string;
  url: string;
  title: string;
  favicon: string | null;
}

/** Saved-for-later pages, with a read/unread lifecycle. */
export class ReadingListService {
  constructor(private readonly repos: Repositories) {}

  list(profileId: string): ReadingItem[] {
    return this.repos.readingList.list(profileId);
  }

  /**
   * Save a page, or return the existing entry if it is already saved. Saving the
   * same URL twice should be a no-op, not a duplicate — the panel's "save this
   * page" button is easy to press again on a page you already queued.
   */
  add(input: AddReadingItemInput): ReadingItem {
    const existing = this.repos.readingList.findByUrl(input.profileId, input.url);
    if (existing) return existing;
    const item: ReadingItem = {
      id: createId('read'),
      profileId: input.profileId,
      url: input.url,
      title: input.title,
      favicon: input.favicon,
      read: false,
      createdAt: Date.now(),
      readAt: null,
    };
    this.repos.readingList.insert(item);
    return item;
  }

  setRead(id: string, read: boolean): void {
    this.repos.readingList.setRead(id, read);
  }

  remove(id: string): void {
    this.repos.readingList.remove(id);
  }

  clearRead(profileId: string): void {
    this.repos.readingList.clearRead(profileId);
  }
}
