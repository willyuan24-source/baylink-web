/** @jsxRuntime automatic */
/** @jsxImportSource @baylink/locale */
// UI9-R2-EXPLORE (round-2 cold review, synthesis-r2 R2-17 + N02/N03/N04/N10/N13/N23): /explore's place cards carry their
// picture's chip bottom-left on the caption, just above the place name; the AI 3D postcards keep theirs (DECISIONS 1); every
// expander is the ui Disclosure; the stylesheet keeps the type, weight, link, ring and hover rules the review measured.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import postcss, { type AtRule, type Declaration, type Rule } from 'postcss';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/explore' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, fireEvent, cleanup } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
await import('../src/i18n/router');
const { AttractionExplorer } = await import('../src/components/AttractionExplorer');
const { setLocale } = await import('../src/i18n/locale');

afterEach(async () => { cleanup(); localStorage.clear(); await setLocale('zh-Hans', false); });

const CSS = 'src/styles/attractions.css';
const sheet = postcss.parse(readFileSync(CSS, 'utf8'));
/** Every declaration with its rule's selector and the @media chain around it. */
const decls: { selector: string; media: string; prop: string; value: string }[] = [];
sheet.walkDecls((decl: Declaration) => {
  const rule = decl.parent as Rule;
  if (rule.type !== 'rule') return;
  const media: string[] = [];
  for (let node = rule.parent; node && node.type !== 'root'; node = node.parent) if (node.type === 'atrule') media.unshift((node as AtRule).params.replace(/\s+/g, ''));
  for (const selector of rule.selectors) decls.push({ selector: selector.replace(/\s+/g, ' ').trim(), media: media.join(' / '), prop: decl.prop, value: decl.value.trim() });
});
const valueOf = (selector: string, prop: string) => decls.filter(d => d.selector === selector && d.prop === prop && !d.media).map(d => d.value);

test('R2-17: every place card shows its chip bottom-left on the caption, just above the name; the 3D postcards keep their own badge', async () => {
  for (const locale of ['zh-Hans', 'en'] as const) {
    await setLocale(locale, false);
    const view = render(<MemoryRouter initialEntries={[locale === 'en' ? '/explore?lang=en' : '/explore']}><AttractionExplorer /></MemoryRouter>);
    const cards = [...view.container.querySelectorAll('.attraction-card')];
    assert.equal(cards.length, 12, 'the first page of places');
    for (const card of cards) {
      const name = card.querySelector('h3')!.textContent;
      assert.equal(card.querySelector('.xp-card__media > .ui-cover .ui-provenance'), null, `${name}: no badge left on the picture itself`);
      const caption = card.querySelector('.xp-card__caption')!;
      assert.equal(caption.getAttribute('data-surface'), 'deep', `${name}: the caption is a photo overlay (the lime focus ring)`);
      const chip = caption.firstElementChild!;
      assert.ok(chip.matches('.ui-provenance[data-chip]'), `${name}: the caption opens with the chip`);
      assert.equal(chip.nextElementSibling?.tagName, 'H3', `${name}: the chip sits right above the place name`);
      assert.match(chip.textContent!, locale === 'en' ? /^(?:Photo|Archive photo|Official image|Venue photo|Stock photo)\b/ : /^(?:照片|资料图|官方图|场馆照|示意图)/, `${name}: the badge words of the picture`);
    }
    const postcards = [...view.container.querySelectorAll('.xp-3d__item .ui-cover')];
    assert.equal(postcards.length, 5, 'the 3D rail');
    for (const postcard of postcards) {
      const badge = postcard.querySelector(':scope > .ui-provenance')!;
      assert.ok(badge && !badge.hasAttribute('data-chip'), 'a postcard keeps its top-left ink badge in the picture (DECISIONS 1)');
    }
    cleanup();
  }
});

