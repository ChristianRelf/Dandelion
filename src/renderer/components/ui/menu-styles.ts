/**
 * Shared class strings for Radix dropdown and context menus, so click-menus and
 * right-click menus are visually identical everywhere they appear.
 */
export const menuContentClass =
  'animate-pop z-[90] min-w-48 rounded-xl border border-line p-1 shadow-[var(--shadow-lg)] glass-strong';

export const menuItemClass =
  'flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] text-text outline-none select-none transition-colors data-[highlighted]:bg-surface-hover data-[disabled]:pointer-events-none data-[disabled]:opacity-40';

export const menuItemDangerClass =
  'flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] text-danger outline-none select-none transition-colors data-[highlighted]:bg-danger-soft data-[disabled]:pointer-events-none data-[disabled]:opacity-40';

export const menuSeparatorClass = 'my-1 h-px bg-line';

export const menuLabelClass =
  'px-2.5 pt-1.5 pb-1 text-[11px] font-semibold tracking-wide text-faint uppercase select-none';

export const menuShortcutClass = 'ml-auto pl-4 text-[11px] tracking-wide text-faint';
