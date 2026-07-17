import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { motion } from 'motion/react';
import type {
  AiProviderId,
  CommandDescriptor,
  SearchEngine,
  Settings,
  SettingsPatch,
} from '@shared/types';
import { COMMANDS, DEFAULT_GESTURES, GESTURABLE_COMMANDS, INTERNAL_PAGES } from '@shared/constants';
import {
  gestureLabel,
  looksLikeUrl,
  normalizeUrl,
  recognizeGesture,
  type GesturePoint,
} from '@shared/utils';
import { Switch } from '../components/ui/Switch';
import { Slider } from '../components/ui/Slider';
import { Select } from '../components/ui/Select';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { SearchField } from '../components/ui/SearchField';
import { Button } from '../components/ui/Button';
import { Kbd } from '../components/ui/Kbd';
import { Icon } from '../components/ui/Icon';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Skeleton } from '../components/ui/Skeleton';
import { toast } from '../stores/toast.store';
import { trpc } from '../lib/trpc/client';
import { useBrowserStore } from '../stores/browser.store';
import { cn } from '../lib/cn';

type PatchFn = (patch: SettingsPatch) => Promise<void>;

interface RowDef {
  title: string;
  description?: string;
  /** Extra terms folded into search matching but never displayed. */
  keywords?: string;
  control: ReactNode;
}

interface SectionDef {
  id: string;
  label: string;
  icon: string;
  rows: RowDef[];
}

const SECTIONS_META = [
  { id: 'appearance', label: 'Appearance', icon: 'palette' },
  { id: 'behavior', label: 'Behaviour', icon: 'mouse-pointer-click' },
  { id: 'tabs', label: 'Tabs', icon: 'square-stack' },
  { id: 'search', label: 'Search', icon: 'search' },
  { id: 'privacy', label: 'Privacy & Security', icon: 'shield' },
  { id: 'ai', label: 'AI', icon: 'sparkles' },
  { id: 'gestures', label: 'Mouse Gestures', icon: 'pointer' },
  { id: 'shortcuts', label: 'Keyboard Shortcuts', icon: 'keyboard' },
] as const;

const ACCENT_PRESETS = [
  '#f5c451',
  '#f59e0b',
  '#ef4444',
  '#ec4899',
  '#a855f7',
  '#3b82f6',
  '#14b8a6',
  '#22c55e',
];

const KEY_SYMBOLS: Record<string, string> = {
  CmdOrCtrl: '⌘',
  Control: 'Ctrl',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Backslash: '\\',
  Plus: '+',
  Minus: '−',
  Comma: ',',
  Escape: 'Esc',
  Delete: 'Del',
};

/** Split an accelerator like `CmdOrCtrl+Shift+T` into display-ready key chips. */
function displayTokens(keys: string): string[] {
  if (!keys) return [];
  return keys.split('+').map((token) => KEY_SYMBOLS[token] ?? token);
}

/** Build an Electron-style accelerator from a keyboard event, or `null`. */
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

function rowMatches(row: RowDef, query: string): boolean {
  return `${row.title} ${row.description ?? ''} ${row.keywords ?? ''}`
    .toLowerCase()
    .includes(query);
}

/** A boolean row backed by a Switch. */
function toggleRow(
  title: string,
  checked: boolean,
  onCheckedChange: (value: boolean) => void,
  extra?: { description?: string; keywords?: string },
): RowDef {
  return {
    title,
    description: extra?.description,
    keywords: extra?.keywords,
    // The row's title is the switch's name. It is only rendered as adjacent
    // text, which a screen reader will not read as the control's label.
    control: <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={title} />,
  };
}

/** A numeric row backed by a Slider with a live formatted read-out. */
function sliderRow(
  title: string,
  value: number,
  min: number,
  max: number,
  onValueChange: (value: number) => void,
  format: (value: number) => string,
  extra?: { step?: number; description?: string; keywords?: string },
): RowDef {
  return {
    title,
    description: extra?.description,
    keywords: extra?.keywords,
    control: (
      <div className="flex items-center gap-3">
        <Slider
          value={value}
          min={min}
          max={max}
          step={extra?.step ?? 1}
          onValueChange={onValueChange}
          aria-label={title}
          // The same string the read-out shows: "30 min" carries the unit that
          // a bare "30" drops.
          valueText={format(value)}
        />
        <span aria-hidden className="w-16 shrink-0 text-right text-xs text-muted tabular-nums">
          {format(value)}
        </span>
      </div>
    ),
  };
}

