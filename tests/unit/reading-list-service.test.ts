import { describe, expect, it } from 'vitest';
import { ReadingListService } from '@main/services/reading-list.service';
import type { ReadingItem } from '@shared/types';
import type { Repositories } from '@main/storage';

const PROFILE = 'profile_1';

/** An in-memory reading-list repo — enough for add/setRead/remove/clearRead. */
function makeService() {
  const rows = new Map<string, ReadingItem>();

  const repos = {
    readingList: {
      list: (profileId: string) =>
        [...rows.values()]
          .filter((item) => item.profileId === profileId)
          .sort((a, b) => Number(a.read) - Number(b.read) || b.createdAt - a.createdAt),
      findByUrl: (profileId: string, url: string) =>
        [...rows.values()].find((item) => item.profileId === profileId && item.url === url) ?? null,
      insert: (item: ReadingItem) => rows.set(item.id, item),
      setRead: (id: string, read: boolean) => {
        const item = rows.get(id);
        if (item) rows.set(id, { ...item, read, readAt: read ? 1 : null });
      },
      remove: (id: string) => rows.delete(id),
      clearRead: (profileId: string) => {
        for (const [id, item] of rows) {
          if (item.profileId === profileId && item.read) rows.delete(id);
        }
      },
    },
  } as unknown as Repositories;

  return { service: new ReadingListService(repos), rows };
}

describe('ReadingListService', () => {
  it('saves a page and returns the created item', () => {
    const { service } = makeService();
    const item = service.add({
      profileId: PROFILE,
      url: 'https://example.com/',
      title: 'Example',
      favicon: null,
    });
    expect(item).toMatchObject({ url: 'https://example.com/', read: false, readAt: null });
    expect(service.list(PROFILE)).toHaveLength(1);
  });

  it('is idempotent — saving the same URL twice does not duplicate it', () => {
    const { service } = makeService();
    const first = service.add({
      profileId: PROFILE,
      url: 'https://a.com/',
      title: 'A',
      favicon: null,
    });
    const second = service.add({
      profileId: PROFILE,
      url: 'https://a.com/',
      title: 'A',
      favicon: null,
    });
    expect(second.id).toBe(first.id);
    expect(service.list(PROFILE)).toHaveLength(1);
  });

  it('orders unread before read', () => {
    const { service } = makeService();
    const a = service.add({ profileId: PROFILE, url: 'https://a.com/', title: 'A', favicon: null });
    service.add({ profileId: PROFILE, url: 'https://b.com/', title: 'B', favicon: null });
    service.setRead(a.id, true);
    expect(service.list(PROFILE).map((item) => item.url)).toEqual([
      'https://b.com/',
      'https://a.com/',
    ]);
  });

  it('clears only the read items', () => {
    const { service } = makeService();
    const a = service.add({ profileId: PROFILE, url: 'https://a.com/', title: 'A', favicon: null });
    service.add({ profileId: PROFILE, url: 'https://b.com/', title: 'B', favicon: null });
    service.setRead(a.id, true);
    service.clearRead(PROFILE);
    expect(service.list(PROFILE).map((item) => item.url)).toEqual(['https://b.com/']);
  });
});
