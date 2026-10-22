// UI9-R1-TOGETHER (round-1 cold-review fixes for /together): no native date, time or select control on the hub and the
// host forms (DateChips / the ui Select), one filled primary in the head section, the ui-state error and empty states,
// 14px small print, the token disabled look, and the together stylesheets on the type and space scales.
import assert from 'node:assert/strict';
import test, { after, afterEach, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { JSDOM } from 'jsdom';
import postcss from 'postcss';
import type { UserData } from '../src/lib/types';
import type { AppContextValue } from '../src/app/context';
import type { OutingDraft } from '../src/lib/outings';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/together' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, FormData: dom.window.FormData, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const styles = registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
const { render, cleanup, act, within, fireEvent } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { OutingsHub } = await import('../src/features/outings/OutingsHub');
const { OutingForm } = await import('../src/features/outings/OutingForm');
const { OutingFormFrame } = await import('../src/features/outings/OutingDetail');
const { lazyChunk, forgetLostChunks } = await import('../src/lib/chunk-recovery');
const { useOutingSession } = await import('../src/features/outings/outing-session');
const { outingDays, outingTimes, outingLastDay, OUTING_DAYS_AHEAD } = await import('../src/features/outings/outing-copy');
const { api } = await import('../src/lib/api');
const { setLocale } = await import('../src/i18n/locale');
const { measureStyle } = await import('../scripts/check-style-ratchet.mjs');

const now = Date.parse('2026-09-30T18:00:00Z');
const user = { id: 'member', token: 'member-token', nickname: 'Neighbour', email: 'member@example.test', city: 'Fremont', role: 'user', contactType: 'email', contactValue: 'member@example.test', isBanned: false, isPhoneVerified: true } as UserData;
const app = (account: UserData | null) => ({ user: account, blockedUserIds: [], openUserProfile: () => {}, handleToggleBlockUser: () => {}, setShowLogin: () => {}, showToast: () => {} }) as unknown as AppContextValue;
const hub = (path = '/together') => <MemoryRouter initialEntries={[path]}><OutingsHub app={app(null)} /></MemoryRouter>;
const draft: OutingDraft = { title: '周六公园散步', description: '虚构小队。', eventId: null, date: '2026-10-17', startTime: '14:10', endTime: '16:00', city: 'Fremont', venue: 'Public park entrance', capacity: 3, costNote: '各自支付。', transport: 'own', language: 'any' };
function Form() { const session = useOutingSession(user); return <OutingForm initial={draft} session={session} onSaved={() => {}} onCancel={() => {}} />; }
const native = (root: ParentNode) => [
  ...root.querySelectorAll('input[type=date], input[type=time], input[type=datetime-local], input[type=month]'),
  ...[...root.querySelectorAll('select')].filter(select => !select.classList.contains('ui-select__field')),
];

beforeEach(async t => { t.mock.timers.enable({ apis: ['Date'], now }); localStorage.clear(); await setLocale('zh-Hans'); });
afterEach(() => cleanup());
after(() => { styles.deregister(); dom.window.close(); });

test('the hub has no native date, time or select control: date chips (未来 7 天) and the ui Select', async t => {
  t.mock.method(api, 'request', async () => ({ outings: [], nextCursor: null }));
  const view = render(hub()); await view.findByText('还没有符合条件的小队');
  assert.deepEqual(native(view.container), []);
  const dates = view.getByRole('group', { name: '参加日期' });
  assert.deepEqual(within(dates).getAllByRole('button').map(chip => chip.textContent), ['今天', '本周末', '未来 7 天', '选日期']);
  assert.ok(view.container.querySelector('.ui-select>select.ui-select__field[name=language]'), 'the language filter is the ui Select');
  assert.doesNotMatch(view.container.textContent ?? '', /未来7天|7天包含/);
  assert.match(view.container.textContent ?? '', /未来 7 天包含今天/);
  assert.equal((view.getByRole('textbox', { name: '城市（可选）' }) as HTMLInputElement).placeholder, '旧金山 / SF');
});

test('choosing the selected quick range again clears the dates; a URL range that is no quick range reads in words with no chip on', async t => {
  const requests: URLSearchParams[] = [];
  t.mock.method(api, 'request', async (path: string) => { requests.push(new URL(path, 'https://example.test').searchParams); return { outings: [], nextCursor: null }; });
  const view = render(hub()); await view.findByText('还没有符合条件的小队');
  const weekend = () => view.getByRole('button', { name: '本周末' });
  await act(async () => { weekend().click(); }); await view.findByText('10月3日周六 — 10月4日周日');
  assert.equal(weekend().getAttribute('aria-pressed'), 'true');
  assert.equal(requests.at(-1)!.get('dateFrom'), '2026-10-03'); assert.equal(requests.at(-1)!.get('dateTo'), '2026-10-04');
  await act(async () => { weekend().click(); }); await act(async () => {});
  assert.equal(requests.at(-1)!.has('dateFrom'), false); assert.equal(requests.at(-1)!.has('dateTo'), false);
  assert.equal(weekend().getAttribute('aria-pressed'), 'false');
  assert.equal(view.queryByRole('button', { name: '清除日期' }), null);
  cleanup();
  const range = render(hub('/together?dateFrom=2026-10-08&dateTo=2026-10-12')); await range.findByText('还没有符合条件的小队');
  const chips = within(range.getByRole('group', { name: '参加日期' })).getAllByRole('button');
  assert.deepEqual(chips.filter(chip => chip.getAttribute('aria-pressed') === 'true').map(chip => chip.textContent), []);
  assert.ok(range.getByText('10月8日周四 — 10月12日周一'));
  assert.ok(range.getByRole('button', { name: '清除日期' }));
});

test('the results area reserves the empty state height while loading, except on a first frame with the site footer on screen', async t => {
  let release = () => {};
  t.mock.method(api, 'request', () => new Promise(resolve => { release = () => resolve({ outings: [], nextCursor: null }); }));
  const plain = render(hub());
  assert.ok(plain.container.querySelector('.outing-results.is-reserved'), 'no footer on screen: the area keeps its height from the first frame');
  await act(async () => { release(); }); await plain.findByText('还没有符合条件的小队');
  cleanup();
  // A footer in view (jsdom lays everything out at top 0): a cold load's route-wait fallback left it on screen.
  const footer = document.body.appendChild(document.createElement('footer')); footer.className = 'site-footer';
  try {
    const cold = render(hub());
    assert.ok(cold.container.querySelector('.outing-results'));
    assert.equal(cold.container.querySelector('.outing-results.is-reserved'), null, 'the first frame does not push an on-screen footer further');
    await act(async () => { release(); }); await cold.findByText('还没有符合条件的小队');
    assert.ok(cold.container.querySelector('.outing-results.is-reserved'), 'from the first loaded list on, loads keep the height');
  } finally { footer.remove(); }
});

test('one filled primary per view: 筛选小队 is secondary; the empty and error states are the ui states', async t => {
  let fail = true;
  t.mock.method(api, 'request', async () => { if (fail) throw { status: 503 }; return { outings: [], nextCursor: null }; });
  const view = render(hub());
  const alert = await view.findByRole('alert');
  assert.ok(alert.matches('.ui-state[data-kind=error]'), 'the list error is the ui ErrorState');
  assert.equal(view.container.querySelector('.outing-error'), null);
  // Every solid button on the page: .outing-primary (the page's own) and the ui Button's primary.
  const primaries = () => [...view.container.querySelectorAll('.outing-primary, .ui-button[data-variant=primary]')].map(button => button.textContent);
  // A failed load: 重试 is the one solid button; the head's 发起小队 steps down to secondary (UI9-R1 polish).
  assert.deepEqual(primaries(), ['重试']);
  assert.ok(view.getByRole('button', { name: '发起小队' }).classList.contains('outing-secondary'));
  assert.ok(view.getByRole('button', { name: '筛选小队' }).classList.contains('outing-secondary'));
  fail = false;
  await act(async () => { view.getByRole('button', { name: '重试' }).click(); });
  const empty = (await view.findByText('还没有符合条件的小队')).closest('.ui-state');
  assert.equal(empty?.getAttribute('data-kind'), 'empty', 'the empty list is the ui EmptyState (no dashed box)');
  assert.equal(view.container.querySelector('.outing-empty'), null);
  // The empty list: the head's 发起小队 is the one solid button again; the empty state offers it as a secondary.
  assert.deepEqual(primaries(), ['发起小队']);
  const creates = view.getAllByRole('button', { name: '发起小队' });
  assert.equal(creates.length, 2);
  assert.ok(creates[0].classList.contains('outing-primary'));
  assert.equal(creates[1].getAttribute('data-variant'), 'secondary');
});

test('the host form picks days in words and quarter hours from the ui Select, keeping a drafted off-step time', () => {
  const view = render(<MemoryRouter><Form /></MemoryRouter>);
  assert.deepEqual(native(view.container), []);
  const date = view.getByLabelText('参加日期') as HTMLSelectElement, start = view.getByLabelText('集合时间') as HTMLSelectElement;
  assert.ok(date.classList.contains('ui-select__field') && start.classList.contains('ui-select__field'));
  assert.equal(date.value, '2026-10-17'); assert.equal(date.selectedOptions[0].textContent, '10月17日周六');
  assert.equal(start.value, '14:10', 'an AI or saved time off the quarter hours stays selectable');
  assert.doesNotMatch(view.container.textContent ?? '', /\d{1,2}\/\d{1,2}\/\d{4}/);
  const days = [...date.options].map(option => option.value).filter(Boolean);
  assert.equal(OUTING_DAYS_AHEAD, 180, 'the API takes outings up to 180 days ahead');
  assert.equal(days[0], '2026-09-30'); assert.equal(days.at(-1), '2027-03-29'); assert.equal(outingLastDay('2026-09-30'), '2027-03-29');
  assert.equal(outingDays('2026-09-30').length, 181);
  assert.equal(outingDays('2026-09-30', 90).length, 91); assert.equal(outingDays('2026-09-30', 90)[0], '2026-09-30');
  assert.deepEqual(outingDays('2026-09-30', 2, '2026-09-01'), ['2026-09-01', '2026-09-30', '2026-10-01', '2026-10-02']);
  assert.equal(outingTimes().length, 96); assert.deepEqual(outingTimes().slice(0, 3), ['00:00', '00:15', '00:30']);
  assert.ok(outingTimes('14:10').includes('14:10')); assert.equal(outingTimes('25:00').length, 96);
});

const css = (file: string) => readFileSync(file, 'utf8');
const FILES = ['src/features/outings/outings.css', 'src/features/outings/outing-time-poll.css', 'src/features/outings/my-week-outings.css', 'src/pages/together-page.css'];
/** The rules outside the outing-cover block (UI9-IMAGES owns the cover look; those rules are kept as they were). */
const withoutCovers = (text: string) => { const root = postcss.parse(text); root.walkRules(rule => { if (/outing-cover/.test(rule.selector)) rule.remove(); }); root.walkAtRules(at => { if (!at.nodes?.length) at.remove(); }); return root.toString(); };

test('the together stylesheets are on the type and space scales (N01 / N14), outside the cover rules', () => {
  const { counts } = measureStyle(FILES.map(file => ({ file, text: withoutCovers(css(file)) })));
  assert.equal(counts.fontSizeLiteral, 0, 'font sizes read --text-* / --fs-* tokens');
  assert.equal(counts.spacingOffScale, 0, 'padding, margin and gap sit on the --sp-* steps');
  const all = measureStyle(FILES.map(file => ({ file, text: css(file) }))).counts;
  assert.ok(all.fontSizeLiteral <= 4 && all.spacingOffScale <= 3, `cover rules only: ${all.fontSizeLiteral} / ${all.spacingOffScale}`);
});

test('disabled controls use the token look, small print is 14px, the page has no bottom padding and keeps the list height', () => {
  for (const file of FILES) {
    postcss.parse(css(file)).walkRules(rule => {
      if (!/:disabled/.test(rule.selector)) return;
      rule.walkDecls('opacity', () => assert.fail(`${file} ${rule.selector}: disabled by opacity`));
    });
  }
  const outings = postcss.parse(css('src/features/outings/outings.css'));
  const decl = (selector: string, prop: string) => { let value = ''; outings.walkRules(rule => { if (rule.selector === selector && rule.parent?.type === 'root') rule.walkDecls(prop, d => { value = d.value; }); }); return value; };
  assert.equal(decl('.together-page .outing-footnote', 'font-size'), 'var(--text-fact)');
  assert.equal(decl('.together-page :is(.outing-primary,.outing-secondary):disabled', 'color'), 'var(--color-ink-3)');
  assert.equal(decl('.together-page .outing-results.is-reserved', 'min-height'), '20rem');
  assert.equal(decl('.together-page :is(.outing-tabs>button,.outing-cover-modes>button,.outing-cover-options>button):disabled', 'color'), 'var(--color-ink-3)', 'toggles and cover choices have the disabled look');
  assert.equal(decl('.together-page .outing-cover-options>button:disabled strong', 'color'), 'var(--color-ink-3)', 'a disabled cover choice dims its title too');
  outings.walkRules(rule => { if (rule.selector.trim() === '.together-page p') assert.fail('a page-wide p margin reset outranks the component rules (cover picker, poll)'); });
  assert.equal(decl('.together-page.ui-container .outing-cover,.together-page.ui-container .outing-grid .outing-card>.outing-cover', 'border-radius'), 'var(--r-lg)', 'covers keep base corners');
  assert.equal(decl('.together-page .outing-cover-picker', 'border-radius'), 'var(--r-sm)');
  assert.match(outings.toString(), /select:not\(\.ui-select__field\)/, 'the page field rule leaves the ui Select alone');
  assert.match(css('src/pages/together-page.css'), /padding:var\(--sp-5\) var\(--page-gutter\) 0;/);
});


test('the host form loads through the shell chunk guard; a lost chunk keeps /together on screen with 重试 and 返回 (REG-15)', async t => {
  const detail = readFileSync('src/features/outings/OutingDetail.tsx', 'utf8'), hubSource = readFileSync('src/features/outings/OutingsHub.tsx', 'utf8');
  assert.match(detail, /\nconst OutingForm = lazyChunk\(\(\) => import\('\.\/OutingForm'\), m => m\.OutingForm\);/, 'lazyChunk: one retry, the module settled before the pick');
  assert.match(detail, /<OutingFormFrame onBack=\{form\.onCancel\}>\{lead\}<OutingForm \{\.\.\.form\} \/><\/OutingFormFrame>/, 'the lazy form mounts only in its frame');
  assert.doesNotMatch(detail, /\.then\(\w+ => \(\{ default:/, 'no unguarded named-export pick (undefined.OutingForm on a recovery reload)');
  assert.doesNotMatch(hubSource, /<Suspense|<OutingForm /, 'the hub opens the form as OutingHostForm');
  for (const source of [detail, hubSource]) assert.equal((source.match(/<OutingHostForm /g) || []).length, 1, '发起小队 and 编辑安排');
  t.mock.method(console, 'error', () => {});
  t.mock.method(globalThis, 'fetch', async () => new Response('{}'));
  let online = false, loads = 0, back = 0;
  const Lost = lazyChunk(async (): Promise<{ Named: React.ComponentType }> => { loads += 1; if (!online) throw new TypeError('Importing a module script failed.'); return { Named: () => <p>host form</p> }; }, m => m.Named, 1);
  try {
    const view = render(<main><h1>一起去</h1><OutingFormFrame onBack={() => { back += 1; }}><Lost /></OutingFormFrame></main>);
    assert.ok(view.getByRole('status'), 'the status line while the chunk loads');
    await view.findByRole('heading', { name: '表单暂时没能打开' }, { timeout: 1000 });
    assert.equal(loads, 2, 'the load and its one retry');
    assert.ok(view.getByRole('heading', { name: '一起去' }), 'the page stays; the root error page never shows');
    fireEvent.click(view.getByRole('button', { name: '返回' })); assert.equal(back, 1);
    online = true;
    await act(async () => { fireEvent.click(view.getByRole('button', { name: '重试' })); });
    await view.findByText('host form', undefined, { timeout: 1000 });
    assert.equal(loads, 3, '重试 loads the chunk again (a fresh boundary and lazy)');
  } finally { forgetLostChunks(); }
});

test('UI9-R1 polish: 我的小队 for a guest leads with 登录后继续; the language filter is the chip Select; text links and the search icon', async t => {
  t.mock.method(api, 'request', async () => ({ outings: [], nextCursor: null }));
  const mine = render(hub('/together?view=mine'));
  await mine.findByText('登录查看你的申请和小队');
  const solid = [...mine.container.querySelectorAll('.outing-primary, .ui-button[data-variant=primary]')].map(button => button.textContent);
  assert.deepEqual(solid, ['登录后继续'], 'the guest view has one solid button');
  assert.ok(mine.getByRole('button', { name: '发起小队' }).classList.contains('outing-secondary'));
  cleanup();
  const browse = render(hub()); await browse.findByText('还没有符合条件的小队');
  assert.ok(browse.getAllByRole('button', { name: '发起小队' })[0].classList.contains('outing-primary'), 'the browse view: the head leads again');
  // The filter Select keeps the pill (select.css --chip); every form Select takes the field corner.
  assert.ok(browse.container.querySelector('select[name=language]')!.classList.contains('ui-select__field--chip'));
  const field = browse.getByRole('textbox', { name: '搜索小队' }) as HTMLInputElement;
  assert.equal(field.placeholder, '散步、看展、咖啡或集合点');
  assert.notEqual(field.parentElement!.querySelector('svg')!.getAttribute('width'), '16', 'the magnifier is sized by CSS (1em), not a fixed 16px');
  const css = postcss.parse(readFileSync('src/features/outings/outings.css', 'utf8'));
  const decl = (selector: string, prop: string) => { let value: string | undefined; css.walkRules(rule => { if (rule.selector === selector && !(rule.parent?.type === 'atrule')) rule.walkDecls(prop, d => { value = d.value; }); }); return value; };
  assert.equal(decl('.together-page .outing-link-button', 'margin-inline'), 'calc(-1 * var(--sp-2))', 'a text link gives its 8px padding back');
  assert.equal(decl('.together-page .outing-link-button', 'padding'), '0 var(--sp-2)');
  assert.equal(decl('.together-page .outing-search-input svg', 'width'), '1em');
  assert.equal(decl('.together-page .outing-search-input input', 'padding-left'), 'calc(var(--sp-3) * 2 + 1em)');
  const select = postcss.parse(readFileSync('src/components/ui/select.css', 'utf8'));
  let formCorner: string | undefined;
  select.walkRules(rule => { if (rule.selector === '.ui-select>.ui-select__field:not(.ui-select__field--chip)') rule.walkDecls('border-radius', d => { formCorner = d.value; }); });
  assert.equal(formCorner, 'var(--r-md)', 'a form Select has the text field corner');
});