function SettingsRow({ row }: { row: RowDef }): ReactElement {
  return (
    <div
      style={{ paddingBlock: 'var(--row-py)' }}
      className="flex items-center justify-between gap-4 border-b border-line px-4 last:border-b-0"
    >
      <div className="min-w-0">
        <p className="text-[13.5px] leading-snug text-text">{row.title}</p>
        {row.description && (
          <p className="mt-0.5 text-xs leading-relaxed text-muted">{row.description}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center justify-end">{row.control}</div>
    </div>
  );
}

function SettingsSection({ section }: { section: SectionDef }): ReactElement {
  return (
    <section id={`section-${section.id}`} data-section-id={section.id} className="scroll-mt-20">
      <div className="mb-2.5 flex items-center gap-2 px-1">
        <Icon name={section.icon} className="h-4 w-4 text-faint" strokeWidth={2} />
        <h2 className="text-[13px] font-semibold tracking-tight text-text">{section.label}</h2>
      </div>
      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-sm)]">
        {section.rows.map((row) => (
          <SettingsRow key={row.title} row={row} />
        ))}
      </div>
    </section>
  );
}

function AccentPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}): ReactElement {
  const current = value.toLowerCase();
  return (
    <div className="flex items-center gap-1.5">
      {ACCENT_PRESETS.map((color) => {
        const active = current === color;
        return (
          <button
            key={color}
            type="button"
            aria-label={`Accent colour ${color}`}
            aria-pressed={active}
            onClick={() => onChange(color)}
            style={{ backgroundColor: color }}
            className={cn(
              'h-5 w-5 rounded-full transition-transform hover:scale-110',
              active
                ? 'shadow-[0_0_0_2px_var(--bg-elevated),0_0_0_4px_var(--text)]'
                : 'shadow-[inset_0_0_0_1px_rgba(0,0,0,0.14)]',
            )}
          />
        );
      })}
      <label
        title="Custom colour"
        className="relative ml-0.5 inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line bg-surface text-muted transition-colors focus-within:ring-2 focus-within:ring-accent hover:bg-surface-hover hover:text-text"
      >
        <Icon name="plus" className="h-3.5 w-3.5" strokeWidth={2} />
        <input
          type="color"
          aria-label="Custom accent colour"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
    </div>
  );
}

function ShortcutRow({
  command,
  keys,
  onSet,
}: {
  command: CommandDescriptor;
  keys: string;
  onSet: (keys: string) => void;
}): ReactElement {
  const [recording, setRecording] = useState(false);
  const defaultKeys = command.defaultKeys ?? '';
  const isCustom = keys !== defaultKeys;

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (!recording) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'Escape') {
      setRecording(false);
      return;
    }
    const accelerator = acceleratorFromEvent(event);
    if (accelerator) {
      onSet(accelerator);
      setRecording(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      {isCustom && !recording && (
        <Button variant="ghost" size="sm" onClick={() => onSet(defaultKeys)}>
          Reset
        </Button>
      )}
      <button
        type="button"
        onClick={() => setRecording(true)}
        onKeyDown={handleKeyDown}
        onBlur={() => setRecording(false)}
        aria-label={
          recording
            ? `Recording shortcut for ${command.title}. Press keys, or Escape to cancel.`
            : `Change the shortcut for ${command.title}`
        }
        className={cn(
          'inline-flex h-8 min-w-[112px] items-center justify-center gap-1 rounded-lg px-2.5',
          'transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent',
          recording ? 'bg-accent-soft ring-1 ring-accent' : 'bg-surface hover:bg-surface-hover',
        )}
      >
        {recording ? (
          <span className="text-xs font-medium text-accent">Press keys…</span>
        ) : (
          displayTokens(keys).map((token, index) => <Kbd key={`${token}-${index}`}>{token}</Kbd>)
        )}
      </button>
    </div>
  );
}

