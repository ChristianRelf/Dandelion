import type { ReactElement } from 'react';
import { cn } from '../../lib/cn';
import { Icon } from './Icon';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  /** Swatches offered before the custom well. */
  presets: readonly string[];
  /**
   * Names the whole control for a screen reader. The swatches are buttons with
   * their own labels, so this names the group they belong to — "Accent colour"
   * rather than a bare row of unattributed colours.
   */
  label: string;
}

/**
 * A row of preset swatches plus a custom colour well.
 *
 * The well is a native `<input type="color">` laid transparently over a tile,
 * which is what gives it the OS picker for free. Note it fires `onChange`
 * continuously while the user drags, so a consumer that persists on change
 * should expect a stream rather than a single value.
 */
export function ColorPicker({ value, onChange, presets, label }: ColorPickerProps): ReactElement {
  const current = value.toLowerCase();
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label={label}>
      {presets.map((color) => {
        const active = current === color.toLowerCase();
        return (
          <button
            key={color}
            type="button"
            aria-label={`${label} ${color}`}
            aria-pressed={active}
            onClick={() => onChange(color)}
            style={{ backgroundColor: color }}
            className={cn(
              'h-5 w-5 rounded-full transition-transform hover:scale-110',
              active
                ? 'shadow-[0_0_0_2px_var(--bg-elevated),0_0_0_4px_var(--text)]'
                : 'shadow-[inset_0_0_0_1px_rgba(0,0,0,0.14)]',
            )}
          />
        );
      })}
      <label
        title="Custom colour"
        className="relative ml-0.5 inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line bg-surface text-muted transition-colors focus-within:ring-2 focus-within:ring-accent hover:bg-surface-hover hover:text-text"
      >
        <Icon name="plus" className="h-3.5 w-3.5" strokeWidth={2} />
        <input
          type="color"
          aria-label={`Custom ${label.toLowerCase()}`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
    </div>
  );
}
