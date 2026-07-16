/**
 * Offline unit conversion for the omnibox, e.g. `10 km to miles`,
 * `72 f to c`, `1.5 gb to mb`. Currency is intentionally excluded because it
 * requires live network rates.
 */

export interface ConversionResult {
  input: string;
  value: number;
  formatted: string;
  fromUnit: string;
  toUnit: string;
  category: string;
}

type FactorMap = Record<string, number>;

// Each map converts a unit to the category's SI-ish base unit.
const LENGTH: FactorMap = {
  m: 1,
  meter: 1,
  meters: 1,
  metre: 1,
  metres: 1,
  km: 1000,
  kilometer: 1000,
  kilometers: 1000,
  kilometre: 1000,
  cm: 0.01,
  centimeter: 0.01,
  mm: 0.001,
  millimeter: 0.001,
  mi: 1609.344,
  mile: 1609.344,
  miles: 1609.344,
  yd: 0.9144,
  yard: 0.9144,
  yards: 0.9144,
  ft: 0.3048,
  foot: 0.3048,
  feet: 0.3048,
  in: 0.0254,
  inch: 0.0254,
  inches: 0.0254,
  nmi: 1852,
  nauticalmile: 1852,
};

const MASS: FactorMap = {
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  kilogram: 1000,
  kilograms: 1000,
  mg: 0.001,
  milligram: 0.001,
  lb: 453.59237,
  lbs: 453.59237,
  pound: 453.59237,
  pounds: 453.59237,
  oz: 28.349523,
  ounce: 28.349523,
  ounces: 28.349523,
  t: 1_000_000,
  ton: 1_000_000,
  tonne: 1_000_000,
  tonnes: 1_000_000,
  st: 6350.29318,
  stone: 6350.29318,
};

const DATA: FactorMap = {
  b: 1,
  byte: 1,
  bytes: 1,
  kb: 1024,
  kib: 1024,
  kilobyte: 1024,
  mb: 1024 ** 2,
  mib: 1024 ** 2,
  megabyte: 1024 ** 2,
  gb: 1024 ** 3,
  gib: 1024 ** 3,
  gigabyte: 1024 ** 3,
  tb: 1024 ** 4,
  tib: 1024 ** 4,
  terabyte: 1024 ** 4,
  bit: 0.125,
  bits: 0.125,
};

const TIME: FactorMap = {
  ms: 0.001,
  millisecond: 0.001,
  s: 1,
  sec: 1,
  secs: 1,
  second: 1,
  seconds: 1,
  min: 60,
  mins: 60,
  minute: 60,
  minutes: 60,
  h: 3600,
  hr: 3600,
  hrs: 3600,
  hour: 3600,
  hours: 3600,
  d: 86400,
  day: 86400,
  days: 86400,
  wk: 604800,
  week: 604800,
  weeks: 604800,
  yr: 31557600,
  year: 31557600,
  years: 31557600,
};

const SPEED: FactorMap = {
  mps: 1,
  kmh: 0.2777778,
  kph: 0.2777778,
  mph: 0.44704,
  knot: 0.514444,
  knots: 0.514444,
  fps: 0.3048,
};

const VOLUME: FactorMap = {
  l: 1,
  liter: 1,
  litre: 1,
  liters: 1,
  litres: 1,
  ml: 0.001,
  milliliter: 0.001,
  gal: 3.785411,
  gallon: 3.785411,
  gallons: 3.785411,
  qt: 0.946353,
  quart: 0.946353,
  pt: 0.473176,
  pint: 0.473176,
  cup: 0.236588,
  cups: 0.236588,
  floz: 0.0295735,
};

const CATEGORIES: Record<string, FactorMap> = {
  length: LENGTH,
  mass: MASS,
  data: DATA,
  time: TIME,
  speed: SPEED,
  volume: VOLUME,
};

const UNIT_INDEX = new Map<string, { category: string; factor: number }>();
for (const [category, map] of Object.entries(CATEGORIES)) {
  for (const [unit, factor] of Object.entries(map)) {
    UNIT_INDEX.set(unit, { category, factor });
  }
}

const TEMPERATURE_ALIASES: Record<string, 'c' | 'f' | 'k'> = {
  c: 'c',
  celsius: 'c',
  centigrade: 'c',
  f: 'f',
  fahrenheit: 'f',
  k: 'k',
  kelvin: 'k',
};

function normalizeUnit(raw: string): string {
  return raw.toLowerCase().replace(/[°.\s]/g, '');
}

function convertTemperature(value: number, from: 'c' | 'f' | 'k', to: 'c' | 'f' | 'k'): number {
  // Normalise to Celsius, then to the target.
  const celsius = from === 'c' ? value : from === 'f' ? (value - 32) * (5 / 9) : value - 273.15;
  if (to === 'c') return celsius;
  if (to === 'f') return celsius * (9 / 5) + 32;
  return celsius + 273.15;
}

const CONVERSION_RE = /^([+-]?[\d.,]+)\s*([a-z°/]+)\s+(?:to|in|as|>)\s+([a-z°/]+)$/i;

/** Parse and evaluate a conversion query, or return `null` if it is not one. */
export function convertUnits(input: string): ConversionResult | null {
  const match = input.trim().match(CONVERSION_RE);
  if (!match) return null;

  const amount = Number(match[1]!.replace(/,/g, ''));
  if (!Number.isFinite(amount)) return null;

  const fromRaw = normalizeUnit(match[2]!);
  const toRaw = normalizeUnit(match[3]!);

  const fromTemp = TEMPERATURE_ALIASES[fromRaw];
  const toTemp = TEMPERATURE_ALIASES[toRaw];
  if (fromTemp && toTemp) {
    const value = convertTemperature(amount, fromTemp, toTemp);
    return buildResult(input, value, match[2]!, match[3]!, 'temperature');
  }

  const from = UNIT_INDEX.get(fromRaw);
  const to = UNIT_INDEX.get(toRaw);
  if (!from || !to || from.category !== to.category) return null;

  const value = (amount * from.factor) / to.factor;
  return buildResult(input, value, match[2]!, match[3]!, from.category);
}

function buildResult(
  input: string,
  value: number,
  fromUnit: string,
  toUnit: string,
  category: string,
): ConversionResult {
  const formatted = new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 }).format(
    Math.round(value * 1e6) / 1e6,
  );
  return { input, value, formatted, fromUnit, toUnit, category };
}