/**
 * Records a stroke by having the user draw one.
 *
 * The pad runs the *same* `recognizeGesture` the main process runs on page
 * input, so what is drawn here and what is drawn on a page cannot disagree —
 * the editor cannot advertise a stroke the recogniser would read differently.
 */
function GestureRow({
  command,
  gesture,
  onSet,
}: {
  command: CommandDescriptor;
  gesture: string;
  onSet: (gesture: string) => void;
}): ReactElement {
  const [recording, setRecording] = useState(false);
  const points = useRef<GesturePoint[]>([]);
  const defaultGesture = DEFAULT_GESTURES.find((entry) => entry.action === command.id)?.gesture ?? '';
  const isCustom = gesture !== defaultGesture;

  const finish = (): void => {
    const drawn = recognizeGesture(points.current);
    points.current = [];
    setRecording(false);
    // An accidental click is the empty stroke; keep what was there rather than
    // silently unbinding.
    if (drawn) onSet(drawn);
  };

  return (
    <div className="flex items-center gap-1.5">
      {isCustom && !recording && (
        <Button variant="ghost" size="sm" onClick={() => onSet(defaultGesture)}>
          Reset
        </Button>
      )}
      {gesture && !recording && (
        <Button variant="ghost" size="sm" onClick={() => onSet('')}>
          Clear
        </Button>
      )}
      <button
        type="button"
        onPointerDown={(event) => {
          setRecording(true);
          points.current = [{ x: event.clientX, y: event.clientY }];
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (recording) points.current.push({ x: event.clientX, y: event.clientY });
        }}
        onPointerUp={finish}
        onPointerCancel={() => {
          points.current = [];
          setRecording(false);
        }}
        aria-label={
          recording
            ? `Recording a gesture for ${command.title}. Drag to draw it.`
            : `Change the gesture for ${command.title}`
        }
        className={cn(
          'inline-flex h-8 min-w-[112px] items-center justify-center gap-1 rounded-lg px-2.5 text-sm',
          'transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent',
          recording ? 'bg-accent-soft ring-1 ring-accent' : 'bg-surface hover:bg-surface-hover',
        )}
      >
        {recording ? (
          <span className="text-xs font-medium text-accent">Draw it…</span>
        ) : gesture ? (
          <span className="tracking-widest text-text">{gestureLabel(gesture)}</span>
        ) : (
          <span className="text-xs text-faint">Unassigned</span>
        )}
      </button>
    </div>
  );
}

