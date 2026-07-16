import type { ReactElement } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { TooltipProvider } from '../ui/Tooltip';
import { useBrowserStore } from '../../stores/browser.store';
import { useUiStore } from '../../stores/ui.store';
import { TitleBar } from './TitleBar';
import { Sidebar } from './Sidebar';
import { HorizontalTabStrip } from './HorizontalTabStrip';
import { Toolbar } from './Toolbar';
import { ContentArea } from './ContentArea';
import { Omnibox } from '../omnibox/Omnibox';
import { CommandPalette } from '../palette/CommandPalette';
import { TabSwitcher } from './TabSwitcher';
import { TabPreview } from './TabPreview';
import { SessionsDialog } from '../sessions/SessionsDialog';
import { AiSidebar } from '../ai/AiSidebar';

const PANEL_TRANSITION = { duration: 0.24, ease: [0.16, 1, 0.3, 1] as const };

/** The full browser chrome: titlebar, tabs, toolbar, content and all overlays. */
export function Chrome(): ReactElement {
  const layout = useBrowserStore((state) => state.settings?.behavior.defaultTabLayout ?? 'vertical');
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const aiOpen = useUiStore((state) => state.aiSidebarOpen);

  const aiPanel = (
    <AnimatePresence initial={false}>
      {aiOpen && (
        <motion.div
          key="ai"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 360, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={PANEL_TRANSITION}
          className="shrink-0 overflow-hidden"
        >
          <AiSidebar />
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <TooltipProvider delayDuration={400} skipDelayDuration={200}>
      <div className="relative flex h-full flex-col bg-bg text-text">
        <TitleBar />

        {layout === 'vertical' ? (
          <div className="flex min-h-0 flex-1">
            <AnimatePresence initial={false}>
              {!sidebarCollapsed && (
                <motion.div
                  key="sidebar"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 248, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={PANEL_TRANSITION}
                  className="shrink-0 overflow-hidden"
                >
                  <Sidebar />
                </motion.div>
              )}
            </AnimatePresence>
            <div className="relative flex min-w-0 flex-1 flex-col">
              <Toolbar />
              <div className="flex min-h-0 flex-1">
                <ContentArea />
                {aiPanel}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <HorizontalTabStrip />
            <Toolbar />
            <div className="flex min-h-0 flex-1">
              <ContentArea />
              {aiPanel}
            </div>
          </div>
        )}

        <Omnibox />
        <CommandPalette />
        <TabSwitcher />
        <TabPreview />
        <SessionsDialog />
      </div>
    </TooltipProvider>
  );
}
