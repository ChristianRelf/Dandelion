import type { ReactElement } from 'react';
import { PanelLeft, Sparkles } from 'lucide-react';
import { IconButton } from '../ui/IconButton';
import { Tooltip } from '../ui/Tooltip';
import { Icon } from '../ui/Icon';
import { useUiStore } from '../../stores/ui.store';
import { useActiveWorkspace } from '../../hooks/useBrowser';

/**
 * The custom, draggable title bar. Native window controls are provided by the
 * OS via `titleBarOverlay` (Windows/Linux) or traffic lights (macOS); this bar
 * fills the remaining space and hosts the sidebar toggle and workspace label.
 */
export function TitleBar(): ReactElement {
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const toggleAi = useUiStore((state) => state.toggleAiSidebar);
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const aiOpen = useUiStore((state) => state.aiSidebarOpen);
  const workspace = useActiveWorkspace();
  const isMac = window.dandelion?.platform.isMac ?? false;

  return (
    <header
      className="flex h-10 shrink-0 items-center gap-1 drag"
      style={{ paddingLeft: isMac ? 80 : 8, paddingRight: isMac ? 8 : 140 }}
    >
      <Tooltip content="Toggle sidebar" shortcut="⌃B">
        <IconButton
          onClick={toggleSidebar}
          active={!sidebarCollapsed}
          aria-label="Toggle sidebar"
          aria-pressed={!sidebarCollapsed}
        >
          <PanelLeft className="h-[18px] w-[18px]" />
        </IconButton>
      </Tooltip>

      <div className="flex items-center gap-1.5 px-1 text-[13px] font-medium text-muted">
        {workspace && <Icon name={workspace.icon} className="h-3.5 w-3.5" />}
        <span className="max-w-52 truncate">{workspace?.name ?? 'Dandelion'}</span>
      </div>

      <div className="flex-1" />

      <Tooltip content="AI assistant" shortcut="⌃/">
        <IconButton
          onClick={toggleAi}
          active={aiOpen}
          aria-label="Toggle AI assistant"
          aria-pressed={aiOpen}
        >
          <Sparkles className="h-[18px] w-[18px]" />
        </IconButton>
      </Tooltip>
    </header>
  );
}
