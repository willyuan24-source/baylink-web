// UI9-F (tokens v2) elder-mode rule (captain decision 10-18): in the elder modes (大 / 特大, 简洁显示, and both together) no
// type step is smaller than it was before tokens v2, on a phone or a desktop. The cascade of src/tokens.css is resolved here for each case (media
// width, the html attributes, specificity, then source order) and compared with the old ladder's values (main 58a9c05).
// The same holds for every component size the ladder codemod lowered (LOWERED below): each reads a --fs-keep-* token.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import postcss, { type Rule } from 'postcss';

const tokens = postcss.parse(readFileSync('src/tokens.css', 'utf8'));

/** [ids, classes/attributes/pseudo-classes, types] of one complex selector; :where() counts 0, :is() / :not() / :has() their most specific argument. */
export function specificity(selector: string): [number, number, number] {
  const total: [number, number, number] = [0, 0, 0];
  const add = (s: [number, number, number]) => { total[0] += s[0]; total[1] += s[1]; total[2] += s[2]; };
  const split = (list: string) => {
    const parts: string[] = []; let depth = 0; let start = 0;
    for (let i = 0; i < list.length; i++) { const c = list[i]; if (c === '(') depth++; else if (c === ')') depth--; else if (c === ',' && depth === 0) { parts.push(list.slice(start, i)); start = i + 1; } }
    parts.push(list.slice(start)); return parts.map(part => part.trim()).filter(Boolean);
  };
  const max = (list: string) => split(list).map(specificity).sort((a, b) => b[0] - a[0] || b[1] - a[1] || b[2] - a[2])[0] ?? [0, 0, 0];
  let i = 0;
  while (i < selector.length) {
    const c = selector[i];
    if (c === '#') { total[0]++; i++; while (i < selector.length && /[\w-]/.test(selector[i])) i++; }
    else if (c === '.') { total[1]++; i++; while (i < selector.length && /[\w-]/.test(selector[i])) i++; }
    else if (c === '[') { total[1]++; i = selector.indexOf(']', i) + 1; }
    else if (c === ':') {
      const element = selector[i + 1] === ':'; i += element ? 2 : 1;
      const name = /^[\w-]+/.exec(selector.slice(i))?.[0] ?? ''; i += name.length;
      if (selector[i] === '(') {
        let depth = 1; const open = i; i++;
        while (i < selector.length && depth) { if (selector[i] === '(') depth++; else if (selector[i] === ')') depth--; i++; }
        const inner = selector.slice(open + 1, i - 1);
        if (name === 'where') continue;
        if (['is', 'not', 'has', 'matches'].includes(name)) add(max(inner)); else total[1]++;
      } else if (element) total[2]++; else total[1]++;
    } else if (/[a-zA-Z*]/.test(c)) { const name = /^[\w*-]+/.exec(selector.slice(i))![0]; if (name !== '*') total[2]++; i += name.length; }
    else i++;
  }
  return total;
}

type Case = { width: number; reading?: 'large' | 'extra-large'; simple?: boolean };
const rootPx = (c: Case) => 16 * (c.reading === 'extra-large' ? 1.25 : c.reading === 'large' ? 1.125 : 1);

/** Width media only; any other media feature (reduced motion, print …) is taken as not matching. */
function mediaMatches(params: string, width: number) {
  return params.split(/\band\b/).every(part => {
    const min = /min-width:\s*(\d+)px/.exec(part); if (min) return width >= Number(min[1]);
    const max = /max-width:\s*(\d+)px/.exec(part); if (max) return width <= Number(max[1]);
    return false;
  });
}

