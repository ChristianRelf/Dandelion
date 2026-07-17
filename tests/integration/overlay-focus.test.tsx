import { afterEach, describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommandPalette } from '@renderer/components/palette/CommandPalette';
import { TabSwitcher } from '@renderer/components/chrome/TabSwitcher';
import { useUiStore } from '@renderer/stores/ui.store';

/**
 * Both overlays wrap cmdk, which binds ArrowDown/ArrowUp/Enter and nothing else.
 * The scrim blocks the pointer but not the tab order, so Tab used to land on a
 * toolbar button behind the overlay — and because Escape was handled by a
 * bubbling listener on the palette's own div, it then went to the toolbar too
 * and the palette could not be closed by keyboard at all.
 *
 * The button is rendered *after* the overlay so that a Tab which is not trapped
 * lands on it, which is what these would catch.
 */
function renderWithChromeBehind(overlay: React.ReactElement): HTMLElement {
  render(
    <>
      {overlay}
      <button type="button">Reload</button>
    </>,
  );
  return screen.getByRole('button', { name: 'Reload' });
}

afterEach(() => useUiStore.setState({ paletteOpen: false, tabSwitcherOpen: false }));

describe('command palette focus containment', () => {
  it('is a modal dialog with an accessible name', () => {
    renderWithChromeBehind(<CommandPalette />);
    act(() => useUiStore.getState().openPalette());
    const dialog = screen.getByRole('dialog', { name: 'Command palette' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  // Focus is asserted without waiting: a field focused a frame late drops the
  // first keystroke of someone who types straight after ⌘K.
  it('focuses its field as it opens, and keeps Tab inside the overlay', async () => {
    const user = userEvent.setup();
    const behind = renderWithChromeBehind(<CommandPalette />);
    act(() => useUiStore.getState().openPalette());

    const field = screen.getByPlaceholderText('Type a command or search…');
    expect(field).toHaveFocus();

    await user.tab();
    expect(behind).not.toHaveFocus();
    expect(field).toHaveFocus();
  });

  it('closes on Escape even when nothing inside it holds focus', async () => {
    const user = userEvent.setup();
    renderWithChromeBehind(<CommandPalette />);
    act(() => useUiStore.getState().openPalette());

    // The panel's own padding is not focusable, so clicking it blurs the field —
    // a bubbling Escape handler would never see the key.
    act(() => (document.activeElement as HTMLElement | null)?.blur());
    await user.keyboard('{Escape}');

    expect(useUiStore.getState().paletteOpen).toBe(false);
  });

  it('puts focus back where it was when it closes', () => {
    const behind = renderWithChromeBehind(<CommandPalette />);
    act(() => behind.focus());
    act(() => useUiStore.getState().openPalette());
    expect(screen.getByPlaceholderText('Type a command or search…')).toHaveFocus();

    act(() => useUiStore.getState().closePalette());
    expect(behind).toHaveFocus();
  });
});

describe('tab switcher focus containment', () => {
  it('is a modal dialog with an accessible name', () => {
    renderWithChromeBehind(<TabSwitcher />);
    act(() => useUiStore.getState().openTabSwitcher());
    expect(screen.getByRole('dialog', { name: 'Switch tab' })).toHaveAttribute(
      'aria-modal',
      'true',
    );
  });

  it('keeps Tab inside the overlay, and still closes on Escape', async () => {
    const user = userEvent.setup();
    const behind = renderWithChromeBehind(<TabSwitcher />);
    act(() => useUiStore.getState().openTabSwitcher());

    expect(screen.getByPlaceholderText('Switch to a tab…')).toHaveFocus();

    await user.tab();
    expect(behind).not.toHaveFocus();

    await user.keyboard('{Escape}');
    expect(useUiStore.getState().tabSwitcherOpen).toBe(false);
  });
});
