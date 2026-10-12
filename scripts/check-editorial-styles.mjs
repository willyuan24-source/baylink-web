import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import postcss from 'postcss';

// This guard covers the styles revised in the editorial pass, not the legacy
// site or the 3D canvas. Partial files have explicit, reviewable boundaries.
export const editorialStyleScopes = [
  { file: 'src/components/home-discovery.css' },
  { file: 'src/components/ai-local.css' },
  { file: 'src/components/local-discovery-detail.css' },
  { file: 'src/editorial-refinement.css' },
  { file: 'src/features/outings/outings.css', after: '/* Editorial refinement and shared reading controls.' },
  { file: 'src/features/posts/posts-ui.css', selectors: /^\.post-translation(?:\s|$)/ },
  { file: 'src/features/source-monitor/source-monitor.css' },
  // WEB-FRESH2: the editor's source desk (loaded with the admin view).
  { file: 'src/features/source-monitor/source-monitor-admin.css' },
  { file: 'src/features/profile/me-hub.css' },
  { file: 'src/features/messages/messages-hub.css' },
  { file: 'src/features/events/events.css' },
  // WEB-UI primitives. Their :root block defines the TypeCover and status pairs checked in paletteIssues().
  { file: 'src/components/ui/ui.css' },
  { file: 'src/features/feedback/feedback.css' },
  { file: 'src/features/feedback/feedback-entry.css' },
  { file: 'src/features/feedback/feedback-admin.css' },
  { file: 'src/components/phone-links.css' },
  // WEB-SAVES: the one save model's controls and My Week.
  // WEB-SAVES: the one save model's controls (global, for prerendered pages), the /me row and My Week.
  // WEB-SAVES: the one save model's controls (global, for prerendered pages) and My Week.
  { file: 'src/components/reader-library.css', after: '/* WEB-SAVES: the one save model' },
  { file: 'src/features/saves/my-week.css' },
  // WEB-GUIDES: the guide index and article templates.
  { file: 'src/features/guides/guide-library.css' },
  { file: 'src/features/guides/guide-article.css' },
  // WEB-BB-UI: the BayBay answer layout.
  { file: 'src/features/baybay/baybay-answer.css' },
  // WEB-SHELL2: the site chrome (header, menus, footer, tab bar, toast).
  // WEB-SHELL2: the site chrome (header, menus, footer, tab bar, toast) and the account / community dialogs on the Sheet.
  { file: 'src/components/site-chrome.css' },
  { file: 'src/components/site-dialogs.css' },
  // WEB-SECONDARY: /explore, /about, the legal pages and the 404 (about-baylink.css keeps two home-footer rules WEB-HOME owns).
  { file: 'src/styles/attractions.css' },
  { file: 'src/components/about-baylink.css', selectors: /^\.about-/ },
  { file: 'src/components/legal-page.css' },
  { file: 'src/components/not-found.css' },
  { file: 'src/components/archive.css' },
  { file: 'src/components/tools/tools.css' },
  { file: 'src/components/tools/unit-price.css' },
  { file: 'src/components/tools/dining-calculator.css' },
  { file: 'src/components/tools/loan-calculator.css' },
  // WEB-PLAN: 行程 (/plan) and the planner panels it and My Week mount.
  { file: 'src/styles/plan-page.css' },
  { file: 'src/styles/planner.css' },
  { file: 'src/components/planner-web-library.css' },
  { file: 'src/styles/discovery-workflow.css', selectors: /^.planner-/ },
  // WEB-COMMUNITY: the 邻里信息 board, the post cards and the post sheet.
  { file: 'src/features/posts/community.css' },
  // WEB-POLISH (G26): the deals board and the saved-poster gallery on the perks guides.
  { file: 'src/components/freebie-board.css' },
  { file: 'src/components/perks-gallery.css' },
];

