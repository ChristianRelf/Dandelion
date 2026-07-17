import { useState, type ReactElement, type RefObject } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Command } from 'cmdk';
import { acceleratorLabel, COMMANDS } from '@shared/constants';
import { prettifyUrl } from '@shared/utils';
import { Icon } from '../ui/Icon';
import { Kbd } from '../ui/Kbd';
import { Favicon } from '../ui/Favicon';
import { EmptyState } from '../ui/EmptyState';
import { dispatchCommand } from '../../lib/commands';
import { trpc } from '../../lib/trpc/client';
import { useShallow } from 'zustand/react/shallow';
import { useUiStore } from '../../stores/ui.store';
import { useBrowserStore } from '../../stores/browser.store';
import { useOrderedTabs } from '../../hooks/useBrowser';
import { useModalOverlay } from '../../hooks/useModalOverlay';

const paletteCommands = COMMANDS.filter((command) => command.palette);

const groupHeading =
  '[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-faint [&_[cmdk-group-heading]]:uppercase';

const itemClass =
  'flex cursor-default items-center gap-3 rounded-lg px-2.5 py-2 text-[13.5px] text-muted outline-none data-[selected=true]:bg-surface-active data-[selected=true]:text-text';

interface PaletteBodyProps {
  close: () => void;
  /** Focused by `useModalOverlay` once it has recorded what focus came from. */
  fieldRef: RefObject<HTMLInputElement | null>;
}

/** Palette body — only mounted while open, so the tab list isn't computed when closed. */
function PaletteBody({ close, fieldRef }: PaletteBodyProps): ReactElement {
  const tabs = useOrderedTabs();
  const workspaces = useBrowserStore(useShallow((state) => state.workspaces));
  const activeWorkspaceId = useBrowserStore((state) => state.activeWorkspaceId);
  const switchWorkspace = useBrowserStore((state) => state.switchWorkspace);
  // The body only mounts while open, so the seed is the initial value of a
  // normal controlled input rather than something to sync.
  const [query, setQuery] = useState(() => useUiStore.getState().paletteInitialQuery);

  return (
    <Command loop className="flex flex-col">
      <div className="border-b border-line px-4">
        <Command.Input
          ref={fieldRef}
          value={query}
          onValueChange={setQuery}
          placeholder="Type a command or search…"
          className="w-full bg-transparent py-3.5 text-[15px] text-text outline-none placeholder:text-faint"
        />
      </div>
      <Command.List className="scrollbar-slim max-h-[52vh] overflow-y-auto p-1.5">
        <Command.Empty>
          <EmptyState compact icon="search-x" title="No matching commands" />
        </Command.Empty>

        <Command.Group heading="Commands" className={groupHeading}>
          {paletteCommands.map((command) => {
            const accelerator = acceleratorLabel(command.id);
            return (
              <Command.Item
                key={command.id}
                value={`${command.title} ${command.keywords?.join(' ') ?? ''}`}
                // Close first: a command may open something, and closing after
                // would undo it. `workspace.switcher` re-opens the palette
                // seeded, and dispatching first made it close itself.
                onSelect={() => {
                  close();
                  dispatchCommand(command.id);
                }}
                className={itemClass}
              >
                <Icon name={command.icon ?? 'command'} className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{command.title}</span>
                {accelerator && <Kbd>{accelerator}</Kbd>}
              </Command.Item>
            );
          })}
        </Command.Group>

        {workspaces.length > 1 && (
          <Command.Group heading="Workspaces" className={groupHeading}>
            {workspaces.map((workspace) => (
              <Command.Item
                key={workspace.id}
                value={`workspace space ${workspace.name}`}
                onSelect={() => {
                  void switchWorkspace(workspace.id);
                  close();
                }}
                className={itemClass}
              >
                <Icon name={workspace.icon || 'layers'} className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{workspace.name}</span>
                {workspace.id === activeWorkspaceId && (
                  <span className="text-xs text-faint">Current</span>
                )}
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {tabs.length > 0 && (
          <Command.Group heading="Open Tabs" className={groupHeading}>
            {tabs.map((tab) => (
              <Command.Item
                key={tab.id}
                value={`tab ${tab.title} ${tab.url}`}
                onSelect={() => {
                  void trpc.tabs.activate.mutate({ tabId: tab.id });
                  close();
                }}
                className={itemClass}
              >
                <Favicon src={tab.favicon} className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{tab.title || prettifyUrl(tab.url)}</span>
                <span className="truncate text-xs text-faint">{prettifyUrl(tab.url)}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}
      </Command.List>
    </Command>
  );
}

/** Raycast-style command palette (⌘K). */
export function CommandPalette(): ReactElement {
  const open = useUiStore((state) => state.paletteOpen);
  const close = useUiStore((state) => state.closePalette);
  const field = useModalOverlay(open, close);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[65] flex justify-center bg-black/40 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          onMouseDown={close}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            className="mt-[12vh] h-fit w-[600px] max-w-[92vw] overflow-hidden rounded-2xl border border-line shadow-[var(--shadow-lg)] glass-strong"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <PaletteBody close={close} fieldRef={field} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
