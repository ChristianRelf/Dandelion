import { describe, expect, it } from 'vitest';
import { acceleratorLabel, getCommand } from '@shared/constants';

/**
 * The title bar hand-wrote `⌃B` and `⌃/` for two `CmdOrCtrl` bindings, so on
 * macOS it advertised Ctrl for keys that answer to ⌘. These pin the label to the
 * registry rather than to a string someone typed.
 */
describe('acceleratorLabel', () => {
  it('renders CmdOrCtrl as ⌘, not ⌃', () => {
    expect(acceleratorLabel('view.toggleSidebar')).toBe('⌘ B');
    expect(acceleratorLabel('tools.aiSidebar')).toBe('⌘ /');
  });

  it('renders the modifier glyphs', () => {
    expect(acceleratorLabel('tools.downloads')).toBe('⌘ ⇧ J');
    expect(acceleratorLabel('navigation.back')).toBe('⌥ Left');
  });

  it('joins with the separator the caller asks for, for tooltips that run glyphs together', () => {
    expect(acceleratorLabel('tools.downloads', '')).toBe('⌘⇧J');
    expect(acceleratorLabel('view.toggleSidebar', '')).toBe('⌘B');
  });

  it('leaves an unbound command without a label', () => {
    expect(getCommand('tab.duplicate')?.defaultKeys).toBeNull();
    expect(acceleratorLabel('tab.duplicate')).toBeNull();
    expect(acceleratorLabel('not.a.command')).toBeNull();
  });

  // `CmdOrCtrl+-` and `CmdOrCtrl+Plus` both survive splitting on '+'.
  it('does not mangle bindings whose key is punctuation', () => {
    expect(acceleratorLabel('view.zoomOut')).toBe('⌘ -');
    expect(acceleratorLabel('view.zoomIn')).toBe('⌘ Plus');
  });
});
