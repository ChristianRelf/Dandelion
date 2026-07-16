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

export function Tooltip({ content, children, side = 'bottom', shortcut }: TooltipProps) {
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
