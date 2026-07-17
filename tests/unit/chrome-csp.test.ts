import { describe, expect, it } from 'vitest';
import { chromeCsp } from '../../electron.vite.config';

/** The `script-src` list, without the directive name. */
function scriptSrc(policy: string): string {
  const directive = policy.split(';').find((part) => part.trim().startsWith('script-src'));
  return directive?.trim().slice('script-src'.length).trim() ?? '';
}

describe('chromeCsp', () => {
  // The defect this pins: the comment above the meta tag claimed production was
  // hardened "via response headers in the security service". No such code
  // existed, and none could — the chrome loads over file:// via `loadFile`,
  // where `webRequest` never fires — so the shipped policy was the dev one.
  it('gives production a script-src of nothing but self', () => {
    expect(scriptSrc(chromeCsp(false))).toBe("'self'");
  });

  it("keeps 'unsafe-inline' and 'unsafe-eval' out of production entirely", () => {
    const policy = chromeCsp(false);
    expect(policy).not.toContain('unsafe-eval');
    expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
  });

  // Vite serves the renderer itself in dev and injects its HMR client inline;
  // tightening this half would break the dev server rather than harden anything.
  it('keeps them in dev, where Vite injects the HMR client inline', () => {
    expect(scriptSrc(chromeCsp(true))).toBe("'self' 'unsafe-inline' 'unsafe-eval'");
  });

  // Favicons load over this scheme so main can resolve them through the owning
  // profile's session instead of the shared default one (fixed in v0.2.2h).
  it('keeps the favicon scheme in img-src for both modes', () => {
    expect(chromeCsp(true)).toContain('dandelion-favicon:');
    expect(chromeCsp(false)).toContain('dandelion-favicon:');
  });

  // Inline styles are Tailwind's and motion's, in every mode.
  it('differs from dev in script-src alone', () => {
    const dev = chromeCsp(true).replace(" 'unsafe-inline' 'unsafe-eval';", ';');
    expect(dev).toBe(chromeCsp(false));
  });
});
