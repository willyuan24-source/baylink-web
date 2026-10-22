// UI9-BB: the BayBay panel on F's Sheet — the exit keeps it mounted, focus returns to the opener, 问一下 is never disabled,
// the one frame per screen class, and the BayBay files carry no Sparkles, no animate-spin and no opacity :disabled.
import { mockBayBayFetch } from './baybay-test-transport';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, location: dom.window.location, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage,
  HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
dom.window.HTMLElement.prototype.getClientRects = function () {
  return (this.isConnected && !this.hidden ? [{ width: 1, height: 1 }] : []) as unknown as DOMRectList;
};
dom.window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })) as unknown as typeof dom.window.matchMedia;

const { render, fireEvent, cleanup, act } = await import('@testing-library/react');
const { BayBayAssistantEntry } = await import('../src/components/BayBayAssistantEntry');
const { setSimpleDisplay } = await import('../src/lib/reading-preferences');
afterEach(() => { cleanup(); localStorage.clear(); setSimpleDisplay(false); });
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const noop = () => {};

function Host({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const opener = React.useRef<HTMLButtonElement>(null);
  return <>
    <button type="button" ref={opener} onClick={() => onOpenChange(true)}>问 BayBay</button>
    <BayBayAssistantEntry variant="headless" panelOpen={open} onPanelOpenChange={onOpenChange} restoreFocusRef={opener} onNavigate={noop} onCreatePostClick={noop} />
  </>;
}

test('the panel is F\'s Sheet: it stays mounted through its exit, then returns focus to the opener', async t => {
  mockBayBayFetch(t, async () => Response.json({ ok: true, answer: 'OK' }));
  let open = false;
  const view = render(<Host open={open} onOpenChange={value => { open = value; }} />);
  const opener = view.getByRole('button', { name: '问 BayBay' });
  opener.focus();
  await act(async () => { view.rerender(<Host open onOpenChange={value => { open = value; }} />); });
  const dialog = view.getByRole('dialog', { name: '问 BayBay' });
  assert.ok(dialog.classList.contains('ui-sheet-backdrop') && dialog.classList.contains('baybay-sheet-backdrop'), 'F\'s Sheet backdrop with BayBay\'s hook');
  const sheet = dialog.querySelector('.ui-sheet')!;
  assert.ok(sheet.classList.contains('baybay-sheet') && sheet.classList.contains('baybay-conversation'), 'the panel keeps .baybay-conversation');
  assert.ok(sheet.querySelector('.ui-sheet__body.baybay-scroll'), 'the body scrolls as .baybay-scroll');
  assert.equal(document.getElementById('baybay-panel-title')?.textContent, '问 BayBay');
  assert.ok(sheet.querySelector('[data-baybay-completion]'), 'the completion live region is inside the dialog');
  assert.equal(sheet.querySelectorAll('img[src="/brand/otter.svg"]').length, 1, 'the otter is the one mark');
  assert.ok(view.getByRole('button', { name: '关闭' }).classList.contains('ui-close'), 'the shared Close');
  // Close: the sheet plays its exit (is-closing) and stays in the page until it ends.
  await act(async () => { view.rerender(<Host open={false} onOpenChange={value => { open = value; }} />); });
  const closing = document.querySelector('.baybay-sheet-backdrop');
  assert.ok(closing?.classList.contains('is-closing'), 'the exit plays while the sheet is still mounted');
  await act(async () => { await sleep(260); });
  assert.equal(document.querySelector('.baybay-sheet-backdrop'), null, 'unmounted after the exit');
  assert.equal(document.activeElement, opener, 'focus returns to the opener');
});

test('问一下 is F\'s primary and never disabled; 停止 takes its place as the secondary while a reply is pending', async t => {
  let release: () => void = noop;
  mockBayBayFetch(t, () => new Promise<Response>(resolve => { release = () => resolve(Response.json({ ok: true, answer: '好的。' })); }));
  const view = render(<BayBayAssistantEntry variant="headless" panelOpen onPanelOpenChange={noop} onNavigate={noop} onCreatePostClick={noop} />);
  const send = view.getByRole('button', { name: '问一下' });
  assert.equal(send.getAttribute('data-variant'), 'primary');
  assert.equal((send as HTMLButtonElement).disabled, false, 'empty box: still pressable');
  fireEvent.change(view.getByRole('textbox', { name: '向 BayBay 提问' }), { target: { value: '周' } });
  assert.equal((view.getByRole('button', { name: '问一下' }) as HTMLButtonElement).disabled, false, 'one character: still pressable');
  fireEvent.change(view.getByRole('textbox', { name: '向 BayBay 提问' }), { target: { value: '周末去哪' } });
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '问一下' })); });
  const stop = view.getByRole('button', { name: '停止' });
  assert.equal(stop.getAttribute('data-variant'), 'secondary');
  // The pending turn: three dots and the phase text, no spinner.
  const pending = document.querySelector('.baybay-turn .bb-pending')!;
  assert.equal(pending.querySelectorAll('.bb-dots > span').length, 3);
  assert.equal(document.querySelector('.animate-spin'), null);
  await act(async () => { release(); await sleep(0); });
  await view.findByText('好的。');
});

