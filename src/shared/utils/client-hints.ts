/**
 * Harmonise the User-Agent Client Hints (`Sec-CH-UA` family) so they present the
 * *same* stock-Chrome identity the UA string already does.
 *
 * Stripping the `Electron/<ver>` token from the UA string (see
 * {@link stripBrandingFromUserAgent}) fixes what a server reads from
 * `User-Agent`, but Chromium **also** advertises its brand through client hints,
 * and there it still tells on itself: the default `Sec-CH-UA` carries an
 * `"Electron"` brand and **never** `"Google Chrome"`. A server that trusts the UA
 * string sees Chrome while the client hints say Electron — and that mismatch is
 * exactly the signal Google's sign-in uses to decide a browser "may not be
 * secure", the block a stripped UA alone does not clear.
 *
 * The rewrite is deliberately conservative. It anchors to the version Chromium
 * itself stamped on its `"Chromium"` brand, so no version is invented; it mirrors
 * that version onto a `"Google Chrome"` brand (as a real Chrome build does); it
 * drops the `"Electron"` brand; and it leaves the greased `"Not A Brand"` entry —
 * whose whole purpose is to be unpredictable — untouched. Applied to every request
 * so the identity is consistent everywhere, matching the always-on UA strip.
 */

interface Brand {
  brand: string;
  version: string;
}

/** The low- and high-entropy brand-list hints. Other `Sec-CH-*` hints carry no brand. */
const BRAND_LIST_HEADERS = new Set(['sec-ch-ua', 'sec-ch-ua-full-version-list']);

/** Parse a `"Brand";v="version", …` list, tolerant of the exact spacing. */
function parseBrandList(value: string): Brand[] {
  const brands: Brand[] = [];
  const entry = /"([^"]*)";v="([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = entry.exec(value)) !== null) {
    const [, brand, version] = match;
    if (brand !== undefined && version !== undefined) brands.push({ brand, version });
  }
  return brands;
}

function serializeBrandList(brands: Brand[]): string {
  return brands.map(({ brand, version }) => `"${brand}";v="${version}"`).join(', ');
}

function isBrand(brand: string, name: string): boolean {
  return brand.toLowerCase() === name;
}

/**
 * Rewrite one brand-list value to the stock-Chrome identity. Returns the input
 * unchanged when there is no `"Chromium"` brand to anchor a version to — without
 * one, a `"Google Chrome"` brand would be a fabricated version, which is the very
 * thing this avoids.
 */
function toChromeBrandList(value: string): string {
  const brands = parseBrandList(value);
  const chromium = brands.find(({ brand }) => isBrand(brand, 'chromium'));
  if (!chromium) return value;

  const rewritten: Brand[] = [];
  let addedChrome = false;
  for (const item of brands) {
    if (isBrand(item.brand, 'electron')) continue; // the tell — drop it
    if (isBrand(item.brand, 'google chrome')) continue; // re-added beside Chromium, keeping it idempotent
    rewritten.push(item);
    if (isBrand(item.brand, 'chromium') && !addedChrome) {
      rewritten.push({ brand: 'Google Chrome', version: item.version });
      addedChrome = true;
    }
  }

  const next = serializeBrandList(rewritten);
  return next === value ? value : next;
}

/**
 * Rewrite the `Sec-CH-UA` brand-list headers of an outgoing request in place.
 * Returns whether anything changed, so a caller can skip re-issuing the header
 * set on the common request that carried nothing to fix.
 */
export function harmonizeClientHints(headers: Record<string, string>): boolean {
  let changed = false;
  for (const key of Object.keys(headers)) {
    if (!BRAND_LIST_HEADERS.has(key.toLowerCase())) continue;
    const value = headers[key];
    if (typeof value !== 'string') continue;
    const next = toChromeBrandList(value);
    if (next !== value) {
      headers[key] = next;
      changed = true;
    }
  }
  return changed;
}
