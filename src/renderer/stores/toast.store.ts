import { create } from 'zustand';

export type ToastVariant = 'default' | 'success' | 'error';

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  /** Kebab-case Lucide icon; defaults per variant when omitted. */
  icon?: string;
  /** Auto-dismiss delay in ms. `0` keeps the toast until dismissed. */
  duration: number;
}

interface ToastInput {
  description?: string;
  icon?: string;
  duration?: number;
}

interface ToastStore {
  toasts: ToastItem[];
  push: (toast: Omit<ToastItem, 'id'>) => string;
  dismiss: (id: string) => void;
}

let counter = 0;
function nextId(): string {
  counter += 1;
  return `toast_${counter}`;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (toast) => {
    const id = nextId();
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    return id;
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));

function show(variant: ToastVariant, title: string, options?: ToastInput): string {
  return useToastStore.getState().push({
    variant,
    title,
    description: options?.description,
    icon: options?.icon,
    duration: options?.duration ?? (variant === 'error' ? 6000 : 3500),
  });
}

/**
 * Fire-and-forget toast notifications. Callable from anywhere (event handlers,
 * effects, stores) without a hook — the viewport subscribes to the store.
 */
export const toast = {
  show: (title: string, options?: ToastInput) => show('default', title, options),
  success: (title: string, options?: ToastInput) => show('success', title, options),
  error: (title: string, options?: ToastInput) => show('error', title, options),
  dismiss: (id: string) => useToastStore.getState().dismiss(id),
};