test('the welcome: one line, two prompt cards with a hint, the other starters then 也可以\'s own chips (two starter chips only in 简洁显示), details, the guest line', async t => {
  mockBayBayFetch(t, async () => Response.json({ ok: true, answer: 'OK' }));
  const view = render(<BayBayAssistantEntry variant="headless" panelOpen onPanelOpenChange={noop} onNavigate={noop} onCreatePostClick={noop} onLoginNeeded={noop} />);
  assert.ok(view.getByText('直接打字，或点一个问题。'));
  assert.equal(document.querySelector('.baybay-context-line'), null, 'the tagline is gone');
  assert.equal(document.querySelector('.bb-welcome h3'), null, 'the welcome h3 is gone');
  const cards = [...document.querySelectorAll('.bb-prompts .bb-prompt')];
  assert.deepEqual(cards.map(card => card.querySelector('.bb-prompt__title')?.textContent), ['本周末去哪', '长辈福利与医保'], 'two cards, not a wall of six (J3 P15)');
  assert.ok(cards.every(card => card.querySelector('.bb-prompt__hint')?.textContent), 'each card has its hint line');
  const chips = [...document.querySelectorAll('.bb-also .ui-chip')].map(chip => chip.textContent);
  assert.deepEqual(chips, ['帮我看懂英文信', '办事怎么准备', '安排一天', '读活动截图', '找搭子一起去', '找本地服务', '沟通帮手', '学校与入学'], 'the other starters lead 也可以 as chips');
  const welcome = document.querySelector('.bb-welcome')!;
  const order = [...welcome.children].map(child => child.className.split(' ')[0]);
  assert.deepEqual(order, ['bb-prompts', 'bb-also', 'ui-disclosure', 'bb-guest-line']);
  assert.equal(welcome.querySelector('details')?.querySelector('summary')?.getAttribute('aria-expanded'), 'false', 'the shared Disclosure, closed');
  assert.ok(view.getByRole('button', { name: '登录 / 注册，开启联网' }), 'the guest line offers sign-in');
  assert.equal(document.querySelector('.baybay-composer-footer .baybay-access-label'), null, 'guests get no access row in the pinned footer');
  cleanup();
  await act(async () => { setSimpleDisplay(true); });
  render(<BayBayAssistantEntry variant="headless" panelOpen onPanelOpenChange={noop} onNavigate={noop} onCreatePostClick={noop} />);
  assert.equal(document.querySelectorAll('.bb-prompts .bb-prompt').length, 2, '简洁显示: the two cards');
  assert.deepEqual([...document.querySelectorAll('.bb-also .ui-chip')].map(chip => chip.textContent), ['帮我看懂英文信', '办事怎么准备'], '简洁显示: the two draft starters, none of 也可以\'s own four');
});

// UI9-R1 (J3 P15, N11, N12): the two welcome cards take the panel's one card look (the plan, outing and post cards), and
// every corner in the panel's sheet is one radius token (no compound radius of its own; the footer has no fill or corners).
test('the welcome cards take the panel card look; every corner is one radius token', () => {
  const css = readFileSync('src/features/baybay/baybay-panel.css', 'utf8');
  const prompt = /\.baybay-conversation \.bb-prompt \{([^}]*)\}/.exec(css)?.[1] || '';
  assert.match(prompt, /border:1px solid var\(--color-line\);/, 'the 1px decorative line, not a control edge');
  assert.match(prompt, /background:var\(--color-surface\);/, 'white, not the paper fill');
  assert.match(prompt, /border-radius:var\(--r-lg\);/);
  assert.match(css, /\.baybay-outing-card,\.bb-post\) \{[^}]*padding:var\(--sp-3\) var\(--sp-4\); border:1px solid var\(--color-line\); border-radius:var\(--r-lg\); background:var\(--color-surface\);/, 'the same look as the outing and post cards');
  for (const [, value] of css.matchAll(/border(?:-[a-z]+)*-radius:([^;}]+)/g)) assert.match(value.trim(), /^var\(--r-(?:sm|md|lg|xl|pill|circle)\)$/, `radius ${value} is one token`);
  assert.doesNotMatch(/\.baybay-sheet \.ui-sheet__footer \{[^}]*\}/.exec(css)?.[0] || '', /background|radius/, 'the footer shows the sheet\'s own white and corners');
});

