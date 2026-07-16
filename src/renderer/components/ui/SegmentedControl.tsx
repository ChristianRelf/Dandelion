import { useId, type KeyboardEvent, type ReactElement } from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/cn';
import { Icon } from './Icon';
import { Tooltip } from './Tooltip';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: string;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  options: Array<SegmentOption<T>>;
  onChange: (value: T) => void;
  'aria-label': string;
  size?: 'sm' | 'md';
  /**
   * Show icons alone, naming each segment with a tooltip instead of visible
   * text. Labels stay in the accessibility tree, so this trades width for
   * legibility rather than for meaning — only worth it where labels would not
   * fit, and only when every option carries an icon.
   */
  iconOnly?: boolean;
  className?: string;
}

/**
 * An accessible segmented control (radiogroup) with an animated selection pill.
 * Arrow keys move between segments; the active one carries a sliding highlight.
 */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  'aria-label': ariaLabel,
  size = 'md',
  iconOnly = false,
  className,
}: SegmentedControlProps<T>): ReactElement {
  const groupId = useId();
  const index = options.findIndex((option) => option.value === value);

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const next = options[(index + delta + options.length) % options.length];
    if (next) onChange(next.value);
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cn(
        'items-center gap-0.5 rounded-lg bg-surface p-0.5',
        // Icon-only segments share the width evenly rather than hugging content.
        iconOnly ? 'flex w-full' : 'inline-flex',
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        const segment = (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cn(
              'relative inline-flex items-center gap-1.5 rounded-md font-medium transition-colors',
              size === 'sm' ? 'h-6 text-[12px]' : 'h-7 text-[13px]',
              iconOnly ? 'flex-1 justify-center' : size === 'sm' ? 'px-2' : 'px-2.5',
              active ? 'text-text' : 'text-muted hover:text-text',
            )}
          >
            {active && (
              <motion.span
                layoutId={`segment-${groupId}`}
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                className="absolute inset-0 rounded-md bg-bg-elevated shadow-[var(--shadow-sm)]"
              />
            )}
            {option.icon && <Icon name={option.icon} className="relative h-3.5 w-3.5" />}
            <span className={cn('relative', iconOnly && 'sr-only')}>{option.label}</span>
          </button>
        );

        return iconOnly ? (
          <Tooltip key={option.value} content={option.label}>
            {segment}
          </Tooltip>
        ) : (
          segment
        );
      })}
    </div>
  );
}
