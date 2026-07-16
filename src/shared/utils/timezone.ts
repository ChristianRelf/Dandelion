/**
 * Offline timezone conversion for the omnibox, e.g. `3pm in tokyo`,
 * `9:30am est to pst`, `time in london`.
 *
 * Zones are resolved with the platform's own IANA database via `Intl`, so no
 * offset tables are shipped and DST is always correct without maintenance.
 * Abbreviations follow colloquial intent rather than the strict standard —
 * `est` means "New York time" (which is EDT in summer), because that is what
 * someone typing it means.
 */

export interface TimezoneResult {
  input: string;
  /** The converted time, formatted for display (e.g. `11:00 PM`). */
  formatted: string;
  /** Resolved IANA zone of the answer, e.g. `Asia/Tokyo`. */
  zone: string;
  /** Human label for the answer's zone, e.g. `Tokyo`. */
  zoneLabel: string;
  /** Human label for the source, e.g. `Local time` or `New York`. */
  sourceLabel: string;
  /** Short zone name at that instant, e.g. `JST` — `null` if unavailable. */
  abbreviation: string | null;
  /** Calendar-day difference of the answer relative to the source: -1, 0 or 1. */
  dayOffset: number;
  /** The resolved instant, as an ISO string. */
  iso: string;
}

interface ZoneAlias {
  zone: string;
  label: string;
}

/**
 * Common cities and abbreviations. Anything not listed still works if it is a
 * valid IANA identifier (`asia/tokyo`), so this only needs to cover the names
 * people actually type.
 */
