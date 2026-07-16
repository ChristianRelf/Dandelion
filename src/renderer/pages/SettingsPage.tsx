import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  Cog,
  KeyboardIcon,
  MousePointerClick,
  Palette,
  Search,
  Shield,
  Sparkles,
  SquareStack,
} from 'lucide-react';
import type { SearchEngine, Settings, SettingsPatch } from '@shared/types';
import { COMMANDS, getCommand } from '@shared/constants';
import { PageShell } from './PageShell';
import { Switch } from '../components/ui/Switch';
import { Slider } from '../components/ui/Slider';
import { Kbd } from '../components/ui/Kbd';
import { trpc } from '../lib/trpc/client';
import { useBrowserStore } from '../stores/browser.store';

type Patch = (patch: SettingsPatch) => Promise<void>;

function Select<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}): ReactElement {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
      className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] text-text outline-none"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function Row({
  title,
  description,
  control,
  search,
}: {
  title: string;
  description?: string;
  control: ReactNode;
  search: string;
}): ReactElement | null {
  if (search && !`${title} ${description ?? ''}`.toLowerCase().includes(search.toLowerCase())) {
    return null;
  }
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="text-[13.5px] text-text">{title}</p>
        {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

function acceleratorFromEvent(event: KeyboardEvent): string | null {
  const parts: string[] = [];
  if (event.metaKey || event.ctrlKey) parts.push('CmdOrCtrl');
  if (event.shiftKey) parts.push('Shift');
  if (event.altKey) parts.push('Alt');
  const key = event.key;
  if (['Control', 'Meta', 'Shift', 'Alt'].includes(key)) return null;
  parts.push(key.length === 1 ? key.toUpperCase() : key);
  return parts.join('+');
}

const SECTIONS = [
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'behavior', label: 'Behaviour', icon: MousePointerClick },
  { id: 'tabs', label: 'Tabs', icon: SquareStack },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'privacy', label: 'Privacy & Security', icon: Shield },
  { id: 'ai', label: 'AI', icon: Sparkles },
  { id: 'shortcuts', label: 'Shortcuts', icon: KeyboardIcon },
] as const;

function SectionCard({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}): ReactElement {
  return (
    <section id={`section-${id}`} className="mb-8 scroll-mt-4">
      <h2 className="mb-2 px-1 text-[11px] font-semibold tracking-wide text-faint uppercase">
        {title}
      </h2>
      <div className="overflow-hidden rounded-xl border border-line bg-surface">{children}</div>
    </section>
  );
}

