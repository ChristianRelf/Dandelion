import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { OnBeforeRequestListenerDetails } from 'electron';
import { ElectronBlocker, fromElectronDetails } from '@ghostery/adblocker-electron';
import type { Logger } from '../../core/logger';
import { filtersDir } from '../../core/paths';
import {
  FILTER_CATEGORIES,
  FILTER_LISTS,
  FILTER_REFRESH_INTERVAL_MS,
  filterResourcesUrl,
  listSignature,
  type FilterCategory,
} from './filter-lists';

/** Give up on a list that will not arrive; a slow mirror must not wedge a refresh. */
const FETCH_TIMEOUT_MS = 30_000;

/** How often staleness is re-checked while the browser stays open. */
const FILTER_REFRESH_CHECK_MS = 6 * 60 * 60 * 1000;

interface CachedEngineMeta {
  /** The list set the cached engine was built from — see `listSignature`. */
  signature: string;
  /** Epoch millis the engine was built, used to decide when to refresh. */
  builtAt: number;
}

interface LoadedEngine {
  blocker: ElectronBlocker;
  builtAt: number;
}

/**
 * What the filter lists say about a request. `allow` is an explicit exception
 * rule and outranks any other blocklist; `null` means no engine had an opinion
 * and the caller should decide for itself.
 */
export type FilterVerdict =
  | { action: 'block'; category: FilterCategory }
  | { action: 'redirect'; category: FilterCategory; url: string }
  | { action: 'allow' }
  | null;

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`${url} responded ${response.status}`);
  return response.text();
}

/**
 * Loads, caches and refreshes one Adblock-Plus-syntax filter engine per shield
 * category.
 *
 * The engines are built from the network, so they are never available at the
 * instant the first request is made. Every accessor therefore reports absence
 * rather than waiting: {@link PrivacyService} falls back to the bundled
 * domain-level {@link BlockEngine} until an engine has loaded, so a cold first
 * run still blocks the common ad and tracker domains instead of nothing.
 */