const BB_FILES = [
  'src/components/BayBayAssistantEntry.tsx', 'src/components/BayBayAssistantPlan.tsx', 'src/components/BayBayDiscoveryResults.tsx', 'src/components/BayBaySmartCard.tsx',
  'src/components/BayBayOutingResults.tsx', 'src/components/BayBayMatchingPosts.tsx', 'src/components/BayBayPostAssist.tsx', 'src/components/BayBayEvidenceStamp.tsx',
  'src/components/BayBayImportedRequirements.tsx', 'src/features/feedback/BayBayDownvoteReasons.tsx', 'src/features/baybay-conversation.css',
  ...readdirSync('src/features/baybay').map(file => `src/features/baybay/${file}`),
];

test('BayBay files: no Sparkles, no animate-spin, no opacity :disabled, no Tailwind sizes, no font-size literals, no hex', () => {
  for (const file of BB_FILES) {
    const text = readFileSync(file, 'utf8');
    assert.doesNotMatch(text, /\bSparkles\b/, `${file}: the otter is the one mark`);
    assert.doesNotMatch(text, /animate-spin|Loader2/, `${file}: three fading dots, not a spinner`);
    assert.doesNotMatch(text, /:disabled[^{]*\{[^}]*opacity|\[disabled\][^{]*\{[^}]*opacity/, `${file}: F's one disabled look, never a faded opacity`);
    assert.doesNotMatch(text, /text-\[0\.6875rem\]|shadow-rest|rounded-(?:xl|2xl|lg|full)/, `${file}: tokens, not Tailwind sizes, shadows or radii`);
    if (file.endsWith('.css') && file !== 'src/features/baybay-conversation.css') {
      for (const [, value] of text.matchAll(/font-size:([^;}]+)/g)) assert.match(value.trim(), /^var\(--(?:fs|text)-[\w-]+\)$|^inherit$/, `${file}: font-size ${value} is a token`);
      assert.doesNotMatch(text, /#[0-9a-f]{3,8}\b/i, `${file}: no hex colours`);
      assert.doesNotMatch(text, /box-shadow:(?!\s*var\(--e[12]\))/, `${file}: e1 / e2 only`);
      for (const [, value] of text.matchAll(/transition:([^;}]+)/g)) for (const part of value.split(',')) assert.match(part, /var\(--dur-\d\) var\(--ease-\w+\)/, `${file}: transition ${part} on the motion tokens`);
    }
  }
  assert.throws(() => readFileSync('src/components/BayBayFloatingLauncher.tsx'), 'the unused floating launcher is gone');
});

test('the frame: one sheet per screen class, phone height fixed, ≥768 drawer without a dark scrim', () => {
  const css = readFileSync('src/features/baybay/baybay-panel.css', 'utf8');
  assert.match(css, /^\.baybay-sheet \{ height:calc\(100dvh - var\(--chrome-header-height, 3\.5rem\)\); max-height:none; \}$/m);
  const wide = /@media \(min-width:768px\) \{([\s\S]*?)\n\}/.exec(css)?.[1] || '';
  assert.match(wide, /\.baybay-sheet-backdrop \{[^}]*background:transparent; \}/, 'the page stays in view (FC3-08)');
  assert.match(wide, /\.baybay-sheet \{[^}]*width:480px[^}]*animation-name:ui-sheet-left; \}/, 'F\'s drawer keyframes from 768px');
  assert.match(wide, /\.is-closing \.baybay-sheet \{ animation-name:ui-sheet-right; \}/);
  assert.doesNotMatch(css, /member-baybay-overlay|member-baybay-dialog|650px|440px/, 'the old modal and drawer frames are gone');
});