const ZONE_ALIASES: Record<string, ZoneAlias> = {
  // Universal
  utc: { zone: 'UTC', label: 'UTC' },
  gmt: { zone: 'UTC', label: 'GMT' },
  zulu: { zone: 'UTC', label: 'UTC' },
  // North America
  est: { zone: 'America/New_York', label: 'New York' },
  edt: { zone: 'America/New_York', label: 'New York' },
  et: { zone: 'America/New_York', label: 'New York' },
  'new york': { zone: 'America/New_York', label: 'New York' },
  nyc: { zone: 'America/New_York', label: 'New York' },
  toronto: { zone: 'America/Toronto', label: 'Toronto' },
  cst: { zone: 'America/Chicago', label: 'Chicago' },
  cdt: { zone: 'America/Chicago', label: 'Chicago' },
  ct: { zone: 'America/Chicago', label: 'Chicago' },
  chicago: { zone: 'America/Chicago', label: 'Chicago' },
  mst: { zone: 'America/Denver', label: 'Denver' },
  mdt: { zone: 'America/Denver', label: 'Denver' },
  denver: { zone: 'America/Denver', label: 'Denver' },
  pst: { zone: 'America/Los_Angeles', label: 'Los Angeles' },
  pdt: { zone: 'America/Los_Angeles', label: 'Los Angeles' },
  pt: { zone: 'America/Los_Angeles', label: 'Los Angeles' },
  'los angeles': { zone: 'America/Los_Angeles', label: 'Los Angeles' },
  la: { zone: 'America/Los_Angeles', label: 'Los Angeles' },
  'san francisco': { zone: 'America/Los_Angeles', label: 'San Francisco' },
  sf: { zone: 'America/Los_Angeles', label: 'San Francisco' },
  seattle: { zone: 'America/Los_Angeles', label: 'Seattle' },
  vancouver: { zone: 'America/Vancouver', label: 'Vancouver' },
  'mexico city': { zone: 'America/Mexico_City', label: 'Mexico City' },
  honolulu: { zone: 'Pacific/Honolulu', label: 'Honolulu' },
  anchorage: { zone: 'America/Anchorage', label: 'Anchorage' },
  // South America
  'sao paulo': { zone: 'America/Sao_Paulo', label: 'São Paulo' },
  'buenos aires': { zone: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires' },
  // Europe
  bst: { zone: 'Europe/London', label: 'London' },
  london: { zone: 'Europe/London', label: 'London' },
  dublin: { zone: 'Europe/Dublin', label: 'Dublin' },
  lisbon: { zone: 'Europe/Lisbon', label: 'Lisbon' },
  cet: { zone: 'Europe/Paris', label: 'Central European Time' },
  cest: { zone: 'Europe/Paris', label: 'Central European Time' },
  paris: { zone: 'Europe/Paris', label: 'Paris' },
  berlin: { zone: 'Europe/Berlin', label: 'Berlin' },
  madrid: { zone: 'Europe/Madrid', label: 'Madrid' },
  rome: { zone: 'Europe/Rome', label: 'Rome' },
  amsterdam: { zone: 'Europe/Amsterdam', label: 'Amsterdam' },
  stockholm: { zone: 'Europe/Stockholm', label: 'Stockholm' },
  moscow: { zone: 'Europe/Moscow', label: 'Moscow' },
  // Africa & Middle East
  cairo: { zone: 'Africa/Cairo', label: 'Cairo' },
  lagos: { zone: 'Africa/Lagos', label: 'Lagos' },
  nairobi: { zone: 'Africa/Nairobi', label: 'Nairobi' },
  johannesburg: { zone: 'Africa/Johannesburg', label: 'Johannesburg' },
  dubai: { zone: 'Asia/Dubai', label: 'Dubai' },
  // Asia
  ist: { zone: 'Asia/Kolkata', label: 'India' },
  india: { zone: 'Asia/Kolkata', label: 'India' },
  mumbai: { zone: 'Asia/Kolkata', label: 'Mumbai' },
  delhi: { zone: 'Asia/Kolkata', label: 'Delhi' },
  bangalore: { zone: 'Asia/Kolkata', label: 'Bangalore' },
  singapore: { zone: 'Asia/Singapore', label: 'Singapore' },
  'hong kong': { zone: 'Asia/Hong_Kong', label: 'Hong Kong' },
  beijing: { zone: 'Asia/Shanghai', label: 'Beijing' },
  shanghai: { zone: 'Asia/Shanghai', label: 'Shanghai' },
  seoul: { zone: 'Asia/Seoul', label: 'Seoul' },
  kst: { zone: 'Asia/Seoul', label: 'Seoul' },
  jst: { zone: 'Asia/Tokyo', label: 'Tokyo' },
  tokyo: { zone: 'Asia/Tokyo', label: 'Tokyo' },
  japan: { zone: 'Asia/Tokyo', label: 'Japan' },
  // Oceania
  aest: { zone: 'Australia/Sydney', label: 'Sydney' },
  aedt: { zone: 'Australia/Sydney', label: 'Sydney' },
  sydney: { zone: 'Australia/Sydney', label: 'Sydney' },
  melbourne: { zone: 'Australia/Melbourne', label: 'Melbourne' },
  perth: { zone: 'Australia/Perth', label: 'Perth' },
  auckland: { zone: 'Pacific/Auckland', label: 'Auckland' },
};

/** `3pm`, `3:30 pm`, `15:00`, `9am`. */
const TIME_RE = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i;
/** Splits on the LAST `in`/`to`, so `9am est to pst` yields `9am est` + `pst`. */
const QUERY_RE = /^(.+)\s+(?:in|to|→)\s+(.+)$/i;
const NOW_RE = /^(?:what(?:'s| is)\s+the\s+)?(?:current\s+)?time$|^now$/i;

/**
 * The canonical IANA name for an identifier, or `null` if the platform does not
 * know it. `Intl` matches case-insensitively but reports the canonical casing,
 * which is what we want to surface (`asia/tokyo` → `Asia/Tokyo`).
 */
function canonicalZone(candidate: string): string | null {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: candidate }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

function resolveZone(raw: string): ZoneAlias | null {
  const key = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  const alias = ZONE_ALIASES[key];
  if (alias) return alias;

  // Fall through to a raw IANA identifier, e.g. `asia/tokyo` or `Europe/Oslo`.
  const candidate = raw.trim().replace(/\s+/g, '_');
  if (!candidate.includes('/')) return null;
  const zone = canonicalZone(candidate);
  return zone ? { zone, label: zone.split('/').pop()!.replace(/_/g, ' ') } : null;
}

interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** The wall-clock reading a zone shows at a given instant. */
function wallClockIn(instant: Date, zone: string): WallClock {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);

  const get = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  // `hour12: false` can render midnight as 24 on some platforms.
  const hour = get('hour') % 24;
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour,
    minute: get('minute'),
    second: get('second'),
  };
}

/** A zone's UTC offset, in ms, at a given instant. */
function zoneOffsetMs(instant: Date, zone: string): number {
  const wall = wallClockIn(instant, zone);
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  // Intl drops sub-second precision, so compare against a floored instant.
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * The instant at which `zone` reads the given wall clock. Applying the offset
 * twice converges on DST boundaries, where the first guess can land on the
 * wrong side of a transition.
 */
function instantFromWallClock(wall: WallClock, zone: string): Date {
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, 0);
  const firstPass = new Date(asUtc - zoneOffsetMs(new Date(asUtc), zone));
  return new Date(asUtc - zoneOffsetMs(firstPass, zone));
}

/** Days since the epoch as counted by `zone`'s calendar. */
function dayNumberIn(instant: Date, zone: string): number {
  const wall = wallClockIn(instant, zone);
  return Date.UTC(wall.year, wall.month - 1, wall.day) / 86_400_000;
}

/** Days since the epoch as counted by the host's local calendar. */
function localDayNumber(instant: Date): number {
  return Date.UTC(instant.getFullYear(), instant.getMonth(), instant.getDate()) / 86_400_000;
}

function shortZoneName(instant: Date, zone: string): string | null {
  const part = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'short' })
    .formatToParts(instant)
    .find((item) => item.type === 'timeZoneName');
  return part?.value ?? null;
}

