/**
 * Registrable-domain resolution against the Public Suffix List.
 *
 * The cookie shield's question — "are these two URLs the same site?" — reduces
 * to this, and label counting cannot answer it: `bbc.co.uk` and `tracker.co.uk`
 * share their last two labels and are different sites, while `example.com` and
 * `cdn.example.com` share only one and are the same site. Nothing but the list
 * knows where a registry stops and a registrant begins.
 *
 * Lives in main, beside the blocklist it sits next to, rather than in
 * `@shared/utils`: the data is ~140KB and no renderer has a use for it.
 * `rootDomain` there remains the cheap label-counting approximation for display
 * and grouping, where being wrong about `co.uk` costs nothing.
 *
 * Algorithm per https://publicsuffix.org/list/ § Algorithm.
 */
import { PUBLIC_SUFFIX_RULES } from './public-suffix-list';

/**
 * Rule text, verbatim. Exceptions (`!city.kobe.jp`) and wildcards (`*.kobe.jp`)
 * keep their prefixes, so one set holds all three rule kinds without collision:
 * a hostname candidate never starts with `!` or `*.`, so probing for each shape
 * is unambiguous.
 */
const RULES: ReadonlySet<string> = new Set(PUBLIC_SUFFIX_RULES.split('\n'));

/** `URL` normalises IPv6 hosts to bracketed form and IPv4 to a dotted quad. */
const IPV4_LITERAL_RE = /^\d{1,3}(\.\d{1,3}){3}$/;

function isIpLiteral(host: string): boolean {
  return host.startsWith('[') || IPV4_LITERAL_RE.test(host);
}

/** How many trailing labels of `labels` form its public suffix. */
function publicSuffixLength(labels: string[]): number {
  // No rule matching at all means the prevailing rule is `*`, i.e. the TLD.
  let length = 1;

  // Descending candidate length, so the first exception found is also the one
  // with the most labels — which is the one that would win on length anyway.
  for (let i = 0; i < labels.length; i += 1) {
    const candidate = labels.slice(i).join('.');

    // An exception rule wins outright, and shortens the suffix by its own
    // leftmost label: `!city.kobe.jp` makes `kobe.jp` the suffix, which is what
    // puts `city.kobe.jp` back in the hands of a registrant.
    if (RULES.has(`!${candidate}`)) return labels.length - i - 1;

    const wildcard = `*.${labels.slice(i + 1).join('.')}`;
    if (RULES.has(candidate) || RULES.has(wildcard)) {
      length = Math.max(length, labels.length - i);
    }
  }
  return length;
}

/**
 * The registrable domain ("eTLD+1") of a hostname, or `null` where the list
 * cannot name one: an IP literal (an address, not a name — and counting labels
 * would reduce `127.0.0.1` to `0.1`), a bare public suffix like `co.uk`, or a
 * single-label intranet name like `localhost`.
 *
 * A `null` means "the list has nothing to say", not "same site" — callers
 * deciding on identity must fall back to the host itself rather than treating
 * two unnamed hosts as one.
 */
export function registrableDomain(hostname: string): string | null {
  const host = hostname
    .toLowerCase()
    // A fully-qualified `example.com.` names the same site as `example.com`.
    .replace(/\.$/, '');

  if (!host || isIpLiteral(host)) return null;

  const labels = host.split('.');
  if (labels.some((label) => !label)) return null;

  const suffixLength = publicSuffixLength(labels);
  if (labels.length <= suffixLength) return null;

  return labels.slice(labels.length - suffixLength - 1).join('.');
}
