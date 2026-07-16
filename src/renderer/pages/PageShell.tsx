import type { ReactElement, ReactNode } from 'react';

interface PageShellProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}

/** Consistent layout for internal `dandelion://` pages. */
export function PageShell({
  title,
  description,
  icon,
  actions,
  children,
  wide,
}: PageShellProps): ReactElement {
  return (
    <div className={`mx-auto w-full px-8 py-10 ${wide ? 'max-w-5xl' : 'max-w-3xl'}`}>
      <header className="mb-7 flex items-center gap-3">
        {icon && <div className="text-accent">{icon}</div>}
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-tight">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        </div>
        <div className="flex-1" />
        {actions}
      </header>
      {children}
    </div>
  );
}
