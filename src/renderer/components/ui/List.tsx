import type { ReactElement, ReactNode } from 'react';
import { cn } from '../../lib/cn';

/** A bordered container that clips its rows into a single rounded card. */
export function ListContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): ReactElement {
  return (
    <div className={cn('overflow-hidden rounded-xl border border-line bg-surface/40', className)}>
      {children}
    </div>
  );
}

interface ListRowProps {
  /** Leading visual (favicon, IconTile, checkbox…). */
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Always-visible trailing content (timestamp, size, a control). */
  meta?: ReactNode;
  /** Trailing actions revealed on row hover / focus. */
  actions?: ReactNode;
  /** When set, the title area becomes a button and the whole row is activatable. */
  onActivate?: () => void;
  className?: string;
}

/**
 * The canonical list row: consistent height, hover, density-aware padding, and a
 * trailing action slot that reveals on hover or keyboard focus.
 */
export function ListRow({
  leading,
  title,
  subtitle,
  meta,
  actions,
  onActivate,
  className,
}: ListRowProps): ReactElement {
  const body = (
    <>
      <span className="block truncate text-[13.5px] text-text">{title}</span>
      {subtitle && <span className="block truncate text-xs text-muted">{subtitle}</span>}
    </>
  );

  return (
    <div
      className={cn(
        'group flex items-center gap-3 border-b border-line px-3 transition-colors last:border-b-0 hover:bg-surface-hover',
        className,
      )}
      style={{ paddingBlock: 'var(--row-py)' }}
    >
      {leading && <div className="shrink-0">{leading}</div>}
      {onActivate ? (
        <button type="button" onClick={onActivate} className="min-w-0 flex-1 rounded text-left">
          {body}
        </button>
      ) : (
        <div className="min-w-0 flex-1">{body}</div>
      )}
      {meta && <div className="shrink-0 text-xs text-faint tabular-nums">{meta}</div>}
      {actions && (
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          {actions}
        </div>
      )}
    </div>
  );
}
