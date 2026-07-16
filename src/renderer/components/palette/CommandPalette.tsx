import { useEffect, type ReactElement } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Command } from 'cmdk';
import { COMMANDS, getCommand } from '@shared/constants';
import { prettifyUrl } from '@shared/utils';
import { Icon } from '../ui/Icon';
import { Kbd } from '../ui/Kbd';
import { Favicon } from '../ui/Favicon';
import { dispatchCommand } from '../../lib/commands';
import { trpc } from '../../lib/trpc/client';
import { useUiStore } from '../../stores/ui.store';
import { useOrderedTabs } from '../../hooks/useBrowser';

const paletteCommands = COMMANDS.filter((command) => command.palette);

function acceleratorLabel(action: string): string | null {
  const keys = getCommand(action)?.defaultKeys;
  return keys
    ? keys.replace('CmdOrCtrl', '⌘').replace('Shift', '⇧').replace('Alt', '⌥').replace(/\+/g, ' ')
    : null;
}

const itemClass =
  'flex cursor-default items-center gap-3 rounded-lg px-2.5 py-2 text-[13.5px] text-muted outline-none data-[selected=true]:bg-surface-active data-[selected=true]:text-text';

/** Raycast-style command palette (⌘K). */
export function CommandPalette(): ReactElement {
  const open = useUiStore((state) => state.paletteOpen);
  const close = useUiStore((state) => state.closePalette);
  const tabs = useOrderedTabs();

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && open) close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

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
            className="mt-[12vh] h-fit w-[600px] max-w-[92vw] overflow-hidden rounded-2xl border border-line shadow-[var(--shadow-glass)] glass"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <Command loop className="flex flex-col">
              <div className="border-b border-line px-4">
                <Command.Input
                  autoFocus
                  placeholder="Type a command or search…"
                  className="w-full bg-transparent py-3.5 text-[15px] text-text outline-none placeholder:text-faint"
                />
              </div>
              <Command.List className="scrollbar-slim max-h-[52vh] overflow-y-auto p-1.5">
                <Command.Empty className="px-3 py-6 text-center text-sm text-faint">
                  No matching commands.
                </Command.Empty>

                <Command.Group
                  heading="Commands"
                  className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-faint"
                >
                  {paletteCommands.map((command) => (
                    <Command.Item
                      key={command.id}
                      value={`${command.title} ${command.keywords?.join(' ') ?? ''}`}
                      keywords={command.keywords}
                      onSelect={() => {
                        dispatchCommand(command.id);
                        close();
                      }}
                      className={itemClass}
                    >
                      <Icon name={command.icon ?? 'command'} className="h-4 w-4 shrink-0" />
                      <span className="flex-1 truncate">{command.title}</span>
                      {acceleratorLabel(command.id) && <Kbd>{acceleratorLabel(command.id)}</Kbd>}
                    </Command.Item>
                  ))}
                </Command.Group>

                {tabs.length > 0 && (
                  <Command.Group
                    heading="Open Tabs"
                    className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-faint"
                  >
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
