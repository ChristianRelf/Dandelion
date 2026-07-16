import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  size?: 'sm' | 'md';
}

/** A square, ghost icon button used throughout the chrome. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { className, active, size = 'md', type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'no-drag inline-flex shrink-0 items-center justify-center rounded-lg text-muted',
        'transition-[transform,background-color,color] duration-[var(--duration-fast)] ease-[var(--ease-standard)]',
        'hover:bg-surface-hover hover:text-text active:scale-[0.92]',
        'disabled:pointer-events-none disabled:opacity-35',
        size === 'sm' ? 'h-7 w-7' : 'h-[30px] w-[30px]',
        active && 'bg-surface-active text-text',
        className,
      )}
      {...props}
    />
  );
});
