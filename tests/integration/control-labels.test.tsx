import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Switch } from '@renderer/components/ui/Switch';
import { Slider } from '@renderer/components/ui/Slider';

/**
 * `getByRole(role, { name })` resolves the accessible name the same way a
 * screen reader does, so these fail if the name is only adjacent text — which
 * is exactly how 36 unnamed controls shipped.
 */
describe('Switch and Slider carry an accessible name', () => {
  it('names a switch, and exposes its state', () => {
    render(<Switch checked onCheckedChange={() => {}} aria-label="Sleep inactive tabs" />);
    const control = screen.getByRole('switch', { name: 'Sleep inactive tabs' });
    expect(control).toHaveAttribute('data-state', 'checked');
  });

  it('names a slider', () => {
    render(
      <Slider value={30} min={5} max={120} onValueChange={() => {}} aria-label="Sleep after" />,
    );
    expect(screen.getByRole('slider', { name: 'Sleep after' })).toBeInTheDocument();
  });

  // A bare "30" is not the setting's value — the unit is in the read-out beside
  // it, which is not announced.
  it('speaks the formatted value rather than the raw number', () => {
    render(
      <Slider
        value={30}
        min={5}
        max={120}
        onValueChange={() => {}}
        aria-label="Sleep after"
        valueText="30 min"
      />,
    );
    expect(screen.getByRole('slider', { name: 'Sleep after' })).toHaveAttribute(
      'aria-valuetext',
      '30 min',
    );
  });

  // `outline-none` sat in @layer utilities and beat the global :focus-visible
  // rule in @layer base, because cascade layers are compared before
  // specificity. Nothing replaced it, so keyboard focus was invisible.
  it('does not suppress the global focus ring', () => {
    const { container } = render(
      <Switch checked={false} onCheckedChange={() => {}} aria-label="Sleep inactive tabs" />,
    );
    expect(container.querySelector('.outline-none')).toBeNull();
  });
});