function SettingsSkeleton(): ReactElement {
  return (
    <div className="flex h-full bg-bg text-text">
      <nav className="flex w-56 shrink-0 flex-col gap-1.5 border-r border-line px-3 py-4">
        <div className="mb-3 flex items-center gap-2.5 px-2">
          <Skeleton className="h-7 w-7 rounded-lg" />
          <Skeleton className="h-4 w-20" />
        </div>
        {Array.from({ length: 7 }).map((_, index) => (
          <Skeleton key={index} className="h-9 w-full rounded-lg" />
        ))}
      </nav>
      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="mx-auto max-w-2xl px-6 pt-8">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="mt-2 h-4 w-72" />
          <Skeleton className="mt-6 h-[38px] w-full rounded-xl" />
          <div className="mt-8 space-y-8">
            {Array.from({ length: 2 }).map((_, section) => (
              <div key={section}>
                <Skeleton className="mb-2.5 h-4 w-28" />
                <div className="space-y-4 rounded-2xl border border-line bg-surface p-4">
                  {Array.from({ length: 4 }).map((_, row) => (
                    <div key={row} className="flex items-center justify-between gap-4">
                      <div className="space-y-1.5">
                        <Skeleton className="h-3.5 w-40" />
                        <Skeleton className="h-3 w-56" />
                      </div>
                      <Skeleton className="h-[22px] w-[38px] rounded-full" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsBody({ settings, patch }: { settings: Settings; patch: PatchFn }): ReactElement {
  const s = settings;
  const [search, setSearch] = useState('');
  const [engines, setEngines] = useState<SearchEngine[]>([]);
  const [aiKey, setAiKey] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [homePage, setHomePage] = useState(s.behavior.homePage);
  const [confirmReset, setConfirmReset] = useState(false);
  const [activeSection, setActiveSection] = useState<string>(SECTIONS_META[0].id);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void trpc.search.listEngines.query().then(setEngines);
  }, []);

  // The field is uncontrolled between commits, so it must resync when the value
  // changes elsewhere — resetting all settings is the case that bites.
  useEffect(() => setHomePage(s.behavior.homePage), [s.behavior.homePage]);

  /** Committed on blur/Enter rather than per keystroke — each patch is an IPC round-trip. */
  const commitHomePage = async (): Promise<void> => {
    const raw = homePage.trim();
    if (raw && !looksLikeUrl(raw)) {
      toast.error('Home page must be a web address');
      setHomePage(s.behavior.homePage);
      return;
    }
    const next = raw ? normalizeUrl(raw) : INTERNAL_PAGES.newTab;
    setHomePage(next);
    if (next !== s.behavior.homePage) await patch({ behavior: { homePage: next } });
  };

  const saveApiKey = async (): Promise<void> => {
    const key = aiKey.trim();
    if (!key) return;
    setSavingKey(true);
    try {
      await trpc.ai.configure.mutate({ providerId: s.ai.defaultProvider, apiKey: key });
      toast.success('API key saved');
      setAiKey('');
    } catch {
      toast.error('Could not save the API key');
    } finally {
      setSavingKey(false);
    }
  };

  const setShortcut = async (action: string, keys: string): Promise<void> => {
    const next = await trpc.settings.setShortcut.mutate({ action, keys, enabled: true });
    useBrowserStore.setState({ settings: next });
  };

  const setGesture = async (action: string, gesture: string): Promise<void> => {
    try {
      const next = await trpc.settings.setGesture.mutate({ action, gesture, enabled: true });
      useBrowserStore.setState({ settings: next });
    } catch {
      toast.error('Could not save that gesture');
    }
  };

  const resetAll = async (): Promise<void> => {
    const next = await trpc.settings.reset.mutate();
    useBrowserStore.setState({ settings: next });
    toast.success('Settings reset');
  };

  const shortcutRows: RowDef[] = COMMANDS.filter((command) => command.defaultKeys).map(
    (command) => {
      const binding = s.shortcuts.find((entry) => entry.action === command.id);
      const keys = binding?.keys ?? command.defaultKeys ?? '';
      return {
        title: command.title,
        keywords: `${command.id} ${keys} ${displayTokens(keys).join(' ')}`,
        control: (
          <ShortcutRow
            command={command}
            keys={keys}
            onSet={(next) => void setShortcut(command.id, next)}
          />
        ),
      };
    },
  );

  const gestureRows: RowDef[] = [
    toggleRow(
      'Mouse gestures',
      s.gestures.enabled,
      (value) => void patch({ gestures: { enabled: value } }),
      {
        description: 'Hold the right mouse button and drag on a page.',
        keywords: 'mouse gesture drag right button stroke',
      },
    ),
    ...GESTURABLE_COMMANDS.flatMap((commandId) => {
      const command = COMMANDS.find((entry) => entry.id === commandId);
      if (!command) return [];
      const gesture = s.gestures.bindings.find((entry) => entry.action === commandId)?.gesture ?? '';
      return [
        {
          title: command.title,
          keywords: `${command.id} gesture ${gesture} ${gestureLabel(gesture)}`,
          control: (
            <GestureRow
              command={command}
              gesture={gesture}
              onSet={(next) => void setGesture(command.id, next)}
            />
          ),
        },
      ];
    }),
  ];

  const sections: SectionDef[] = [
    {
      id: 'appearance',
      label: 'Appearance',
      icon: 'palette',
      rows: [
        {
          title: 'Theme',
          keywords: 'appearance dark light oled system colour scheme',
          control: (
            <SegmentedControl
              aria-label="Theme"
              value={s.appearance.themeMode}
              onChange={(value) => void patch({ appearance: { themeMode: value } })}
              options={[
                { value: 'system', label: 'System', icon: 'monitor' },
                { value: 'light', label: 'Light', icon: 'sun' },
                { value: 'dark', label: 'Dark', icon: 'moon' },
                { value: 'oled', label: 'OLED', icon: 'contrast' },
              ]}
            />
          ),
        },
        {
          title: 'Accent colour',
          description: 'Used for highlights, controls, and focus rings.',
          keywords: 'color colour accent highlight theme',
          control: (
            <AccentPicker
              value={s.appearance.accentColor}
              onChange={(color) => void patch({ appearance: { accentColor: color } })}
            />
          ),
        },
        toggleRow(
          'Match workspace accent',
          s.appearance.followWorkspaceAccent,
          (value) => void patch({ appearance: { followWorkspaceAccent: value } }),
          { description: 'Let the active workspace’s colour override the accent above.' },
        ),
        toggleRow(
          'Transparency & glass',
          s.appearance.transparency,
          (value) => void patch({ appearance: { transparency: value } }),
          { keywords: 'vibrancy acrylic blur translucent' },
        ),
        sliderRow(
          'Blur intensity',
          s.appearance.blurIntensity,
          0,
          100,
          (value) => void patch({ appearance: { blurIntensity: value } }),
          (value) => `${value}%`,
          { keywords: 'glass backdrop' },
        ),
        sliderRow(
          'Corner radius',
          s.appearance.cornerRadius,
          0,
          24,
          (value) => void patch({ appearance: { cornerRadius: value } }),
          (value) => `${value}px`,
          { keywords: 'rounding roundness corners' },
        ),
        sliderRow(
          'Interface scale',
          Math.round(s.appearance.uiScale * 100),
          80,
          140,
          (value) => void patch({ appearance: { uiScale: value / 100 } }),
          (value) => `${value}%`,
          { step: 5, keywords: 'zoom size ui text' },
        ),
        {
          title: 'Density',
          keywords: 'comfortable compact spacing padding',
          control: (
            <SegmentedControl
              aria-label="Density"
              value={s.appearance.density}
              onChange={(value) => void patch({ appearance: { density: value } })}
              options={[
                { value: 'comfortable', label: 'Comfortable' },
                { value: 'compact', label: 'Compact' },
              ]}
            />
          ),
        },
        toggleRow(
          'Reduce motion',
          s.appearance.reduceMotion,
          (value) => void patch({ appearance: { reduceMotion: value } }),
          { description: 'Minimise animations and transitions across the interface.' },
        ),
        toggleRow(
          'Tab hover thumbnails',
          s.appearance.showTabThumbnails,
          (value) => void patch({ appearance: { showTabThumbnails: value } }),
          { keywords: 'preview thumbnail' },
        ),
      ],
    },
    {
      id: 'behavior',
      label: 'Behaviour',
      icon: 'mouse-pointer-click',
      rows: [
        {
          title: 'On startup',
          keywords: 'session restore launch open tabs',
          control: (
            <Select
              aria-label="On startup"
              value={s.behavior.restoreSession}
              onChange={(value) => void patch({ behavior: { restoreSession: value } })}
              options={[
                { value: 'ask', label: 'Ask each time' },
                { value: 'always', label: 'Restore previous tabs' },
                { value: 'never', label: 'Open a fresh start' },
              ]}
            />
          ),
        },
        {
          title: 'Home page',
          description: 'Where the Home button and ⌥Home go.',
          keywords: 'homepage home button start address url',
          control: (
            <input
              type="text"
              value={homePage}
              onChange={(event) => setHomePage(event.target.value)}
              onBlur={() => void commitHomePage()}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
              }}
              placeholder={INTERNAL_PAGES.newTab}
              aria-label="Home page"
              spellCheck={false}
              className="h-[var(--field-height)] w-56 rounded-lg border border-line bg-bg-elevated px-3 text-[13px] text-text transition-colors outline-none placeholder:text-faint focus:border-accent"
            />
          ),
        },
        {
          title: 'Tab layout',
          keywords: 'vertical horizontal sidebar strip',
          control: (
            <Select
              aria-label="Tab layout"
              value={s.behavior.defaultTabLayout}
              onChange={(value) => void patch({ behavior: { defaultTabLayout: value } })}
              options={[
                { value: 'vertical', label: 'Vertical' },
                { value: 'horizontal', label: 'Horizontal' },
              ]}
            />
          ),
        },
        toggleRow(
          'Ask where to save downloads',
          s.behavior.askWhereToSaveDownloads,
          (value) => void patch({ behavior: { askWhereToSaveDownloads: value } }),
          { keywords: 'download location prompt folder' },
        ),
        toggleRow(
          'Confirm closing multiple tabs',
          s.behavior.confirmCloseMultipleTabs,
          (value) => void patch({ behavior: { confirmCloseMultipleTabs: value } }),
        ),
        toggleRow(
          'Warn when quitting with open tabs',
          s.behavior.warnOnQuitWithTabs,
          (value) => void patch({ behavior: { warnOnQuitWithTabs: value } }),
          { keywords: 'quit exit close' },
        ),
        toggleRow(
          'Automatic updates',
          s.behavior.automaticUpdates,
          (value) => void patch({ behavior: { automaticUpdates: value } }),
          {
            description:
              'Check GitHub for new versions in the background and download them ready to install. Updates are only applied when you restart.',
            keywords: 'update upgrade version release',
          },
        ),
      ],
    },
    {
      id: 'tabs',
      label: 'Tabs',
      icon: 'square-stack',
      rows: [
        toggleRow(
          'Sleep inactive tabs',
          s.tabs.sleepEnabled,
          (value) => void patch({ tabs: { sleepEnabled: value } }),
          {
            description: 'Free memory from tabs you haven’t used in a while.',
            keywords: 'discard suspend memory performance',
          },
        ),
        sliderRow(
          'Sleep after',
          s.tabs.sleepAfterMinutes,
          5,
          120,
          (value) => void patch({ tabs: { sleepAfterMinutes: value } }),
          (value) => `${value} min`,
          { step: 5, keywords: 'timeout minutes idle inactivity' },
        ),
        toggleRow(
          'Sleep pinned tabs',
          s.tabs.sleepPinnedTabs,
          (value) => void patch({ tabs: { sleepPinnedTabs: value } }),
        ),
        toggleRow(
          'Hover previews',
          s.tabs.hoverPreview,
          (value) => void patch({ tabs: { hoverPreview: value } }),
          { keywords: 'thumbnail peek preview' },
        ),
      ],
    },
    {
      id: 'search',
      label: 'Search',
      icon: 'search',
      rows: [
        {
          title: 'Default search engine',
          keywords: 'google engine provider omnibox address bar',
          control: (
            <Select
              aria-label="Default search engine"
              value={s.search.defaultEngineId}
              onChange={(value) => {
                void trpc.search.setDefault.mutate({ engineId: value });
                void patch({ search: { defaultEngineId: value } });
              }}
              options={engines.map((engine) => ({ value: engine.id, label: engine.name }))}
            />
          ),
        },
        toggleRow(
          'Search suggestions',
          s.search.searchSuggestions,
          (value) => void patch({ search: { searchSuggestions: value } }),
          { keywords: 'autocomplete suggest' },
        ),
        toggleRow(
          'History suggestions',
          s.search.showHistorySuggestions,
          (value) => void patch({ search: { showHistorySuggestions: value } }),
        ),
        toggleRow(
          'Bookmark suggestions',
          s.search.showBookmarkSuggestions,
          (value) => void patch({ search: { showBookmarkSuggestions: value } }),
        ),
        toggleRow(
          'Calculator in address bar',
          s.search.enableCalculator,
          (value) => void patch({ search: { enableCalculator: value } }),
          { keywords: 'math sum omnibox' },
        ),
        toggleRow(
          'Unit conversion',
          s.search.enableUnitConversion,
          (value) => void patch({ search: { enableUnitConversion: value } }),
          { keywords: 'convert units measurement' },
        ),
        toggleRow(
          'Timezone conversion',
          s.search.enableTimezoneConversion,
          (value) => void patch({ search: { enableTimezoneConversion: value } }),
          { keywords: 'time zone clock utc city' },
        ),
        toggleRow(
          'Suggest links from the clipboard',
          s.search.enableClipboardSuggestions,
          (value) => void patch({ search: { enableClipboardSuggestions: value } }),
          { keywords: 'clipboard paste and go url copy' },
        ),
        toggleRow(
          'Inline autocomplete',
          s.search.inlineAutocomplete,
          (value) => void patch({ search: { inlineAutocomplete: value } }),
        ),
      ],
    },
    {
      id: 'privacy',
      label: 'Privacy & Security',
      icon: 'shield',
      rows: [
        toggleRow(
          'Block ads',
          s.privacy.blockAds,
          (value) => void patch({ privacy: { blockAds: value } }),
        ),
        toggleRow(
          'Block trackers',
          s.privacy.blockTrackers,
          (value) => void patch({ privacy: { blockTrackers: value } }),
        ),
        toggleRow(
          'Block fingerprinting',
          s.privacy.blockFingerprinting,
          (value) => void patch({ privacy: { blockFingerprinting: value } }),
        ),
        toggleRow(
          'Block third-party cookies',
          s.privacy.blockThirdPartyCookies,
          (value) => void patch({ privacy: { blockThirdPartyCookies: value } }),
        ),
        toggleRow(
          'Upgrade to HTTPS',
          s.privacy.httpsUpgrade,
          (value) => void patch({ privacy: { httpsUpgrade: value } }),
          { keywords: 'ssl tls secure connection' },
        ),
        toggleRow(
          'Send Do Not Track',
          s.privacy.doNotTrack,
          (value) => void patch({ privacy: { doNotTrack: value } }),
          { keywords: 'dnt' },
        ),
        toggleRow(
          'Global Privacy Control',
          s.privacy.globalPrivacyControl,
          (value) => void patch({ privacy: { globalPrivacyControl: value } }),
          { keywords: 'gpc opt out' },
        ),
        toggleRow(
          'Secure DNS (DoH)',
          s.privacy.secureDns.enabled,
          (value) =>
            void patch({ privacy: { secureDns: { ...s.privacy.secureDns, enabled: value } } }),
          { keywords: 'doh dns over https encrypted resolver' },
        ),
        toggleRow(
          'Safe Browsing',
          s.security.safeBrowsing,
          (value) => void patch({ security: { safeBrowsing: value } }),
        ),
        toggleRow(
          'Scan downloads',
          s.security.scanDownloads,
          (value) => void patch({ security: { scanDownloads: value } }),
        ),
        toggleRow(
          'Site isolation',
          s.security.isolateSites,
          (value) => void patch({ security: { isolateSites: value } }),
          { keywords: 'sandbox process' },
        ),
      ],
    },
    {
      id: 'ai',
      label: 'AI',
      icon: 'sparkles',
      rows: [
        toggleRow(
          'Enable AI features',
          s.ai.enabled,
          (value) => void patch({ ai: { enabled: value } }),
          { keywords: 'assistant llm copilot' },
        ),
        {
          title: 'Provider',
          keywords: 'anthropic openai google gemini local model',
          control: (
            <Select<AiProviderId>
              aria-label="AI provider"
              value={s.ai.defaultProvider}
              onChange={(value) => void patch({ ai: { defaultProvider: value } })}
              options={[
                { value: 'anthropic', label: 'Anthropic' },
                { value: 'openai', label: 'OpenAI' },
                { value: 'google', label: 'Google Gemini' },
                { value: 'local', label: 'Local model' },
              ]}
            />
          ),
        },
        {
          title: 'API key',
          description: 'Stored encrypted with the OS keychain.',
          keywords: 'token secret credentials',
          control: (
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={aiKey}
                onChange={(event) => setAiKey(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void saveApiKey();
                }}
                placeholder="sk-…"
                aria-label="API key"
                className="h-[var(--field-height)] w-44 rounded-lg border border-line bg-bg-elevated px-3 text-[13px] text-text transition-colors outline-none placeholder:text-faint focus:border-accent"
              />
              <Button
                variant="primary"
                size="sm"
                loading={savingKey}
                disabled={!aiKey.trim()}
                onClick={() => void saveApiKey()}
              >
                Save
              </Button>
            </div>
          ),
        },
        toggleRow(
          'Stream responses',
          s.ai.streamResponses,
          (value) => void patch({ ai: { streamResponses: value } }),
          { keywords: 'streaming tokens live' },
        ),
      ],
    },
    {
      id: 'gestures',
      label: 'Mouse Gestures',
      icon: 'pointer',
      rows: gestureRows,
    },
    {
      id: 'shortcuts',
      label: 'Keyboard Shortcuts',
      icon: 'keyboard',
      rows: shortcutRows,
    },
  ];

  const query = search.trim().toLowerCase();
  const filtered = query
    ? sections
        .map((section) => ({
          ...section,
          rows: section.rows.filter((row) => rowMatches(row, query)),
        }))
        .filter((section) => section.rows.length > 0)
    : sections;

  const visibleKey = filtered.map((section) => section.id).join(',');

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const ids = visibleKey ? visibleKey.split(',') : [];
    if (ids.length === 0) return;

    const intersecting = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.getAttribute('data-section-id');
          if (id) intersecting.set(id, entry.isIntersecting);
        }
        const next = ids.find((id) => intersecting.get(id));
        if (next) setActiveSection(next);
      },
      { root, rootMargin: '-64px 0px -70% 0px', threshold: 0 },
    );

    for (const id of ids) {
      const element = document.getElementById(`section-${id}`);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [visibleKey]);

  const scrollToSection = (id: string): void => {
    setActiveSection(id);
    document
      .getElementById(`section-${id}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="flex h-full bg-bg text-text">
      <nav className="scrollbar-none flex w-56 shrink-0 flex-col gap-1 overflow-y-auto border-r border-line px-3 py-4">
        <div className="mb-3 flex items-center gap-2.5 px-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <Icon name="settings" className="h-4 w-4" strokeWidth={2} />
          </div>
          <span className="text-[13px] font-semibold tracking-tight text-text">Settings</span>
        </div>
        {filtered.map((section) => {
          const active = section.id === activeSection;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => scrollToSection(section.id)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors',
                active ? 'text-text' : 'text-muted hover:bg-surface-hover hover:text-text',
              )}
            >
              {active && (
                <motion.span
                  layoutId="settings-nav-pill"
                  transition={{ type: 'spring', stiffness: 550, damping: 40 }}
                  className="absolute inset-0 rounded-lg bg-surface-active"
                />
              )}
              <Icon
                name={section.icon}
                className={cn('relative h-4 w-4 shrink-0', active && 'text-accent')}
                strokeWidth={2}
              />
              <span className="relative truncate">{section.label}</span>
            </button>
          );
        })}
      </nav>

      <div ref={scrollRef} className="scrollbar-slim min-w-0 flex-1 overflow-y-auto">
        <header>
          <div className="mx-auto flex max-w-2xl items-start gap-4 px-6 pt-8 pb-5">
            <div className="min-w-0 flex-1">
              <h1 className="text-[22px] font-semibold tracking-tight text-text">Settings</h1>
              <p className="mt-1 text-[13px] text-muted">
                Manage how Dandelion looks, behaves, and protects you.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              icon="rotate-ccw"
              onClick={() => setConfirmReset(true)}
            >
              Reset to defaults
            </Button>
          </div>
        </header>

        <div className="sticky top-0 z-20 border-b border-line glass">
          <div className="mx-auto max-w-2xl px-6 py-3">
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder="Search settings"
              aria-label="Search settings"
            />
          </div>
        </div>

        <div className="mx-auto max-w-2xl px-6 pt-6 pb-[32vh]">
          {filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col items-center justify-center rounded-2xl border border-line bg-surface px-6 py-20 text-center"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-active text-faint">
                <Icon name="search-x" className="h-5 w-5" />
              </div>
              <p className="mt-4 text-sm font-medium text-text">
                No settings match “{search.trim()}”
              </p>
              <p className="mt-1 text-[13px] text-muted">
                Try a different term, or clear the search to see everything.
              </p>
              <Button variant="secondary" size="sm" className="mt-5" onClick={() => setSearch('')}>
                Clear search
              </Button>
            </motion.div>
          ) : (
            <div className="space-y-8">
              {filtered.map((section) => (
                <SettingsSection key={section.id} section={section} />
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Reset all settings?"
        description="Every setting returns to its default value. Your bookmarks, history, and open tabs are not affected."
        confirmLabel="Reset settings"
        destructive
        onConfirm={() => void resetAll()}
      />
    </div>
  );
}

export function SettingsPage(): ReactElement {
  const settings = useBrowserStore((state) => state.settings);
  const patch = useBrowserStore((state) => state.patchSettings);

  if (!settings) return <SettingsSkeleton />;
  return <SettingsBody settings={settings} patch={patch} />;
}
