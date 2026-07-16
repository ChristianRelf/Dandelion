import { describe, expect, it } from 'vitest';
import { BlockEngine } from '@main/services/privacy/block-engine';

describe('BlockEngine', () => {
  it('blocks known ad/tracker domains and their subdomains', () => {
    const engine = new BlockEngine();
    expect(engine.match('https://doubleclick.net/ad').blocked).toBe(true);
    expect(engine.match('https://stats.g.doubleclick.net/x').blocked).toBe(true);
    expect(engine.match('https://www.google-analytics.com/collect').kind).toBe('tracker');
  });

  it('allows unlisted domains', () => {
    const engine = new BlockEngine();
    expect(engine.match('https://example.com/').blocked).toBe(false);
    expect(engine.match('https://github.com/').blocked).toBe(false);
  });

  it('seeds a non-trivial default list', () => {
    expect(new BlockEngine().size).toBeGreaterThan(50);
    expect(new BlockEngine(false).size).toBe(0);
  });

  it('supports custom rules and hosts lists', () => {
    const engine = new BlockEngine(false);
    engine.add('tracker.io', 'tracker');
    expect(engine.match('https://a.b.tracker.io/x').kind).toBe('tracker');

    const added = engine.loadHostsList('0.0.0.0 ads.test\n# comment\n0.0.0.0 spy.test');
    expect(added).toBe(2);
    expect(engine.match('https://ads.test/').blocked).toBe(true);
  });
});