test('N13: every expander on /explore is the ui Disclosure, and a first stop opens 我的出游清单 at the top', () => {
  const view = render(<MemoryRouter initialEntries={['/explore']}><AttractionExplorer /></MemoryRouter>);
  const summaries = [...view.container.querySelectorAll('summary')];
  assert.ok(summaries.length >= 15, `${summaries.length} expanders: 费用与时长说明, 12 picture credits, 我的出游清单, 更多安排`);
  for (const summary of summaries) {
    assert.ok(summary.matches('.ui-disclosure__summary'), `"${summary.textContent}" is the ui Disclosure's summary`);
    assert.ok(summary.querySelector('svg.ui-disclosure__chevron'), `"${summary.textContent}" has the one chevron`);
  }
  const plan = () => [...view.container.querySelectorAll<HTMLDetailsElement>('details.xp-plan')].find(details => details.querySelector('summary')!.textContent!.startsWith('我的出游清单'))!;
  const heading = view.container.querySelector('.xp-results-heading')!;
  assert.equal(plan().open, false);
  assert.ok(heading.compareDocumentPosition(plan()) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING, 'an empty list waits below the places');
  fireEvent.click(view.getByRole('button', { name: '加入清单：金门大桥与 Fort Point' }));
  assert.equal(plan().open, true, 'the list opens once it has a stop');
  assert.ok(heading.compareDocumentPosition(plan()) & dom.window.Node.DOCUMENT_POSITION_PRECEDING, 'and moves above the places');
});

test('N02 / N03 / N04: the H2s are the section step, place names medium at the kept 20px step, no 13px link line', () => {
  for (const selector of ['.xp-results-heading h2', '.attraction-region-intro h2', '.xp-outing-heading h2']) {
    assert.deepEqual(valueOf(selector, 'font-size'), ['var(--text-section)'], selector);
    assert.deepEqual(valueOf(selector, 'line-height'), ['var(--lh-section)'], selector);
  }
  assert.deepEqual(valueOf('.xp-3d h2', 'font-size'), ['var(--fs-keep-20)'], 'the 3D module keeps its kept step (= the place names, never below them)');
  assert.deepEqual(valueOf('.xp-card__caption h3', 'font-size'), ['var(--fs-keep-20)']);
  assert.deepEqual(valueOf('.xp-card__caption h3', 'font-weight'), ['var(--fw-medium)']);
  assert.deepEqual(valueOf('.xp-3d__name', 'font-weight'), ['var(--fw-medium)']);
  assert.deepEqual(valueOf('.xp-3d__go', 'font-weight'), ['var(--fw-regular)']);
  assert.deepEqual(valueOf('.xp-3d__go', 'font-size'), ['var(--text-fact)'], 'the rail link line is 14px');
  assert.deepEqual(valueOf('.xp-card__caption p', 'font-size'), ['var(--fs-meta)']);
  // 600 only for the headings, the region intro's lead-in, the outing step number and the postcards' own badge (DECISIONS 1).
  const bold = decls.filter(d => d.prop === 'font-weight' && /^(?:600|700|bold)$/.test(d.value)).map(d => d.selector);
  for (const selector of bold) assert.match(selector, /\bh2$|^\.attraction-region-intro strong$|^\.xp-outing-number$|^\.xp-3d__item \.ui-provenance$/, `${selector} is bold`);
});

test('N10 / N13 / N23: one underline offset, no ring literal or halo, every hover answer gated to a pointer that hovers', () => {
  const offsets = decls.filter(d => d.prop === 'text-underline-offset');
  assert.ok(offsets.length >= 5);
  for (const d of offsets) assert.equal(d.value, 'var(--underline-offset)', d.selector);
  assert.equal(decls.filter(d => d.prop === 'box-shadow').length, 0, 'no box-shadow (the caption link had a 4px white halo)');
  assert.equal(decls.filter(d => /^outline/.test(d.prop)).length, 0, 'the site ring (tokens.css) styles focus; a photo overlay turns it lime');
  for (const d of decls.filter(d => d.selector.includes(':hover'))) assert.match(d.media, /\(hover:hover\)and\(pointer:fine\)/, `${d.selector} hovers only with a pointer`);
  assert.equal(decls.filter(d => /(?:^|[\s>+~(,])summary\b/.test(d.selector) || d.value === 'list-item').length, 0, 'no native summary rules left');
  // The chip leaves the cover's absolute corner for the caption's flow; a stand-in's own badge wins over it.
  assert.equal(valueOf('.xp-card__caption>.ui-provenance[data-chip]', 'position')[0], 'static');
  assert.deepEqual(valueOf('.xp-card__media:has(>.ui-cover>.ui-provenance) .xp-card__caption>.ui-provenance', 'display'), ['none']);
});
