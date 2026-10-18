// UI9-F (tokens v2) elder-mode rule (captain decision 10-18): in the elder modes (大 / 特大, 简洁显示, and both together) no
// type step is smaller than it was before tokens v2, on a phone or a desktop. The cascade of src/tokens.css is resolved here for each case (media
// width, the html attributes, specificity, then source order) and compared with the old ladder's values (main 58a9c05).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

/** The --fs-* custom properties on <html> for one case. */
function resolveSteps(c: Case) {
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
  const phoneXl = resolveSteps({ width: 390, reading: 'extra-large' });
  assert.equal(phoneXl.title, 32.5); assert.equal(phoneXl.section, 27.5);
  const phoneLarge = resolveSteps({ width: 390, reading: 'large' });
  assert.equal(phoneLarge.title, 29.25); assert.equal(phoneLarge.section, 24.75);
  // 标准 keeps the tokens v2 ladder (24 / 20 on a phone, 32 / 24 on a desktop); only the elder sizes keep the old steps.
  assert.deepEqual([resolveSteps({ width: 390 }).title, resolveSteps({ width: 390 }).section], [24, 20]);
  assert.deepEqual([resolveSteps({ width: 1440, reading: 'extra-large' }).title, resolveSteps({ width: 1440, reading: 'extra-large' }).section], [40, 30]);
});
