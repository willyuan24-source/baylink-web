/** @jsxRuntime automatic */
/** @jsxImportSource @baylink/locale */
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/explore' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, fireEvent, cleanup, act, within } = await import('@testing-library/react');
const { MemoryRouter, useLocation } = await import('react-router-dom');
await import('../src/i18n/router');
const { ATTRACTIONS, ATTRACTION_REGIONS } = await import('../src/data/attractions');
const { getGuideBySlug } = await import('../src/data/guides');
const { getGuideMedia } = await import('../src/data/guide-media');
const { AttractionExplorer } = await import('../src/components/AttractionExplorer');
const { OUTING_STORAGE_KEY, cleanOutingIds, filterAttractions, loadOuting, outingShareUrl, outingText, parseSharedOuting } = await import('../src/lib/attraction-plan');
const { setLocale } = await import('../src/i18n/locale');

afterEach(async () => { cleanup(); localStorage.clear(); await setLocale('zh-Hans', false); });

test('every attraction leads to a published guide with a distinct real photo and every region has coverage', () => {
  assert.equal(ATTRACTIONS.length, 18);
  assert.equal(new Set(ATTRACTIONS.map(item => item.id)).size, ATTRACTIONS.length);
  const images = new Set<string>();
  for (const item of ATTRACTIONS) {
    const guide = getGuideBySlug(item.slug);
    assert.ok(guide, item.slug);
    const cover = getGuideMedia(guide).cover;
    assert.equal(cover.kind, 'photo', item.slug);
    assert.ok(!images.has(cover.src), `${item.slug} must have its own photograph`);
    images.add(cover.src);
  }
  for (const region of ATTRACTION_REGIONS.filter(item => item.id !== 'all')) {
    assert.ok(ATTRACTIONS.filter(item => item.region === region.id).length >= 2, region.id);
  }
});

test('shared lists accept only known IDs, deduplicate, cap stops, and never carry arbitrary destinations', () => {
  assert.deepEqual(parseSharedOuting('filoli,https://evil.example,filoli,<script>,muir-woods'), ['filoli', 'muir-woods']);
  assert.deepEqual(cleanOutingIds({ id: 'filoli' }), []);
  assert.equal(cleanOutingIds(ATTRACTIONS.map(item => item.id)).length, 6);
  const url = new URL(outingShareUrl(['filoli', 'muir-woods'], 'en'));
  assert.equal(url.origin, 'https://www.baylink.us');
  assert.equal(url.pathname, '/explore');
  assert.equal(url.searchParams.get('lang'), 'en');
  assert.deepEqual(parseSharedOuting(url.searchParams.get('plan')), ['filoli', 'muir-woods']);
  localStorage.setItem(OUTING_STORAGE_KEY, '{broken');
  assert.deepEqual(loadOuting(), []);
});

test('admission filters exclude ticketed places from free results and combine with region and interest', async () => {
  const free = filterAttractions(ATTRACTIONS, { cost: 'free', locale: 'zh-Hans' });
  for (const id of ['alcatraz', 'filoli', 'hakone', 'muir-woods']) assert.ok(!free.some(item => item.id === id));
  assert.deepEqual(filterAttractions(ATTRACTIONS, { region: 'north-bay', theme: 'nature', cost: 'paid', locale: 'zh-Hans' }).map(item => item.id), ['muir-woods']);
  await setLocale('zh-Hant');
  assert.ok(filterAttractions(ATTRACTIONS, { query: '舊金山 金門', locale: 'zh-Hant' }).some(item => item.id === 'golden-gate'));
  await setLocale('en');
  assert.deepEqual(filterAttractions(ATTRACTIONS, { query: 'Chinatown North Beach', locale: 'en' }).map(item => item.id), ['chinatown']);
});