interface ParsedTime {
  hour: number;
  minute: number;
}

function parseTime(raw: string): ParsedTime | null {
  const match = raw.trim().match(TIME_RE);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3]?.toLowerCase();

  if (minute > 59) return null;
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem === 'pm' && hour !== 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;
  } else if (hour > 23) {
    return null;
  } else if (!match[2]) {
    // A bare number like `20` is far more likely to be a unit conversion or a
    // search than a time, so require either minutes or a meridiem.
    return null;
  }

  return { hour, minute };
}

/**
 * Parse and evaluate a timezone query, or return `null` if the input is not
 * one. `now` is injectable so callers (and tests) control the reference clock.
 */
export function convertTimezone(input: string, now: Date = new Date()): TimezoneResult | null {
  const query = input.trim().match(QUERY_RE);
  if (!query) return null;

  const target = resolveZone(query[2]!);
  if (!target) return null;

  const left = query[1]!.trim();
  let sourceZone: string | null = null;
  let sourceLabel = 'Local time';
  let time: ParsedTime | null = null;

  if (NOW_RE.test(left)) {
    // `time in tokyo` — convert the current moment.
  } else {
    time = parseTime(left);
    if (!time) {
      // Maybe `9:30am est` — a time followed by its source zone.
      const split = left.match(/^(.+?)\s+(\S+(?:\s+\S+)?)$/);
      if (!split) return null;
      time = parseTime(split[1]!);
      const source = time ? resolveZone(split[2]!) : null;
      if (!time || !source) return null;
      sourceZone = source.zone;
      sourceLabel = source.label;
    }
  }

  let instant: Date;
  if (!time) {
    instant = now;
  } else if (sourceZone) {
    const today = wallClockIn(now, sourceZone);
    instant = instantFromWallClock({ ...today, ...time, second: 0 }, sourceZone);
  } else {
    // No source zone named: interpret the time on the local calendar day.
    instant = new Date(now);
    instant.setHours(time.hour, time.minute, 0, 0);
  }
  if (!Number.isFinite(instant.getTime())) return null;

  const sourceDay = sourceZone ? dayNumberIn(instant, sourceZone) : localDayNumber(instant);

  const formatted = new Intl.DateTimeFormat(undefined, {
    timeZone: target.zone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(instant);

  return {
    input,
    formatted,
    zone: target.zone,
    zoneLabel: target.label,
    sourceLabel,
    abbreviation: shortZoneName(instant, target.zone),
    dayOffset: dayNumberIn(instant, target.zone) - sourceDay,
    iso: instant.toISOString(),
  };
}
