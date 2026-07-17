/**
 * Generates src/main/services/privacy/public-suffix-list.ts from the Public
 * Suffix List.
 *
 * The output is a committed artifact — this only needs re-running to refresh
 * the list, which upstream amends a few times a month.
 *
 *   npm run psl
 *
 * Why generate rather than depend on a PSL package: the matching algorithm is
 * ~30 lines (see public-suffix.ts) and the only bulk is the data — which a
 * dependency would also pin to a snapshot, so it buys nothing on staleness
 * that re-running this does not. Vendoring keeps the runtime dependency list
 * at two, makes every refresh a reviewable diff, and needs no network at build
 * or run time.
 *
 * Rules are punycode-encoded here because the upstream list is unicode and
 * `URL.hostname` is not — `中国` would never match a hostname ending
 * `xn--fiqs8s`, and the shield would fail open on every IDN ccTLD, which is
 * the exact bug the list is being added to fix. Encoding at generation time
 * keeps the conversion off the request path and lets the assertion below prove
 * every emitted rule is matchable.
 */
const fs = require('node:fs');
const path = require('node:path');

const SOURCE_URL = 'https://publicsuffix.org/list/public_suffix_list.dat';

const OUTPUT_PATH = path.join(
  __dirname,
  '..',
  'src',
  'main',
  'services',
  'privacy',
  'public-suffix-list.ts',
);

/** What a rule must look like once encoded, or it can never match a hostname. */
const ASCII_RULE_RE = /^!?(\*\.)?[a-z0-9-]+(\.[a-z0-9-]+)*$/;

const SECTION_MARKERS = {
  '// ===BEGIN ICANN DOMAINS===': 'icann',
  '// ===END ICANN DOMAINS===': null,
  '// ===BEGIN PRIVATE DOMAINS===': 'private',
  '// ===END PRIVATE DOMAINS===': null,
};

/**
 * Punycode-encode a rule, preserving its `!` (exception) and `*.` (wildcard)
 * prefixes — neither is a valid hostname label, so the URL parser cannot see
 * them.
 */
function toAsciiRule(rule) {
  const exception = rule.startsWith('!');
  let body = exception ? rule.slice(1) : rule;

  const wildcard = body.startsWith('*.');
  if (wildcard) body = body.slice(2);

  // The spec only permits `*` as the leftmost label. Assert rather than assume:
  // a rule shaped some other way would silently never match.
  if (body.includes('*')) throw new Error(`wildcard outside the leftmost label: ${rule}`);

  const { hostname } = new URL(`https://${body}`);
  return `${exception ? '!' : ''}${wildcard ? '*.' : ''}${hostname}`;
}

function parseList(text) {
  const sections = { icann: [], private: [] };
  let current = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (line in SECTION_MARKERS) {
      current = SECTION_MARKERS[line];
      continue;
    }
    if (!line || line.startsWith('//') || !current) continue;

    sections[current].push(toAsciiRule(line));
  }
  return sections;
}

function readHeaderField(text, field) {
  const match = new RegExp(`^// ${field}: (.+)$`, 'm').exec(text);
  if (!match) throw new Error(`upstream list has no ${field} header`);
  return match[1].trim();
}

function render({ version, commit, icann, private: privateRules }) {
  const rules = [...icann, ...privateRules];

  for (const rule of rules) {
    if (!ASCII_RULE_RE.test(rule)) {
      throw new Error(`rule cannot match a URL hostname after encoding: ${rule}`);
    }
  }

  return `// GENERATED FILE — DO NOT EDIT.
// Regenerate with \`npm run psl\` (scripts/generate-public-suffix-list.cjs).
//
// Source:  ${SOURCE_URL}
// Version: ${version}
// Commit:  ${commit}
// Rules:   ${rules.length} (${icann.length} ICANN + ${privateRules.length} private)

/** Upstream list version, so a misclassification can be dated to a snapshot. */
export const PUBLIC_SUFFIX_LIST_VERSION = '${version}';

/**
 * Every rule, punycode-encoded and newline-delimited. Stored as one string
 * rather than an array literal: it is a third of the source size and one
 * \`split\` at startup beats ${rules.length} string literals for the parser.
 *
 * Both sections are included. The private section is what separates
 * \`alice.github.io\` from \`bob.github.io\`, and Chromium — whose cookie jar sits
 * underneath this decision — computes its own site boundary from the full
 * list, so omitting it would put the shield and the jar into disagreement.
 */
export const PUBLIC_SUFFIX_RULES = \`${rules.join('\n')}\`;
`;
}

async function main() {
  process.stdout.write(`Fetching ${SOURCE_URL}\n`);
  const response = await fetch(SOURCE_URL);
  if (!response.ok) throw new Error(`fetch failed: ${response.status} ${response.statusText}`);
  const text = await response.text();

  const { icann, private: privateRules } = parseList(text);
  if (icann.length === 0 || privateRules.length === 0) {
    throw new Error('parsed an empty section — the upstream format has changed');
  }

  const output = render({
    version: readHeaderField(text, 'VERSION'),
    commit: readHeaderField(text, 'COMMIT'),
    icann,
    private: privateRules,
  });

  fs.writeFileSync(OUTPUT_PATH, output, 'utf8');
  process.stdout.write(
    `Wrote ${path.relative(path.join(__dirname, '..'), OUTPUT_PATH)} — ` +
      `${icann.length} ICANN + ${privateRules.length} private rules\n`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
