import { describe, expect, it } from 'vitest';
import { PermissionsService } from '@main/services/permissions.service';
import type { PermissionDecision, PermissionType, Profile } from '@shared/types';
import type { Repositories } from '@main/storage';
import type { EventBus } from '@main/core/event-bus';
import type { Logger } from '@main/core/logger';

const ORIGIN = 'https://meet.example.com';
const PROFILE = { id: 'profile_1' } as Profile;

type Rule = { type: PermissionType; decision: PermissionDecision };

/**
 * A service backed by a fixed rule set. Only `handleCheck` is exercised, and it
 * reads nothing but `repos.permissions.get`.
 */
function serviceWith(rules: Rule[]): PermissionsService {
  const repos = {
    permissions: {
      get: (_profileId: string, origin: string, type: PermissionType) =>
        origin === ORIGIN ? (rules.find((rule) => rule.type === type) ?? null) : null,
    },
  } as unknown as Repositories;
  return new PermissionsService(repos, {} as EventBus, {} as Logger);
}

describe('PermissionsService.handleCheck', () => {
  it('resolves a camera check against the camera rule', () => {
    expect(
      serviceWith([{ type: 'camera', decision: 'allow' }]).handleCheck(
        PROFILE,
        'media',
        ORIGIN,
        'video',
      ),
    ).toBe(true);
  });

  it('resolves an audio check against the microphone rule', () => {
    expect(
      serviceWith([{ type: 'microphone', decision: 'allow' }]).handleCheck(
        PROFILE,
        'media',
        ORIGIN,
        'audio',
      ),
    ).toBe(true);
  });

  // Electron sends a single `mediaType` on the check path but a `mediaTypes`
  // array on the request path. Dropping it made every camera check read the
  // microphone rule, so a camera grant looked absent...
  it('does not let a microphone grant answer a camera check', () => {
    expect(
      serviceWith([{ type: 'microphone', decision: 'allow' }]).handleCheck(
        PROFILE,
        'media',
        ORIGIN,
        'video',
      ),
    ).toBe(false);
  });

  // ...and, the security half, an explicit camera block was bypassed outright.
  it('honours an explicit camera block when the microphone is allowed', () => {
    expect(
      serviceWith([
        { type: 'microphone', decision: 'allow' },
        { type: 'camera', decision: 'block' },
      ]).handleCheck(PROFILE, 'media', ORIGIN, 'video'),
    ).toBe(false);
  });

  it('denies a permission with no rule, and one it cannot map', () => {
    expect(serviceWith([]).handleCheck(PROFILE, 'media', ORIGIN, 'video')).toBe(false);
    expect(serviceWith([]).handleCheck(PROFILE, 'midi-sysex', ORIGIN)).toBe(false);
  });
});
