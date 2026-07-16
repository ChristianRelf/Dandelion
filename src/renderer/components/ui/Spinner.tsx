import type { ReactElement } from 'react';
import { cn } from '../../lib/cn';

interface SpinnerProps {
  /** Diameter in pixels. */
  size?: number;
  className?: string;
}

/**
 * An indeterminate loading spinner. Inherits the current text colour, so it
 * sits naturally inside buttons, rows and empty states.
 */
export function Spinner({ size = 16, className }: SpinnerProps): ReactElement {
  return (
    <span
      role="status"
      aria-label="Loading"
      style={{ width: size, height: size, borderWidth: Math.max(1.5, size / 10) }}
      className={cn(
        'inline-block shrink-0 animate-spin rounded-full border-current border-t-transparent',
        className,
      )}
    />
  );
}
