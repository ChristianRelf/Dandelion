import { z } from 'zod';
import { zId } from './common';

export const permissionType = z.enum([
  'camera',
  'microphone',
  'geolocation',
  'notifications',
  'clipboard-read',
  'clipboard-write',
  'midi',
  'bluetooth',
  'usb',
  'serial',
  'hid',
  'filesystem',
  'idle-detection',
  'popups',
  'autoplay',
  'pointer-lock',
  'fullscreen',
  'display-capture',
  'persistent-storage',
]);

export const setPermissionInput = z.object({
  profileId: zId,
  origin: z.string().min(1),
  type: permissionType,
  decision: z.enum(['allow', 'block', 'ask']),
});
export const respondPermissionInput = z.object({
  requestId: zId,
  decision: z.enum(['allow', 'block']),
  remember: z.boolean().default(false),
});
export const listPermissionsInput = z.object({
  profileId: zId,
  origin: z.string().optional(),
});

export const listCookiesInput = z.object({
  profileId: zId,
  domain: z.string().optional(),
});
export const deleteCookieInput = z.object({
  profileId: zId,
  name: z.string(),
  domain: z.string(),
  path: z.string().default('/'),
  secure: z.boolean().default(false),
});

export const clearDataInput = z.object({
  profileId: zId,
  options: z.object({
    history: z.boolean(),
    cookies: z.boolean(),
    cache: z.boolean(),
    downloads: z.boolean(),
    formData: z.boolean(),
    passwords: z.boolean(),
  }),
  since: z.number().int().optional(),
});

export const originRef = z.object({ profileId: zId, origin: z.string().min(1) });