test('add, reorder and remove persist the exact user order; a shared link does not overwrite an existing local plan', () => {
  localStorage.setItem(OUTING_STORAGE_KEY, JSON.stringify(['baylands']));
  let currentUrl = '';
  function ObserveLocation() { const location = useLocation(); currentUrl = location.pathname + location.search; return null; }
  const view = render(<MemoryRouter initialEntries={['/explore?lang=zh-Hans&plan=presidio,golden-gate-park']}><ObserveLocation /><AttractionExplorer /></MemoryRouter>);
  const area = within(view.getByRole('region', { name: '我的出游清单' }));
  assert.deepEqual(loadOuting(), ['baylands']);
  assert.equal(area.getAllByRole('listitem').length, 2);
  fireEvent.click(area.getByRole('button', { name: '上移：金门公园与 JFK Promenade' }));
  assert.deepEqual(loadOuting(), ['golden-gate-park', 'presidio']);
  assert.match(area.getAllByRole('listitem')[0].textContent!, /金门公园/);
  fireEvent.click(area.getByRole('button', { name: '移除：Presidio Tunnel Tops' }));
  fireEvent.click(view.getByRole('button', { name: '加入清单：Palo Alto Baylands 湿地' }));
  assert.deepEqual(loadOuting(), ['golden-gate-park', 'baylands']);
  fireEvent.click(view.getByRole('button', { name: '东湾', exact: true }));
  assert.deepEqual(loadOuting(), ['golden-gate-park', 'baylands']);
  assert.equal(area.getAllByRole('listitem').length, 2);
  assert.ok(!new URL(currentUrl, 'https://www.baylink.us').searchParams.has('plan'));
  assert.equal(new URL(currentUrl, 'https://www.baylink.us').searchParams.get('lang'), 'zh-Hans');
  cleanup();
  const reloaded = render(<MemoryRouter initialEntries={[currentUrl]}><AttractionExplorer /></MemoryRouter>);
  const restored = within(reloaded.getByRole('region', { name: '我的出游清单' })).getAllByRole('listitem');
  assert.match(restored[0].textContent!, /金门公园/);
  assert.match(restored[1].textContent!, /Baylands/);
});

test('invalid shared data is harmless and restoring a local plan remains available', () => {
  localStorage.setItem(OUTING_STORAGE_KEY, JSON.stringify(['baylands']));
  const view = render(<MemoryRouter initialEntries={['/explore?plan=unknown,https://evil.example']}><AttractionExplorer /></MemoryRouter>);
  assert.equal(view.queryAllByRole('listitem').length, 0);
  fireEvent.click(view.getByRole('button', { name: '恢复本机清单' }));
  assert.deepEqual(loadOuting(), ['baylands']);
  assert.ok(view.getByRole('button', { name: '移除：Palo Alto Baylands 湿地' }));
});

test('English plan text contains localized guide links and copy failure exposes selectable content', async () => {
  await setLocale('en');
  const exported = outingText(['presidio', 'baylands'], 'en');
  assert.ok(!/[\u3400-\u9fff]/.test(exported), exported);
  assert.ok(exported.includes('/guides/presidio-picnic-day-guide?lang=en'));
  assert.ok(exported.includes('maps/search/?api=1&query='));
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Clipboard unavailable'); } } });
  const view = render(<MemoryRouter initialEntries={['/explore?plan=presidio,baylands']}><AttractionExplorer /></MemoryRouter>);
  await act(async () => { fireEvent.click(view.getByRole('button', { name: 'Copy plan as text' })); });
  assert.equal((view.getByRole('textbox', { name: 'Copy manually' }) as HTMLTextAreaElement).value, exported);
  assert.ok(view.getByText('Please copy the content below.'));
});

test('English filters produce empty states without losing the outing or language parameter', async () => {
  await setLocale('en');
  const view = render(<MemoryRouter initialEntries={['/explore?lang=en&plan=presidio']}><AttractionExplorer /></MemoryRouter>);
  fireEvent.change(view.getByRole('searchbox', { name: 'Search places' }), { target: { value: 'zzzzzz-no-place' } });
  assert.equal(view.queryAllByRole('article').length, 0);
  assert.ok(view.getByRole('button', { name: 'Remove: Presidio Tunnel Tops' }));
  fireEvent.click(view.getByRole('button', { name: 'Reset place filters' }));
  assert.equal(view.getAllByRole('article').length, 18);
});

test('BayBay planning starts only on a click and receives a bounded localized list', async () => {
  await setLocale('en');
  const questions: string[] = [];
  const view = render(<MemoryRouter initialEntries={['/explore?plan=golden-gate,pier39,alcatraz,chinatown,palace,golden-gate-park']}><AttractionExplorer onAsk={question => questions.push(question)} /></MemoryRouter>);
  assert.deepEqual(questions, []);
  fireEvent.click(view.getByRole('button', { name: 'Plan with BayBay' }));
  assert.equal(questions.length, 1);
  assert.ok(questions[0].length <= 500);
  assert.ok(!/[\u3400-\u9fff]/.test(questions[0]), questions[0]);
  assert.ok(questions[0].includes('Alcatraz Island'));
  assert.ok(questions[0].includes('Golden Gate Park & JFK Promenade'));
  assert.ok(questions[0].includes('Do not assume they all fit in one day.'));
});
