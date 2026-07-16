import { describe, expect, it } from 'vitest';
import {
  buildSearchUrl,
  classifyOmniboxInput,
  getHostname,
  looksLikeUrl,
  normalizeUrl,
  prettifyUrl,
  rootDomain,
} from '@shared/utils';

describe('looksLikeUrl', () => {
  it('recognises bare domains and paths', () => {
    expect(looksLikeUrl('example.com')).toBe(true);
    expect(looksLikeUrl('sub.example.co.uk/path?q=1')).toBe(true);
  });

  it('recognises explicit schemes', () => {
    expect(looksLikeUrl('https://example.com')).toBe(true);
    expect(looksLikeUrl('dandelion://settings')).toBe(true);
    expect(looksLikeUrl('file:///c/x.txt')).toBe(true);
  });

  it('recognises localhost and IPv4', () => {
    expect(looksLikeUrl('localhost:5173')).toBe(true);
    expect(looksLikeUrl('127.0.0.1:8080')).toBe(true);
  });

  it('treats multi-word and single-word input as search', () => {
    expect(looksLikeUrl('what is rust')).toBe(false);
    expect(looksLikeUrl('vitest')).toBe(false);
    expect(looksLikeUrl('how to center a div')).toBe(false);
  });
});

describe('classifyOmniboxInput', () => {
  it('classifies URLs, adding a scheme', () => {
    expect(classifyOmniboxInput('example.com')).toEqual({
      kind: 'url',
      url: 'https://example.com',
    });
  });
  it('classifies free text as search', () => {
    expect(classifyOmniboxInput('best pizza')).toEqual({ kind: 'search', query: 'best pizza' });
  });
});

describe('url helpers', () => {
  it('normalises schemeless urls', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com');
    expect(normalizeUrl('http://x.com')).toBe('http://x.com');
  });
  it('prettifies urls', () => {
    expect(prettifyUrl('https://example.com/')).toBe('example.com');
    expect(prettifyUrl('https://a.com/path?q=1')).toBe('a.com/path?q=1');
  });
  it('builds encoded search urls', () => {
    expect(buildSearchUrl('https://g.com/?q=%s', 'a b')).toBe('https://g.com/?q=a%20b');
  });
  it('extracts hostname and root domain', () => {
    expect(getHostname('https://a.b.example.com/x')).toBe('a.b.example.com');
    expect(rootDomain('a.b.example.com')).toBe('example.com');
  });
});