/** px of any --fs-* custom property on <html> for one case. */
function fsPx(c: Case): (token: string) => number {
  const { document } = new JSDOM('<!doctype html><html><body></body></html>').window;
  const html = document.documentElement;
  if (c.reading) html.setAttribute('data-reading', c.reading);
  if (c.simple) html.setAttribute('data-simple', '');
  const winners = new Map<string, { spec: [number, number, number]; value: string }>();
  /** a ≥ b: a later declaration with equal or higher specificity wins. */
  const atLeast = (a: [number, number, number], b: [number, number, number]) => (a[0] - b[0] || a[1] - b[1] || a[2] - b[2]) >= 0;
  tokens.walkRules((rule: Rule) => {
    const parent = rule.parent;
    if (parent && parent.type === 'atrule') { const at = parent as unknown as { name: string; params: string }; if (at.name !== 'media' || !mediaMatches(at.params, c.width)) return; }
    else if (parent && parent.type !== 'root') return;
    const matching = rule.selectors.filter(selector => { try { return html.matches(selector); } catch { return false; } });
    if (!matching.length) return;
    const spec = matching.map(specificity).sort((a, b) => b[0] - a[0] || b[1] - a[1] || b[2] - a[2])[0];
    for (const node of rule.nodes) {
      if (node.type !== 'decl' || !node.prop.startsWith('--fs-')) continue;
      const current = winners.get(node.prop);
      if (!current || atLeast(spec, current.spec)) winners.set(node.prop, { spec, value: node.value });
    }
  });
  const px = (token: string) => {
    const value = winners.get(token)?.value; assert.ok(value, `${token} resolved`);
    const rem = /^(\d*\.?\d+)rem$/.exec(value!); assert.ok(rem, `${token} is a plain rem (${value})`);
    return Number(rem![1]) * rootPx(c);
  };
  return px;
}

/** The ladder steps on <html> for one case. */
function resolveSteps(c: Case) {
  const px = fsPx(c);
  return { title: px('--fs-title'), section: px('--fs-section'), display: px('--fs-display'), card: px('--fs-card'), reading: px('--fs-reading'), body: px('--fs-body'), meta: px('--fs-meta'), badge: px('--fs-badge') };
}

/** The old ladder (main 58a9c05, before tokens v2): --text-* in rem, 简洁显示 raised caption / fact / body / reading only. */
function oldSteps(c: Case) {
  const r = rootPx(c); const desktop = c.width >= 1024;
  const fluid = c.reading === 'extra-large' ? 1.25 : c.reading === 'large' ? 1.125 : 1;
  const display = desktop ? Math.min(Math.max(2.5 * r, 1.6 * r + 0.0125 * c.width * fluid), 3.25 * r) : 1.75 * r;
  return {
    title: (desktop ? 2 : 1.625) * r, section: (desktop ? 1.5 : 1.375) * r, display, card: 1.125 * r,
    reading: (c.simple ? 1.25 : 1.0625) * r, body: (c.simple ? 1.125 : 1) * r, meta: (c.simple ? 1 : 0.875) * r, badge: (c.simple ? 1 : 0.8125) * r,
  };
}

test('specificity: the forms tokens.css uses', () => {
  assert.deepEqual(specificity(':root'), [0, 1, 0]);
  assert.deepEqual(specificity('html[data-simple]'), [0, 1, 1]);
  assert.deepEqual(specificity('html:is([data-reading=large],[data-reading=extra-large]):not([data-simple])'), [0, 2, 1]);
  assert.deepEqual(specificity(':where(p,li,dd)'), [0, 0, 0]);
});

test('elder modes: no heading or text step is smaller than on the old ladder (phone 特大 H1 / H2 ≥ 32.5 / 27.5px)', () => {
  const cases: Case[] = [];
  // Every elder case: 大 / 特大 with and without 简洁显示, and 简洁显示 at 标准. (标准 itself follows the tokens v2 ladder.)
  for (const width of [390, 768, 1023, 1024, 1440]) for (const reading of [undefined, 'large', 'extra-large'] as const) for (const simple of [false, true]) if (reading || simple) cases.push({ width, reading, simple });
  for (const c of cases) {
    const now = resolveSteps(c); const old = oldSteps(c);
    for (const key of Object.keys(old) as Array<keyof typeof old>) {
      assert.ok(now[key] + 0.01 >= old[key], `${key} ${now[key]}px < ${old[key].toFixed(2)}px at ${JSON.stringify(c)}`);
    }
  }
  // UI9-R1 (N01): 特大 renders whole pixels, the elder steps rounded up to the next rung (32.5 → 35, 27.5 → 30).
  const phoneXl = resolveSteps({ width: 390, reading: 'extra-large' });
  assert.equal(phoneXl.title, 35); assert.equal(phoneXl.section, 30);
  const phoneLarge = resolveSteps({ width: 390, reading: 'large' });
  assert.equal(phoneLarge.title, 29.25); assert.equal(phoneLarge.section, 24.75);
  // 标准 keeps the tokens v2 ladder (24 / 20 on a phone, 32 / 24 on a desktop); only the elder sizes keep the old steps.
  assert.deepEqual([resolveSteps({ width: 390 }).title, resolveSteps({ width: 390 }).section], [24, 20]);
  assert.deepEqual([resolveSteps({ width: 1440, reading: 'extra-large' }).title, resolveSteps({ width: 1440, reading: 'extra-large' }).section], [40, 30]);
});

