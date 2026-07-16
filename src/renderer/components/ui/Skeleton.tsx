import type { CSSProperties, ReactElement } from 'react';
import { cn } from '../../lib/cn';

interface SkeletonProps {
  className?: string;
  style?: CSSProperties;
}

/** A shimmering placeholder block used while content is loading. */
export function Skeleton({ className, style }: SkeletonProps): ReactElement {
  return <div aria-hidden style={style} className={cn('skeleton rounded-md', className)} />;
}
