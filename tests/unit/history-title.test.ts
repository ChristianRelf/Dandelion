import { describe, expect, it, vi } from 'vitest';
import { HistoryService } from '@main/services/history.service';
import type { Repositories } from '@main/storage';

function makeService() {
  const history = { setTitle: vi.fn(), recordVisit: vi.fn() };
  const service = new HistoryService({ history } as unknown as Repositories);
  return { service, history };
}

describe('HistoryService.setTitle', () => {
  it('records the title a page reports', () => {
    const { service, history } = makeService();
    service.setTitle('profile-1', 'https://example.com/article', 'The Article');
    expect(history.setTitle).toHaveBeenCalledWith(
      'profile-1',
      'https://example.com/article',
      'The Article',
    );
  });

  it('ignores an empty title, so a known one is never blanked', () => {
    const { service, history } = makeService();
    service.setTitle('profile-1', 'https://example.com/article', '');
    expect(history.setTitle).not.toHaveBeenCalled();
  });

  it('ignores urls history never records', () => {
    const { service, history } = makeService();
    service.setTitle('profile-1', 'dandelion://settings', 'Settings');
    service.setTitle('profile-1', 'file:///etc/passwd', 'passwd');
    expect(history.setTitle).not.toHaveBeenCalled();
  });
});