const controlSelector = /(?:^|[\s>,(:])(?:a|button|input|select|textarea|summary)(?=$|[\s.#:[>)])/;
// Aa scales the root font size (src/tokens.css), so a text size follows it when it is in rem, em, % or a --text-* token.
// px never grows; --reading-scale is pinned at 1 (multiplying a rem by it again would double-scale); a vw term grows only
// when it is multiplied by --fluid-scale.
// clamp()/min()/max() pass when every term does, e.g. a TypeCover's rem floor and cap around its container term:
// clamp(.8125rem, min(calc(7.5cqw * var(--fluid-scale)), 7cqh), 1.125rem).
const readingSizeIssue = value => {
  if (/\d(?:\.\d+)?px\b/.test(value)) return `Text size ${value} is in px, which the root reading scale cannot grow.`;
  if (value.includes('--reading-scale')) return `Text size ${value} multiplies by --reading-scale; the root already scales rem (125% x 1.25 = 156%).`;
  if (/\d(?:vw|vh|vmin|vmax|svw|svh|dvw|dvh|cqw|cqi)\b/.test(value) && !value.includes('--fluid-scale')) return `Text size ${value} has a viewport term without var(--fluid-scale), so it does not grow with Aa.`;
  // The reviewed scopes keep their smallest text at --text-caption (.8125rem = 13px at the standard size).
  const small = [...value.matchAll(/(?<![\w.-])(\d*\.?\d+)rem\b/g)].find(match => Number(match[1]) < .8125);
  if (small) return `Text size ${value} is below 13px (${small[0]}); use var(--text-caption) or larger.`;
  return null;
};
const tokenNames = value => [...value.matchAll(/var\((--[a-zA-Z0-9-]+)/g)].map(match => match[1]);
const isReadingToken = token => /^(?:--text-|--color-|--reading-scale$|--control-height$)/.test(token);

function paletteIssues(values) {
  const resolveColor = (name, seen = new Set()) => {
    if (seen.has(name)) return null;
    seen.add(name);
    const value = values.get(name);
    const alias = /^var\((--[a-z0-9-]+)\)$/i.exec(value || '');
    if (alias) return resolveColor(alias[1], seen);
    // The palette's channel form (TOKENS-B): --color-x:rgb(var(--color-x-rgb)) and --color-x-rgb:R G B.
    const channelAlias = /^rgb\(\s*var\((--[a-z0-9-]+)\)\s*\)$/i.exec(value || '');
    if (channelAlias) return resolveColor(channelAlias[1], seen);
    const channels = /^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})$/.exec((value || '').trim());
    if (channels) return channels.slice(1).map(channel => Number(channel) / 255);
    const color = /^#([\da-f]{6})$/i.exec(value || '');
    return color ? [0, 2, 4].map(offset => Number.parseInt(color[1].slice(offset, offset + 2), 16) / 255) : null;
  };
  const luminance = rgb => rgb.map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
  const pairs = ['--color-ink', '--color-ink-2', '--color-ink-3', '--color-brand'].flatMap(text => ['--color-bg', '--color-surface', '--color-surface-2', '--color-selected'].filter(background => background === '--color-bg' || background === '--color-surface' || values.has(background)).map(background => [text, background, 4.5]));
  pairs.push(['--color-on-brand-muted', '--color-brand-deep', 4.5]);
  if (values.has('--color-editorial')) pairs.push(['--color-editorial', '--color-bg', 4.5]);
  // TypeCover pairs (--tc-<tone>-fg on --tc-<tone>-bg) and sticker/status pairs, wherever a guarded file defines them.
  for (const name of values.keys()) {
    const tone = /^--tc-([a-z]+)-fg$/.exec(name)?.[1];
    if (tone && values.has(`--tc-${tone}-bg`)) pairs.push([name, `--tc-${tone}-bg`, 4.5]);
  }
  // Status pairs under their global names (tokens.css) or the --ui-* names the lazily loaded ui.css block uses until then.
  const statusPairs = ['color', 'ui'].flatMap(space => [[`--${space}-success`, `--${space}-success-tint`], [`--${space}-warning`, `--${space}-warning-tint`], ['--color-danger', `--${space}-danger-tint`], [`--${space}-info`, `--${space}-info-tint`], ['--color-brand-deep', `--${space}-highlight`]]);
  for (const [foreground, background] of statusPairs) {
    if (values.has(foreground) && values.has(background)) pairs.push([foreground, background, 4.5]);
  }
  return pairs.flatMap(([foreground, background, minimum]) => {
    const fg = resolveColor(foreground), bg = resolveColor(background);
    if (!fg || !bg) return [{ file: 'shared palette', line: 1, rule: 'contrast', message: `Unable to resolve ${foreground} on ${background} as opaque sRGB tokens.` }];
    const values = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
    const contrast = (values[0] + .05) / (values[1] + .05);
    return contrast < minimum ? [{ file: 'shared palette', line: 1, rule: 'contrast', message: `${foreground} on ${background} is ${contrast.toFixed(2)}:1; expected at least ${minimum}:1.` }] : [];
  });
}

export function checkEditorialStyles(sources, sharedTokens, { contrast = false } = {}) {
  const issues = [];
  const knownTokens = new Set();
  const palette = new Map();
  for (const text of [sharedTokens, ...sources.map(source => source.text)]) {
    postcss.parse(text).walkDecls(declaration => {
      if (declaration.prop.startsWith('--')) knownTokens.add(declaration.prop);
      if (/^--(?:color|tc|ui)-/.test(declaration.prop) && declaration.parent.selector === ':root') palette.set(declaration.prop, declaration.value);
    });
  }
  for (const source of sources) {
    const start = source.after ? source.text.indexOf(source.after) : 0;
    if (start < 0) {
      issues.push({ file: source.file, line: 1, rule: 'scope', message: 'The reviewed CSS boundary is missing.' });
      continue;
    }
    const firstLine = source.text.slice(0, start).split('\n').length;
    const ast = postcss.parse(source.text.slice(start), { from: source.file });
    ast.walkRules(rule => {
      if (source.selectors && !source.selectors.test(rule.selector)) return;
      rule.walkDecls(declaration => {
        const report = (contract, message) => issues.push({ file: source.file, line: firstLine - 1 + declaration.source.start.line, selector: rule.selector, rule: contract, message });
        const { prop, value } = declaration;
        for (const token of tokenNames(value)) {
          if (isReadingToken(token) && !knownTokens.has(token)) report('token', `Undefined shared token ${token}.`);
        }
        if (source.exceptions?.some(exception => exception.selector === rule.selector && exception.property === prop && exception.value === value && exception.reason?.trim())) return;
        const sizeIssue = prop === 'font-size' || prop === 'font' ? readingSizeIssue(value) : null;
        if (sizeIssue) report('reading-scale', sizeIssue);
        // Palette definitions, photo overlays and borders can have literal
        // colors. Visible text and keyboard focus use the shared palette.
        if (prop === 'color' && /#[\da-f]+|(?:rgb|hsl)a?\(/i.test(value)) report('text-color', 'Visible text color must use a shared palette token.');
        if (rule.selector.includes(':focus-visible') && prop === 'outline' && !value.includes('var(--color-brand)')) report('focus', 'Keyboard focus must use the shared brand outline.');
        if (prop === 'min-height' && controlSelector.test(rule.selector)) {
          const fixed = /^([\d.]+)(px|rem)$/.exec(value);
          const pixels = fixed ? Number(fixed[1]) * (fixed[2] === 'rem' ? 16 : 1) : null;
          if (pixels !== null && pixels < 44) report('touch-target', `A control explicitly sets a ${pixels}px minimum height below 44px.`);
        }
      });
    });
  }
  if (contrast) issues.push(...paletteIssues(palette));
  return issues;
}

export function inspectEditorialStyles(root = resolve(fileURLToPath(new URL('..', import.meta.url)))) {
  return checkEditorialStyles(editorialStyleScopes.map(scope => ({ ...scope, text: readFileSync(resolve(root, scope.file), 'utf8') })), readFileSync(resolve(root, 'src/tokens.css'), 'utf8'), { contrast: true });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const issues = inspectEditorialStyles();
  for (const issue of issues) console.error(`${issue.file}:${issue.line} [${issue.rule}] ${issue.message}${issue.selector ? ` (${issue.selector})` : ''}`);
  if (issues.length) process.exitCode = 1;
  else console.log(`Editorial style guard passed for ${editorialStyleScopes.length} reviewed scopes. Browser layout, actual target sizes and contrast still require visual verification.`);
}