export function SettingsPage(): ReactElement {
  const settings = useBrowserStore((state) => state.settings);
  const patch = useBrowserStore((state) => state.patchSettings) as Patch;
  const [search, setSearch] = useState('');
  const [engines, setEngines] = useState<SearchEngine[]>([]);
  const [aiKey, setAiKey] = useState('');
  const [recording, setRecording] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void trpc.search.listEngines.query().then(setEngines);
  }, []);

  if (!settings)
    return (
      <PageShell title="Settings">
        <div />
      </PageShell>
    );
  const s: Settings = settings;

  const scrollTo = (id: string): void => {
    document
      .getElementById(`section-${id}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="flex h-full">
      <nav className="w-52 shrink-0 border-r border-line p-3">
        <div className="mb-3 flex items-center gap-2 px-2 text-[13px] font-medium">
          <Cog className="h-4 w-4 text-accent" /> Settings
        </div>
        {SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => scrollTo(section.id)}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] text-muted transition-colors hover:bg-surface-hover hover:text-text"
          >
            <section.icon className="h-4 w-4" />
            {section.label}
          </button>
        ))}
      </nav>

      <div ref={contentRef} className="scrollbar-slim min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-6 py-8">
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-line bg-surface px-3">
            <Search className="h-4 w-4 text-faint" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search settings"
              className="flex-1 bg-transparent py-2.5 text-sm text-text outline-none placeholder:text-faint"
            />
          </div>

          <SectionCard id="appearance" title="Appearance">
            <Row
              search={search}
              title="Theme"
              control={
                <Select
                  value={s.appearance.themeMode}
                  onChange={(value) => void patch({ appearance: { themeMode: value } })}
                  options={[
                    { value: 'system', label: 'System' },
                    { value: 'light', label: 'Light' },
                    { value: 'dark', label: 'Dark' },
                    { value: 'oled', label: 'OLED' },
                  ]}
                />
              }
            />
            <Row
              search={search}
              title="Accent colour"
              control={
                <input
                  type="color"
                  value={s.appearance.accentColor}
                  onChange={(event) =>
                    void patch({ appearance: { accentColor: event.target.value } })
                  }
                  className="h-7 w-12 cursor-pointer rounded border border-line bg-transparent"
                />
              }
            />
            <Row
              search={search}
              title="Match workspace accent"
              control={
                <Switch
                  checked={s.appearance.followWorkspaceAccent}
                  onCheckedChange={(value) =>
                    void patch({ appearance: { followWorkspaceAccent: value } })
                  }
                />
              }
            />
            <Row
              search={search}
              title="Transparency & glass"
              control={
                <Switch
                  checked={s.appearance.transparency}
                  onCheckedChange={(value) => void patch({ appearance: { transparency: value } })}
                />
              }
            />
            <Row
              search={search}
              title="Blur intensity"
              control={
                <Slider
                  value={s.appearance.blurIntensity}
                  min={0}
                  max={100}
                  onValueChange={(value) => void patch({ appearance: { blurIntensity: value } })}
                />
              }
            />
            <Row
              search={search}
              title="Corner radius"
              control={
                <Slider
                  value={s.appearance.cornerRadius}
                  min={0}
                  max={24}
                  onValueChange={(value) => void patch({ appearance: { cornerRadius: value } })}
                />
              }
            />
            <Row
              search={search}
              title="Interface scale"
              control={
                <Slider
                  value={Math.round(s.appearance.uiScale * 100)}
                  min={80}
                  max={140}
                  step={5}
                  onValueChange={(value) => void patch({ appearance: { uiScale: value / 100 } })}
                />
              }
            />
            <Row
              search={search}
              title="Density"
              control={
                <Select
                  value={s.appearance.density}
                  onChange={(value) => void patch({ appearance: { density: value } })}
                  options={[
                    { value: 'comfortable', label: 'Comfortable' },
                    { value: 'compact', label: 'Compact' },
                  ]}
                />
              }
            />
            <Row
              search={search}
              title="Reduce motion"
              control={
                <Switch
                  checked={s.appearance.reduceMotion}
                  onCheckedChange={(value) => void patch({ appearance: { reduceMotion: value } })}
                />
              }
            />
            <Row
              search={search}
              title="Tab hover thumbnails"
              control={
                <Switch
                  checked={s.appearance.showTabThumbnails}
                  onCheckedChange={(value) =>
                    void patch({ appearance: { showTabThumbnails: value } })
                  }
                />
              }
            />
          </SectionCard>

          <SectionCard id="behavior" title="Behaviour">
            <Row
              search={search}
              title="On startup"
              control={
                <Select
                  value={s.behavior.restoreSession}
                  onChange={(value) => void patch({ behavior: { restoreSession: value } })}
                  options={[
                    { value: 'ask', label: 'Ask' },
                    { value: 'always', label: 'Restore tabs' },
                    { value: 'never', label: 'Fresh start' },
                  ]}
                />
              }
            />
            <Row
              search={search}
              title="Tab layout"
              control={
                <Select
                  value={s.behavior.defaultTabLayout}
                  onChange={(value) => void patch({ behavior: { defaultTabLayout: value } })}
                  options={[
                    { value: 'vertical', label: 'Vertical' },
                    { value: 'horizontal', label: 'Horizontal' },
                  ]}
                />
              }
            />
            <Row
              search={search}
              title="Ask where to save downloads"
              control={
                <Switch
                  checked={s.behavior.askWhereToSaveDownloads}
                  onCheckedChange={(value) =>
                    void patch({ behavior: { askWhereToSaveDownloads: value } })
                  }
                />
              }
            />
            <Row
              search={search}
              title="Confirm closing multiple tabs"
              control={
                <Switch
                  checked={s.behavior.confirmCloseMultipleTabs}
                  onCheckedChange={(value) =>
                    void patch({ behavior: { confirmCloseMultipleTabs: value } })
                  }
                />
              }
            />
            <Row
              search={search}
              title="Warn when quitting with open tabs"
              control={
                <Switch
                  checked={s.behavior.warnOnQuitWithTabs}
                  onCheckedChange={(value) =>
                    void patch({ behavior: { warnOnQuitWithTabs: value } })
                  }
                />
              }
            />
          </SectionCard>

          <SectionCard id="tabs" title="Tabs">
            <Row
              search={search}
              title="Sleep inactive tabs"
              description="Free memory from tabs you haven't used"
              control={
                <Switch
                  checked={s.tabs.sleepEnabled}
                  onCheckedChange={(value) => void patch({ tabs: { sleepEnabled: value } })}
                />
              }
            />
            <Row
              search={search}
              title="Sleep after (minutes)"
              control={
                <Slider
                  value={s.tabs.sleepAfterMinutes}
                  min={5}
                  max={120}
                  step={5}
                  onValueChange={(value) => void patch({ tabs: { sleepAfterMinutes: value } })}
                />
              }
            />
            <Row
              search={search}
              title="Sleep pinned tabs"
              control={
                <Switch
                  checked={s.tabs.sleepPinnedTabs}
                  onCheckedChange={(value) => void patch({ tabs: { sleepPinnedTabs: value } })}
                />
              }
            />
            <Row
              search={search}
              title="Hover previews"
              control={
                <Switch
                  checked={s.tabs.hoverPreview}
                  onCheckedChange={(value) => void patch({ tabs: { hoverPreview: value } })}
                />
              }
            />
          </SectionCard>

          <SectionCard id="search" title="Search">
            <Row
              search={search}
              title="Default search engine"
              control={
                <Select
                  value={s.search.defaultEngineId}
                  onChange={(value) => {
                    void trpc.search.setDefault.mutate({ engineId: value });
                    void patch({ search: { defaultEngineId: value } });
                  }}
                  options={engines.map((engine) => ({ value: engine.id, label: engine.name }))}
                />
              }
            />
            <Row
              search={search}
              title="Search suggestions"
              control={
                <Switch
                  checked={s.search.searchSuggestions}
                  onCheckedChange={(value) => void patch({ search: { searchSuggestions: value } })}
                />
              }
            />
            <Row
              search={search}
              title="History suggestions"
              control={
                <Switch
                  checked={s.search.showHistorySuggestions}
                  onCheckedChange={(value) =>
                    void patch({ search: { showHistorySuggestions: value } })
                  }
                />
              }
            />
            <Row
              search={search}
              title="Bookmark suggestions"
              control={
                <Switch
                  checked={s.search.showBookmarkSuggestions}
                  onCheckedChange={(value) =>
                    void patch({ search: { showBookmarkSuggestions: value } })
                  }
                />
              }
            />
            <Row
              search={search}
              title="Calculator in address bar"
              control={
                <Switch
                  checked={s.search.enableCalculator}
                  onCheckedChange={(value) => void patch({ search: { enableCalculator: value } })}
                />
              }
            />
            <Row
              search={search}
              title="Unit conversion"
              control={
                <Switch
                  checked={s.search.enableUnitConversion}
                  onCheckedChange={(value) =>
                    void patch({ search: { enableUnitConversion: value } })
                  }
                />
              }
            />
            <Row
              search={search}
              title="Inline autocomplete"
              control={
                <Switch
                  checked={s.search.inlineAutocomplete}
                  onCheckedChange={(value) => void patch({ search: { inlineAutocomplete: value } })}
                />
              }
            />
          </SectionCard>

          <SectionCard id="privacy" title="Privacy & Security">
            <Row
              search={search}
              title="Block ads"
              control={
                <Switch
                  checked={s.privacy.blockAds}
                  onCheckedChange={(value) => void patch({ privacy: { blockAds: value } })}
                />
              }
            />
            <Row
              search={search}
              title="Block trackers"
              control={
                <Switch
                  checked={s.privacy.blockTrackers}
                  onCheckedChange={(value) => void patch({ privacy: { blockTrackers: value } })}
                />
              }
            />
            <Row
              search={search}
              title="Block fingerprinting"
              control={
                <Switch
                  checked={s.privacy.blockFingerprinting}
                  onCheckedChange={(value) =>
                    void patch({ privacy: { blockFingerprinting: value } })
                  }
                />
              }
            />
            <Row
              search={search}
              title="Block third-party cookies"
              control={
                <Switch
                  checked={s.privacy.blockThirdPartyCookies}
                  onCheckedChange={(value) =>
                    void patch({ privacy: { blockThirdPartyCookies: value } })
                  }
                />
              }
            />
            <Row
              search={search}
              title="Upgrade to HTTPS"
              control={
                <Switch
                  checked={s.privacy.httpsUpgrade}
                  onCheckedChange={(value) => void patch({ privacy: { httpsUpgrade: value } })}
                />
              }
            />
            <Row
              search={search}
              title="Send Do Not Track"
              control={
                <Switch
                  checked={s.privacy.doNotTrack}
                  onCheckedChange={(value) => void patch({ privacy: { doNotTrack: value } })}
                />
              }
            />
            <Row
              search={search}
              title="Global Privacy Control"
              control={
                <Switch
                  checked={s.privacy.globalPrivacyControl}
                  onCheckedChange={(value) =>
                    void patch({ privacy: { globalPrivacyControl: value } })
                  }
                />
              }
            />
            <Row
              search={search}
              title="Secure DNS (DoH)"
              control={
                <Switch
                  checked={s.privacy.secureDns.enabled}
                  onCheckedChange={(value) =>
                    void patch({
                      privacy: { secureDns: { ...s.privacy.secureDns, enabled: value } },
                    })
                  }
                />
              }
            />
            <Row
              search={search}
              title="Safe Browsing"
              control={
                <Switch
                  checked={s.security.safeBrowsing}
                  onCheckedChange={(value) => void patch({ security: { safeBrowsing: value } })}
                />
              }
            />
            <Row
              search={search}
              title="Scan downloads"
              control={
                <Switch
                  checked={s.security.scanDownloads}
                  onCheckedChange={(value) => void patch({ security: { scanDownloads: value } })}
                />
              }
            />
            <Row
              search={search}
              title="Site isolation"
              control={
                <Switch
                  checked={s.security.isolateSites}
                  onCheckedChange={(value) => void patch({ security: { isolateSites: value } })}
                />
              }
            />
          </SectionCard>

          <SectionCard id="ai" title="AI">
            <Row
              search={search}
              title="Enable AI features"
              control={
                <Switch
                  checked={s.ai.enabled}
                  onCheckedChange={(value) => void patch({ ai: { enabled: value } })}
                />
              }
            />
            <Row
              search={search}
              title="Provider"
              control={
                <Select
                  value={s.ai.defaultProvider}
                  onChange={(value) => void patch({ ai: { defaultProvider: value } })}
                  options={[
                    { value: 'anthropic', label: 'Anthropic' },
                    { value: 'openai', label: 'OpenAI' },
                    { value: 'google', label: 'Google Gemini' },
                    { value: 'local', label: 'Local model' },
                  ]}
                />
              }
            />
            <Row
              search={search}
              title="API key"
              description="Stored encrypted with the OS keychain"
              control={
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={aiKey}
                    onChange={(event) => setAiKey(event.target.value)}
                    placeholder="sk-…"
                    className="w-40 rounded-lg border border-line bg-bg-elevated px-2.5 py-1.5 text-[13px] text-text outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      void trpc.ai.configure.mutate({
                        providerId: s.ai.defaultProvider,
                        apiKey: aiKey,
                      });
                      setAiKey('');
                    }}
                    className="rounded-lg bg-accent px-3 text-[13px] font-medium text-accent-fg"
                  >
                    Save
                  </button>
                </div>
              }
            />
            <Row
              search={search}
              title="Stream responses"
              control={
                <Switch
                  checked={s.ai.streamResponses}
                  onCheckedChange={(value) => void patch({ ai: { streamResponses: value } })}
                />
              }
            />
          </SectionCard>

          <SectionCard id="shortcuts" title="Keyboard Shortcuts">
            {COMMANDS.filter((command) => command.defaultKeys).map((command) => {
              const binding = s.shortcuts.find((entry) => entry.action === command.id);
              const isRecording = recording === command.id;
              return (
                <Row
                  key={command.id}
                  search={search}
                  title={command.title}
                  control={
                    <button
                      type="button"
                      onClick={() => setRecording(command.id)}
                      onKeyDown={(event) => {
                        if (!isRecording) return;
                        event.preventDefault();
                        const accelerator = acceleratorFromEvent(event);
                        if (accelerator) {
                          void trpc.settings.setShortcut
                            .mutate({ action: command.id, keys: accelerator, enabled: true })
                            .then((next) => useBrowserStore.setState({ settings: next }));
                          setRecording(null);
                        }
                      }}
                      className="min-w-24 rounded-lg border border-line bg-surface px-2 py-1 text-center outline-none focus:border-accent"
                    >
                      {isRecording ? (
                        <span className="text-xs text-accent">Press keys…</span>
                      ) : (
                        <Kbd>
                          {(binding?.keys ?? getCommand(command.id)?.defaultKeys ?? '')
                            .replace('CmdOrCtrl', '⌘')
                            .replace(/\+/g, ' ')}
                        </Kbd>
                      )}
                    </button>
                  }
                />
              );
            })}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
