import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Icon } from './Icon';
import { Spinner } from './Spinner';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'subtle' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Show a spinner and block interaction while an action is in flight. */
  loading?: boolean;
  /** Kebab-case Lucide icon rendered before the label. */
  icon?: string;
  /** Kebab-case Lucide icon rendered after the label. */
  iconRight?: string;
  fullWidth?: boolean;
  children?: ReactNode;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-accent-fg shadow-[var(--shadow-sm)] hover:brightness-[1.07] active:brightness-95',
  secondary:
    'border border-line bg-surface text-text hover:bg-surface-hover hover:border-line-strong',
  ghost: 'text-muted hover:bg-surface-hover hover:text-text',
  subtle: 'bg-surface text-text hover:bg-surface-hover',
  danger: 'bg-danger-soft text-danger hover:bg-danger hover:text-white',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 rounded-lg px-3 text-[13px]',
  md: 'h-9 gap-2 rounded-lg px-4 text-sm',
  lg: 'h-11 gap-2 rounded-xl px-5 text-[15px]',
};

const ICON_SIZE: Record<ButtonSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-4 w-4',
  lg: 'h-[18px] w-[18px]',
};

/**
 * The single text-button primitive used across the app. Every button has
 * consistent hover, active (press), focus-visible and disabled states plus a
 * built-in loading spinner, so call sites never re-style these by hand.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = 'secondary',
    size = 'md',
    loading = false,
    icon,
    iconRight,
    fullWidth,
    disabled,
    type = 'button',
    children,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap no-drag',
        'transition-all duration-[var(--duration-fast)] ease-[var(--ease-standard)]',
        'active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40',
        SIZES[size],
        VARIANTS[variant],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {loading && <Spinner size={size === 'lg' ? 18 : 15} className="absolute" />}
      <span
        className={cn(
          'inline-flex items-center',
          size === 'lg' ? 'gap-2' : 'gap-1.5',
          loading && 'invisible',
        )}
      >
        {icon && <Icon name={icon} className={ICON_SIZE[size]} />}
        {children}
        {iconRight && <Icon name={iconRight} className={ICON_SIZE[size]} />}
      </span>
    </button>
  );
});
