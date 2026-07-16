import type { ReactElement, ReactNode } from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/cn';
import { Icon } from './Icon';

interface EmptyStateProps {
  /** Kebab-case Lucide icon name shown in the halo. */
  icon: string;
  title: string;
  description?: string;
  /** Optional call-to-action (typically a <Button/>). */
  action?: ReactNode;
  className?: string;
  /** Tighten vertical padding when shown inside a smaller panel. */
  compact?: boolean;
}

/**
 * The shared empty / zero-data state: a haloed icon, a title, supporting copy
 * and an optional action. Used by every list surface so "nothing here yet"
 * always feels intentional rather than broken.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact = false,
}: EmptyStateProps): ReactElement {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-2 px-6 py-10' : 'gap-3 px-6 py-20',
        className,
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-surface text-muted">
        <Icon name={icon} className="h-6 w-6" strokeWidth={1.5} />
      </div>
      <div className="space-y-1">
        <p className="text-[15px] font-medium text-text">{title}</p>
        {description && (
          <p className="mx-auto max-w-xs text-[13px] leading-relaxed text-muted">{description}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </motion.div>
  );
}