// Every component font size the ladder codemod (scripts/codemods/type-weight-tokens.mjs) moved DOWN: the declarations whose
// literal size on main 58a9c05 is larger than on this branch, keyed by file, @media and selector (overhaul tool
// lowered-sizes.mjs; 70 of them). [media, selector, size on main in px at the 16px root, tokens v2 step in px]. Each now reads
// var(--fs-keep-<step>): the step at 标准, at least the old size in 大 / 特大 / 简洁显示 on a phone, a tablet and a desktop.
type Pin = [media: string, selector: string, oldPx: number, stepPx: number];
const LOWERED: Array<[file: string, pins: Pin[]]> = [
  ['src/components/about-baylink.css', [
    ['', '.about-section>h2', 22, 20],
  ]],
  ['src/components/archive.css', [
    ['', '.archive-group>h2', 22, 20],
  ]],
  ['src/components/discovery-community.css', [
    ['', '.discovery-return h2', 26, 24],
  ]],
  ['src/components/guide-visuals.css', [
    ['', '.guide-route-heading h3', 22, 20],
  ]],
  ['src/components/guides-ui.css', [
    ['', '.bl-guide-prose>h2', 21, 20],
    ['@media (max-width: 540px)', '.bl-guide-cta h3', 19, 18],
    ['', '.city-exploration-card>summary strong', 19, 18],
    ['', '.shopping-place h4', 21, 20],
    ['@media (max-width:639px)', '.shopping-place h4', 19, 18],
    ['', '.utility-county>h3', 19, 18],
    ['', '.platform-card h4', 22, 20],
  ]],
  ['src/components/not-found.css', [
    ['', '.nf-hero h1', 26, 24],
  ]],
  ['src/components/reader-library.css', [
    ['', '.reader-shelf-heading h2', 22, 20],
    ['@media (max-width:600px)', '.reader-shelf-heading h2', 19, 18],
  ]],
  ['src/components/tools/dining-calculator.css', [
    ['', '.dining-intro strong', 19, 18],
    ['', '.dining-per-person>strong', 22, 20],
    ['@media (max-width:560px)', '.dining-per-person>strong', 22, 20],
  ]],
  ['src/components/tools/loan-calculator.css', [
    ['', '.loan-extra-result p strong', 22, 20],
  ]],
  ['src/components/tools/tools.css', [
    ['', '.tool-workspace-header h2', 22, 20],
    ['@media (max-width:639px)', '.tool-converter-row input,.tool-conversion-result output', 22, 20],
  ]],
  ['src/components/tools/unit-price.css', [
    ['', '.unit-price-results-heading h3', 22, 20],
    ['@media (max-width:639px)', '.unit-price-intro strong', 15, 14],
    ['@media (max-width:639px)', '.unit-price-result-value>strong', 21, 20],
  ]],
  ['src/components/ui/cards.css', [
    ['', '.ui-segmented__item', 15, 14],
  ]],
  ['src/features/baybay-actions.css', [
    ['@media (max-width:760px)', '.planner-hero h1', 30, 28],
  ]],
  ['src/features/baybay/baybay-answer.css', [
    ['', '.baybay-conversation .bb-emergency__call', 22, 20],
  ]],
  ['src/features/bookings/bookings.css', [
    ['', '.booking-heading h3', 21, 20],
    ['', '.booking-record h2', 19, 18],
    ['@media (max-width:560px)', '.booking-heading h3', 19, 18],
  ]],
  ['src/features/bookings/my-week-bookings.css', [
    ['', '.week-bookings-heading h2', 22, 20],
  ]],
  ['src/features/feedback/feedback-admin.css', [
    ['', '.feedback-admin-heading h2', 19, 18],
  ]],
  ['src/features/guides/guide-article.css', [
    ['', '.gd-contact__number', 22, 20],
    ['', '.gd-contact__note,.gd-contact__address', 15, 14],
    ['@media (min-width:1024px)', '.gd-step__head h2', 22, 20],
  ]],
  ['src/features/member-ui.css', [
    ['', '.member-auth-wordmark', 19, 18],
    ['', '.member-auth-heading h2', 25, 24],
  ]],
  ['src/features/messages/messages-hub.css', [
    ['', '.msg-list__title', 22, 20],
  ]],
  ['src/features/outings/my-week-outings.css', [
    ['', '.week-outings-heading nav a', 14.4, 14],
    ['', '.week-outings button', 14.4, 14],
    ['', '.week-outings-help,.week-outings-toolbar', 14.4, 14],
    ['', '.week-outing-status', 13.12, 13],
    ['', '.week-outing-card p', 14.72, 14],
    ['', '.week-outing-actions a,.week-outing-requests li>a,.week-outings-empty a', 14.4, 14],
    ['', '.week-outing-requests time', 14.4, 14],
  ]],
  ['src/features/outings/outing-cover.css', [
    ['', '.outing-inspiration-context h2', 22, 20],
  ]],
  ['src/features/outings/outing-time-poll.css', [
    ['', '.outing-poll-heading h2', 20.8, 20],
  ]],
  ['src/features/outings/outings.css', [
    ['', '.outing-card h2', 22, 20],
    ['@media (max-width:720px)', '.outing-hero h1', 30, 28],
    ['', '.together-page .outing-card h2', 22, 20],
    ['', '.together-page .outing-detail-head h1', 34, 32],
    ['@media (max-width:720px)', '.together-page .outing-hero h1', 30, 28],
  ]],
  ['src/features/posts/community.css', [
    ['', '.cm-card .ui-sticker[data-tone=price]', 15, 14],
    ['', '.cm-sheet h1', 26, 24],
    ['', '.cm-sheet__price', 22, 20],
  ]],
  ['src/features/profile/me-hub.css', [
    ['', '.me-section__title', 22, 20],
  ]],
  ['src/features/profile/privacy-security.css', [
    ['', '.account-privacy h2', 22, 20],
    ['', '.account-privacy h3', 19, 18],
  ]],
  ['src/features/profile/profile-personal-space.css', [
    ['', '.profile-exploration h2,.profile-private-preferences h2', 21, 20],
    ['@media (max-width:600px)', '.profile-exploration h2,.profile-private-preferences h2', 19, 18],
  ]],
  ['src/features/profile/profile-personality.css', [
    ['', '.profile-identity-name h2', 25, 24],
  ]],
  ['src/styles/attractions.css', [
    ['', '.xp-3d h2', 22, 20],
  ]],
  ['src/styles/event-import.css', [
    ['', '.event-import-header h2', 26, 24],
    ['', '.imported-event-card h3', 19, 18],
    ['@media (max-width:600px)', '.event-import-header h2', 22, 20],
    ['@media (max-width:600px)', '.imported-events-panel .planner-section-head h2', 22, 20],
  ]],
  ['src/styles/modern-messaging.css', [
    ['', '.modern-chat-reaction-picker button', 19, 18],
    ['@media (max-width:640px)', '.modern-chat-welcome h2', 19, 18],
  ]],
  ['src/styles/planner.css', [
    ['', '.planner-map-disclosure>summary::after', 22, 20],
  ]],
];

