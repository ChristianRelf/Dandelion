import type { GestureBinding } from '../types/settings';

/**
 * Default right-drag strokes.
 *
 * Deliberately a small standalone table rather than a `defaultGesture` field on
 * `CommandDescriptor`: only a handful of the sixty-odd commands want a gesture,
 * so the field would be `null` on almost all of them and dilute the registry.
 * `action` still refers to that registry, so a gesture cannot name a command
 * that does not exist — `buildGestureBindings` drops any that does.
 *
 * The set follows the Opera convention most gesture users already have in their
 * hands, and pairs opposites: left/right walk history the way they point, and
 * down-right throws a tab away while down-left brings one back.
 */
export const DEFAULT_GESTURES: readonly GestureBinding[] = [
  { action: 'navigation.back', gesture: 'L', enabled: true },
  { action: 'navigation.forward', gesture: 'R', enabled: true },
  { action: 'navigation.reload', gesture: 'UD', enabled: true },
  { action: 'tab.close', gesture: 'DR', enabled: true },
  { action: 'tab.reopenClosed', gesture: 'DL', enabled: true },
];

/** Commands offered in the gesture editor, in the order they are listed. */
export const GESTURABLE_COMMANDS: readonly string[] = [
  'navigation.back',
  'navigation.forward',
  'navigation.reload',
  'navigation.stop',
  'tab.new',
  'tab.close',
  'tab.reopenClosed',
  'tab.duplicate',
  'tab.next',
  'tab.previous',
];
