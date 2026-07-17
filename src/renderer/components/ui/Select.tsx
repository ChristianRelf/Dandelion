import type { ReactElement } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

interface SelectProps<T extends string> {
  value: T;
  options: Array<SelectOption<T>>;
  onChange: (value: T) => void;
  className?: string;
  /** Accessible label for the trigger when no visible label is present. */
  'aria-label'?: string;
}

/**
 * A custom single-choice select styled to match the design system (native
 * `<select>` popups can't be themed). Built on Radix DropdownMenu so it gets
 * full keyboard navigation, type-ahead and focus management for free.
 */
export function Select<T extends string>({
  value,
  options,
  onChange,
  className,
  'aria-label': ariaLabel,
}: SelectProps<T>): ReactElement {
  const current = options.find((option) => option.value === value);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={ariaLabel}
        className={cn(
          'inline-flex h-[var(--field-height)] min-w-32 items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 text-[13px] text-text no-drag',
          'transition-colors duration-[var(--duration-fast)]',
          'hover:border-line-strong hover:bg-surface-hover data-[state=open]:border-accent data-[state=open]:bg-surface-hover',
          className,
        )}
      >
        <span className="truncate">{current?.label ?? value}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-faint" strokeWidth={2} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-[90] scrollbar-slim max-h-72 min-w-[var(--radix-dropdown-menu-trigger-width)] animate-pop overflow-y-auto rounded-xl border border-line p-1 shadow-[var(--shadow-lg)] glass-strong"
        >
          {options.map((option) => (
            <DropdownMenu.Item
              key={option.value}
              onSelect={() => onChange(option.value)}
              className={cn(
                'flex cursor-pointer items-start gap-2 rounded-lg px-2.5 py-1.5 text-[13px] text-text outline-none select-none',
                'data-[highlighted]:bg-surface-hover',
              )}
            >
              <Check
                className={cn(
                  'mt-0.5 h-3.5 w-3.5 shrink-0 text-accent',
                  option.value === value ? 'opacity-100' : 'opacity-0',
                )}
                strokeWidth={2.5}
              />
              <span className="min-w-0">
                <span className="block truncate">{option.label}</span>
                {option.description && (
                  <span className="block truncate text-xs text-muted">{option.description}</span>
                )}
              </span>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
