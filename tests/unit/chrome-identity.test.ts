import { afterEach, describe, expect, it, vi } from 'vitest';
import { CHROME_IDENTITY_SCRIPT } from '@main/browser/chrome-identity';

interface Brand {
  brand: string;
  version: string;
}

/**
 * A stand-in for the real `navigator`, shaped like Electron's: a `NavigatorUAData`
 * whose brands are plain `Chromium` (+ a greased brand) with no `Google Chrome` —
 * exactly what the live console showed.
 */
function makeNavigator() {
  const realBrands: Brand[] = [
    { brand: 'Not;A=Brand', version: '8' },
    { brand: 'Chromium', version: '150' },
  ];
  const proto = {
    get brands(): Brand[] {
      return realBrands.map((b) => ({ brand: b.brand, version: b.version }));
    },
    getHighEntropyValues(_hints: string[]) {
      return Promise.resolve({
        brands: realBrands.map((b) => ({ brand: b.brand, version: b.version })),
        fullVersionList: [
          { brand: 'Not;A=Brand', version: '8.0.0.0' },
          { brand: 'Chromium', version: '150.0.7871.114' },
        ],
        mobile: false,
        platform: 'Windows',
      });
    },
  };
  return { userAgentData: Object.create(proto), webdriver: undefined as unknown };
}

/** Run the real injected script against a stubbed global `navigator`. */
function run(nav: unknown): void {
  vi.stubGlobal('navigator', nav);
  new Function(CHROME_IDENTITY_SCRIPT)();
}

afterEach(() => vi.unstubAllGlobals());

describe('CHROME_IDENTITY_SCRIPT', () => {
  it('adds a Google Chrome brand mirroring the Chromium version', () => {
    const nav = makeNavigator();
    run(nav);
    const brands = nav.userAgentData.brands as Brand[];
    expect(brands.map((b) => b.brand)).toEqual(['Not;A=Brand', 'Chromium', 'Google Chrome']);
    expect(brands.find((b) => b.brand === 'Google Chrome')?.version).toBe('150');
  });

  it('augments getHighEntropyValues brands and full-version list with the full version', async () => {
    const nav = makeNavigator();
    run(nav);
    const values = await (
      nav.userAgentData as {
        getHighEntropyValues: (h: string[]) => Promise<Record<string, Brand[]>>;
      }
    ).getHighEntropyValues(['brands', 'fullVersionList']);
    expect(values.brands.map((b) => b.brand)).toContain('Google Chrome');
    expect(values.fullVersionList.find((b) => b.brand === 'Google Chrome')?.version).toBe(
      '150.0.7871.114',
    );
  });

  it('pins navigator.webdriver to false', () => {
    const nav = makeNavigator();
    run(nav);
    expect(nav.webdriver).toBe(false);
  });

  it('is idempotent — a second pass adds no duplicate Google Chrome brand', () => {
    const nav = makeNavigator();
    run(nav);
    new Function(CHROME_IDENTITY_SCRIPT)();
    const chrome = (nav.userAgentData.brands as Brand[]).filter((b) => b.brand === 'Google Chrome');
    expect(chrome).toHaveLength(1);
  });

  it('never throws when userAgentData is absent', () => {
    expect(() => run({})).not.toThrow();
  });
});
