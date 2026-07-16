import { forwardRef, type ReactElement } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '../../lib/cn';

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  'aria-label'?: string;
}

/** The shared search input: leading icon, clear button, and a focus ring. */
export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  { value, onChange, placeholder = 'Search', autoFocus, className, 'aria-label': ariaLabel },
  ref,
): ReactElement {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-xl border border-line bg-surface px-3 transition-colors',
        'focus-within:border-accent focus-within:bg-bg-elevated',
        className,
      )}
    >
      <Search className="h-4 w-4 shrink-0 text-faint" />
      <input
        ref={ref}
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        spellCheck={false}
        className="h-[var(--field-height)] min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-faint"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="-mr-1 rounded-md p-1 text-faint transition-colors hover:bg-surface-hover hover:text-text"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
});
