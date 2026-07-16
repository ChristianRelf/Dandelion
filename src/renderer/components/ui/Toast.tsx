import { useEffect, type ReactElement } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { useToastStore, type ToastItem, type ToastVariant } from '../../stores/toast.store';
import { Icon } from './Icon';

const VARIANT_ICON: Record<ToastVariant, string> = {
  default: 'info',
  success: 'circle-check',
  error: 'circle-alert',
};

const VARIANT_ACCENT: Record<ToastVariant, string> = {
  default: 'text-accent',
  success: 'text-success',
  error: 'text-danger',
};

function ToastCard({ toast }: { toast: ToastItem }): ReactElement {
  const dismiss = useToastStore((state) => state.dismiss);

  useEffect(() => {
    if (toast.duration <= 0) return;
    const timer = setTimeout(() => dismiss(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, dismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 460, damping: 34 }}
      role="status"
      aria-live="polite"
      className="pointer-events-auto flex w-80 items-start gap-3 rounded-xl border border-line p-3 shadow-[var(--shadow-lg)] glass-strong"
    >
      <Icon
        name={toast.icon ?? VARIANT_ICON[toast.variant]}
        className={`mt-0.5 h-[18px] w-[18px] shrink-0 ${VARIANT_ACCENT[toast.variant]}`}
      />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-text">{toast.title}</p>
        {toast.description && (
          <p className="mt-0.5 text-xs leading-relaxed text-muted">{toast.description}</p>
        )}
      </div>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => dismiss(toast.id)}
        className="-m-1 rounded-md p-1 text-faint transition-colors hover:bg-surface-hover hover:text-text"
      >
        <X className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
    </motion.div>
  );
}

/** Renders the live toast stack. Mount once near the app root. */
export function ToastViewport(): ReactElement {
  const toasts = useToastStore((state) => state.toasts);
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[120] flex flex-col items-end gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>
    </div>
  );
}
