import type { ReactElement, ReactNode } from 'react';
import * as RadixTooltip from '@radix-ui/react-tooltip';

// eslint-disable-next-line react-refresh/only-export-components
export const TooltipProvider = RadixTooltip.Provider;

interface TooltipProps {
  content: ReactNode;
  children: ReactElement;
  side?: 'top' | 'bottom' | 'left' | 'right';
  shortcut?: string;
}

/**
 * `side` defaults to `top` because the toolbar sits directly above the content
 * region, and that region belongs to a native `WebContentsView` stacked above
 * this renderer — a tooltip dropping into it is painted over by the page and
 * cannot be seen on any real site. Opening upward keeps it inside the chrome,
 * and Radix flips it back down where there is no room above (the title bar), so
 * the safe placement is also the default a new toolbar button inherits.
 *
 * Overlays large enough to be worth hosting in the floating surface go through
 * `PopupHost` instead; a tooltip is not worth an IPC round trip per hover.
 */
export function Tooltip({ content, children, side = 'top', shortcut }: TooltipProps) {
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          sideOffset={6}
          className="z-[80] flex items-center gap-2 rounded-md border border-line px-2 py-1 text-xs text-text shadow-[var(--shadow-glass)] glass select-none"
        >
          {content}
          {shortcut && <span className="text-faint">{shortcut}</span>}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
