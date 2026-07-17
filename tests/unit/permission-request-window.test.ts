import { describe, expect, it } from 'vitest';
import { PermissionsService, type RequestingTab } from '@main/services/permissions.service';
import type { BrowserEvent, PermissionDecision, PermissionType, Profile } from '@shared/types';
import type { WebContents } from 'electron';
import type { Repositories } from '@main/storage';
import type { EventBus } from '@main/core/event-bus';
import type { Logger } from '@main/core/logger';

const ORIGIN = 'https://meet.example.com';
const PROFILE = { id: 'profile_1' } as Profile;
const TAB: RequestingTab = { tabId: 'tab_1', windowId: 'window_1' };

/** Stands in for the requesting page; only its identity is ever used. */
const REQUESTER = {} as WebContents;

type Rule = { type: PermissionType; decision: PermissionDecision };

function makeService(options: { tab?: RequestingTab | null; rules?: Rule[] } = {}) {
  const emitted: BrowserEvent[] = [];
  const warnings: string[] = [];

  const repos = {
    permissions: {
      get: (_profileId: string, origin: string, type: PermissionType) =>
        origin === ORIGIN
          ? ((options.rules ?? []).find((rule) => rule.type === type) ?? null)
          : null,
      set: () => {},
    },
  } as unknown as Repositories;

  const service = new PermissionsService(
    repos,
    { emit: (event: BrowserEvent) => emitted.push(event) } as unknown as EventBus,
    {
      debug: () => {},
      info: () => {},
      warn: (message: string) => warnings.push(message),
      error: () => {},
    } as unknown as Logger,
  );
  service.setTabResolver(() => (options.tab === undefined ? TAB : options.tab));

  return { service, emitted, warnings };
}

/** Ask for the camera, returning what Chromium was told. */
function requestCamera(service: PermissionsService): { answered: boolean | null } {
  const result: { answered: boolean | null } = { answered: null };
  service.handleRequest(PROFILE, REQUESTER, 'media', `${ORIGIN}/call`, ['video'], (allow) => {
    result.answered = allow;
  });
  return result;
}

describe('PermissionsService.handleRequest — which window is asked', () => {
  // The defect: events fan out to every window and the request carried no
  // windowId, so `PermissionPrompt` structurally could not filter. Two windows
  // open, a site in window A asks for the camera, and *both* render the prompt
  // with "Allow" auto-focused — window B for a tab it does not contain, for a
  // site its user is not looking at.
  it('names the window holding the tab that asked', () => {
    const { service, emitted } = makeService();
    requestCamera(service);

    const event = emitted.find((item) => item.type === 'permission:request');
    expect(event?.type === 'permission:request' && event.request.windowId).toBe('window_1');
    expect(event?.type === 'permission:request' && event.request.tabId).toBe('tab_1');
  });

  // It used to emit `tabId: ''` here and prompt everywhere. A prompt that cannot
  // name the tab it belongs to cannot be answered honestly, so it is refused —
  // and said so in the log, rather than silently.
  it('refuses a request no tab owns instead of prompting every window', () => {
    const { service, emitted, warnings } = makeService({ tab: null });
    const result = requestCamera(service);

    expect(result.answered).toBe(false);
    expect(emitted).toHaveLength(0);
    expect(warnings.join(' ')).toContain('no tab owns');
  });

  // Attribution gates the prompt, not the whole handler: a site the user has
  // already answered for needs no window to be asked in.
  it('still honours a stored rule when nothing can be attributed', () => {
    const { service, emitted } = makeService({
      tab: null,
      rules: [{ type: 'camera', decision: 'allow' }],
    });
    const result = requestCamera(service);

    expect(result.answered).toBe(true);
    expect(emitted).toHaveLength(0);
  });

  it('denies a permission it cannot map without consulting the resolver', () => {
    const { service, emitted } = makeService({ tab: null });
    const result: { answered: boolean | null } = { answered: null };
    service.handleRequest(
      PROFILE,
      REQUESTER,
      'not-a-permission',
      `${ORIGIN}/x`,
      undefined,
      (allow) => {
        result.answered = allow;
      },
    );

    expect(result.answered).toBe(false);
    expect(emitted).toHaveLength(0);
  });
});