const normalize = (text: string) => text.replace(/\s+/g, ' ').replace(/\s*([>+~,])\s*/g, '$1').trim();
/** font-size values of one stylesheet by "@media chain|selector". */
function fontSizes(file: string) {
  const found = new Map<string, string[]>();
  postcss.parse(readFileSync(file, 'utf8')).walkDecls('font-size', declaration => {
    const rule = declaration.parent as Rule;
    if (rule.type !== 'rule') return;
    const chain: string[] = [];
    for (let node = rule.parent; node && node.type !== 'root'; node = node.parent) if (node.type === 'atrule') chain.unshift(`@${(node as unknown as { name: string }).name} ${normalize((node as unknown as { params: string }).params)}`);
    const key = `${chain.join(' / ')}|${normalize(rule.selector)}`;
    found.set(key, [...(found.get(key) ?? []), declaration.value.trim()]);
  });
  return found;
}

test('elder modes: no component size the ladder codemod lowered is smaller than before tokens v2 (大 / 特大 / 简洁, phone to desktop)', () => {
  // 69 since UI9-INT dropped the .discovery-modal h2 pin with its dead rule (no markup since the sheets moved to F's Sheet);
  // 68 since UI9-R1-PLAN dropped the planner's own desktop button sizes (行程's buttons are the UI Button: 16px, not 15).
  assert.equal(LOWERED.reduce((sum, [, pins]) => sum + pins.length, 0), 68);
  const cases: Case[] = [];
  for (const width of [390, 768, 1023, 1024, 1440]) for (const reading of [undefined, 'large', 'extra-large'] as const) for (const simple of [false, true]) cases.push({ width, reading, simple });
  const resolvers = cases.map(c => ({ c, px: fsPx(c) }));
  for (const [file, pins] of LOWERED) {
    const sizes = fontSizes(file);
    for (const [media, selector, oldPx, stepPx] of pins) {
      const where = `${file} ${media} ${selector.slice(0, 60)}`;
      const token = `--fs-keep-${stepPx}`;
      const values = sizes.get(`${media}|${selector}`) ?? [];
      assert.ok(values.includes(`var(${token})`), `${where} reads var(${token}) (found: ${values.join(', ') || 'no font-size'})`);
      for (const { c, px } of resolvers) {
        const now = px(token);
        // 标准 keeps the tokens v2 step; main's size below 1rem was lifted to the 16px floor in 简洁显示 (postcss-text-floor).
        if (!c.reading && !c.simple) { assert.equal(now, stepPx, `${where}: ${now}px at 标准 ${c.width}, expected the v2 step`); continue; }
        const old = (c.simple ? Math.max(oldPx, 16) : oldPx) * rootPx(c) / 16;
        assert.ok(now + 0.01 >= old, `${where}: ${now}px < ${old}px before tokens v2 at ${JSON.stringify(c)}`);
      }
    }
  }
  // The phone 特大 heads the captain named: /me 设置 27.5px (not 25), the 404 H1 and a post sheet's H1 32.5px (not 30); UI9-R1
  // rounds them up to whole pixels on the 特大 ladder (30, 35).
  const phoneXl = fsPx({ width: 390, reading: 'extra-large' });
  assert.deepEqual([phoneXl('--fs-keep-20'), phoneXl('--fs-keep-24')], [30, 35]);
});

test('every --fs-keep-<px> a stylesheet reads is a token whose 标准 size is <px>', () => {
  const standard = [fsPx({ width: 390 }), fsPx({ width: 1440 })];
  const read = new Set<string>();
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) { if (!/^src\/(?:opus-bay|data)$/.test(path)) walk(path); continue; }
      if (entry.name.endsWith('.css')) for (const match of readFileSync(path, 'utf8').matchAll(/var\((--fs-keep-(\d+))\)/g)) read.add(`${match[1]}|${match[2]}`);
    }
  };
  walk('src');
  assert.ok(read.size >= 7, `${read.size} kept steps in use`);
  for (const entry of read) {
    const [token, step] = entry.split('|');
    for (const px of standard) assert.equal(px(token), Number(step), `${token} at 标准`);
  }
});
