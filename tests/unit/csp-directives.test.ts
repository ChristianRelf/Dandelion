import { describe, expect, it } from 'vitest';
import { applyCspDirectives } from '@main/services/privacy/privacy.service';

describe('applyCspDirectives', () => {
  it('adds filter directives when the response has no policy', () => {
    const headers: Record<string, string[]> = { 'content-type': ['text/html'] };
    applyCspDirectives(headers, "script-src 'none'");
    expect(headers['content-security-policy']).toEqual(["script-src 'none'"]);
    expect(headers['content-type']).toEqual(['text/html']);
  });

  it("keeps the site's own policy alongside the filter's", () => {
    const headers: Record<string, string[]> = {
      'content-security-policy': ["default-src 'self'"],
    };
    applyCspDirectives(headers, "script-src 'none'");

    const policy = headers['content-security-policy']?.[0] ?? '';
    expect(policy).toContain("script-src 'none'");
    // Dropping the site's policy would turn an ad-blocking rule into a
    // security downgrade — the one outcome this function must never produce.
    expect(policy).toContain("default-src 'self'");
  });

  it('collapses a differently-cased existing header rather than duplicating it', () => {
    const headers: Record<string, string[]> = {
      'Content-Security-Policy': ["frame-ancestors 'none'"],
    };
    applyCspDirectives(headers, "script-src 'none'");

    expect(headers['Content-Security-Policy']).toBeUndefined();
    const policy = headers['content-security-policy']?.[0] ?? '';
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("script-src 'none'");
  });

  it('merges every existing policy header, not just the first', () => {
    const headers: Record<string, string[]> = {
      'content-security-policy': ["default-src 'self'", "img-src 'self'"],
    };
    applyCspDirectives(headers, "script-src 'none'");

    const policy = headers['content-security-policy']?.[0] ?? '';
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("img-src 'self'");
    expect(policy).toContain("script-src 'none'");
  });

  it('ignores empty directives produced by trailing semicolons', () => {
    const headers: Record<string, string[]> = {};
    applyCspDirectives(headers, "script-src 'none';;");
    expect(headers['content-security-policy']).toEqual(["script-src 'none'"]);
  });
});
