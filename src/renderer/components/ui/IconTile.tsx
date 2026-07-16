import type { ReactElement, ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface IconTileProps {
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = {
  sm: 'h-8 w-8 rounded-lg',
  md: 'h-9 w-9 rounded-lg',
  lg: 'h-10 w-10 rounded-xl',
} as const;

/** A square, surface-filled container for a leading glyph or favicon in a list row. */
export function IconTile({ children, size = 'md', className }: IconTileProps): ReactElement {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center bg-surface text-muted',
        SIZES[size],
        className,
      )}
    >
      {children}
    </div>
  );
}