export class FilterEngineService {
  private readonly engines = new Map<FilterCategory, LoadedEngine>();
  private readonly inFlight = new Map<FilterCategory, Promise<void>>();
  private resources: { text: string; checksum: string } | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly logger: Logger) {}

  /**
   * Bring every category online: serve the disk cache immediately when it is
   * valid, and rebuild from the network when it is missing, stale or unreadable.
   *
   * Resolves once the cached engines are in memory. The network rebuilds it may
   * start are deliberately not awaited — blocking startup on three list
   * downloads would delay the first window by seconds on a slow connection.
   */
  async initialize(): Promise<void> {
    await Promise.all(FILTER_CATEGORIES.map((category) => this.load(category)));

    // A browser stays open for days, so the freshness check cannot only happen
    // at launch. `unref` keeps this timer from holding the process alive.
    this.refreshTimer = setInterval(() => this.refreshStale(), FILTER_REFRESH_CHECK_MS);
    this.refreshTimer.unref?.();
  }

  dispose(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.refreshTimer = null;
  }

  /** True once at least one category can answer, i.e. the engines are worth asking. */
  get ready(): boolean {
    return this.engines.size > 0;
  }

  /** Total network filters currently loaded, for the startup log. */
  get size(): number {
    let total = 0;
    for (const { blocker } of this.engines.values()) {
      total += blocker.getFilters().networkFilters.length;
    }
    return total;
  }

  /**
   * The verdict for a request, or `null` when no loaded engine has an opinion.
   *
   * Categories are asked in the caller's order so a disabled category is never
   * consulted, and the reported category is the one the shield counter is
   * attributed to — the reason the engines are kept apart per category.
   *
   * An `allow` verdict comes from an exception rule (`@@…`) and is
   * deliberately distinguishable from "no opinion": the lists use exceptions to
   * unbreak sites, and that intent is lost if a coarser blocklist is then
   * allowed to block the same request anyway.
   *
   * Main-frame requests are never blocked. Cancelling one replaces the page the
   * user asked for with a network error, which is a navigation failure rather
   * than an ad being hidden.
   */
  match(
    details: OnBeforeRequestListenerDetails,
    categories: readonly FilterCategory[],
  ): FilterVerdict {
    if (this.engines.size === 0) return null;

    const request = fromElectronDetails(details);
    if (request.type === 'other') request.guessTypeOfRequest();
    if (request.isMainFrame()) return null;

    for (const category of categories) {
      const engine = this.engines.get(category);
      if (!engine) continue;
      const { match, redirect, exception } = engine.blocker.match(request);
      if (exception) return { action: 'allow' };
      if (redirect) return { action: 'redirect', category, url: redirect.dataUrl };
      if (match) return { action: 'block', category };
    }
    return null;
  }

  /**
   * The engine that answers cosmetic-filter and CSP queries.
   *
   * Element-hiding and `$csp` rules live almost entirely in the ad lists, and
   * only that engine is built with cosmetic filters loaded, so there is exactly
   * one candidate.
   */
  get cosmeticEngine(): ElectronBlocker | null {
    return this.engines.get('ad')?.blocker ?? null;
  }

  /** Rebuild any category whose cached engine has aged out. Safe to call often. */
  refreshStale(): void {
    const now = Date.now();
    for (const category of FILTER_CATEGORIES) {
      const engine = this.engines.get(category);
      if (engine && now - engine.builtAt < FILTER_REFRESH_INTERVAL_MS) continue;
      void this.rebuild(category);
    }
  }

  /* ---- Loading ---- */

  private async load(category: FilterCategory): Promise<void> {
    const cached = await this.readCache(category);
    if (cached) {
      this.engines.set(category, cached);
      this.logger.debug(`filter engine '${category}' restored from cache`);
      if (Date.now() - cached.builtAt >= FILTER_REFRESH_INTERVAL_MS) void this.rebuild(category);
      return;
    }
    void this.rebuild(category);
  }

  /**
   * Download the category's lists and replace its engine.
   *
   * Failures are logged and swallowed: a category that cannot be rebuilt keeps
   * serving its previous engine, and one that never had one falls back to the
   * bundled blocklist. Neither is worth failing a browser launch over.
   */
  private async rebuild(category: FilterCategory): Promise<void> {
    const existing = this.inFlight.get(category);
    if (existing) return existing;

    const task = this.buildFromNetwork(category)
      .catch((error: unknown) => {
        this.logger.warn(
          `filter engine '${category}' rebuild failed: ${String(
            error instanceof Error ? error.message : error,
          )}`,
        );
      })
      .finally(() => {
        this.inFlight.delete(category);
      });

    this.inFlight.set(category, task);
    return task;
  }

  private async buildFromNetwork(category: FilterCategory): Promise<void> {
    // Only the ad engine carries cosmetic filters. The privacy and badware
    // lists are almost entirely network rules, so parsing and holding cosmetic
    // tries for them costs memory that answers no query.
    const blocker = await ElectronBlocker.fromLists(fetch, [...FILTER_LISTS[category]], {
      loadCosmeticFilters: category === 'ad',
      loadNetworkFilters: true,
      enableMutationObserver: category === 'ad',
      guessRequestTypeFromUrl: true,
    });

    if (category === 'ad') {
      const resources = await this.loadResources();
      if (resources) blocker.updateResources(resources.text, resources.checksum);
    }

    const builtAt = Date.now();
    this.engines.set(category, { blocker, builtAt });
    this.logger.info(
      `filter engine '${category}' built (${blocker.getFilters().networkFilters.length} network rules)`,
    );
    await this.writeCache(category, blocker, builtAt);
  }

  /**
   * Scriptlet resources, fetched once and shared. Cached in memory only — the
   * file is small and is refetched with the lists it belongs to.
   */
  private async loadResources(): Promise<{ text: string; checksum: string } | null> {
    if (this.resources) return this.resources;
    try {
      const text = await fetchText(filterResourcesUrl());
      // Ghostery only uses the checksum to decide whether resources changed;
      // the content itself is the authority, so its length is a sufficient tag.
      this.resources = { text, checksum: `${text.length}` };
      return this.resources;
    } catch (error) {
      this.logger.warn(`filter resources unavailable: ${String(error)}`);
      return null;
    }
  }

  /* ---- Disk cache ---- */

  private enginePath(category: FilterCategory): string {
    return join(filtersDir(), `${category}.engine.bin`);
  }

  private metaPath(category: FilterCategory): string {
    return join(filtersDir(), `${category}.meta.json`);
  }

  /**
   * Restore a previously serialised engine, or `null` when there is nothing
   * trustworthy to restore.
   *
   * Deserialisation is rejected whenever the cache cannot be proven to match
   * the current build: a changed list catalogue, or a serialisation format from
   * a different `@ghostery/adblocker` version, both surface here and are
   * answered by rebuilding rather than by loading a mismatched engine.
   */
  private async readCache(category: FilterCategory): Promise<LoadedEngine | null> {
    try {
      const [rawMeta, serialized] = await Promise.all([
        readFile(this.metaPath(category), 'utf8'),
        readFile(this.enginePath(category)),
      ]);
      const meta = JSON.parse(rawMeta) as CachedEngineMeta;
      if (meta.signature !== listSignature(category)) return null;

      const blocker = ElectronBlocker.deserialize(
        new Uint8Array(serialized.buffer, serialized.byteOffset, serialized.byteLength),
      );
      return { blocker, builtAt: meta.builtAt };
    } catch {
      // Absent, truncated or version-mismatched cache — rebuild from network.
      return null;
    }
  }

  private async writeCache(
    category: FilterCategory,
    blocker: ElectronBlocker,
    builtAt: number,
  ): Promise<void> {
    try {
      await mkdir(filtersDir(), { recursive: true });
      const meta: CachedEngineMeta = { signature: listSignature(category), builtAt };
      await writeFile(this.enginePath(category), blocker.serialize());
      await writeFile(this.metaPath(category), JSON.stringify(meta));
    } catch (error) {
      // A cache that cannot be written costs a rebuild next launch, nothing more.
      this.logger.warn(`filter engine '${category}' cache write failed: ${String(error)}`);
    }
  }
}
