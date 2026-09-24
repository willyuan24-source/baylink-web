/** @jsxRuntime automatic */
/** @jsxImportSource @baylink/locale */
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createRef, Fragment, useState } from 'react';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.baylink.us/guides?q=park#reading' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, fireEvent, cleanup, act } = await import('@testing-library/react');
const { MemoryRouter, Link, Routes, Route, useLocation } = await import('react-router-dom');
await import('../src/i18n/router');
const { setLocale, getLocale, translateText, localizedUrl, initializeLocale, LOCALE_KEY } = await import('../src/i18n/locale');
const { LanguageSwitcher } = await import('../src/components/LanguageSwitcher');
const { default: Avatar } = await import('../src/components/Avatar');
const { guides } = await import('../src/data/guides');
const { localDiscoveries } = await import('../src/data/local-discoveries');
const { searchGuides } = await import('../src/lib/guide-search');
const { setPageMetadata } = await import('../src/lib/seo');
const { getGuideMetadata } = await import('../src/lib/guide-metadata');
const { getDiscoveryMetadata } = await import('../src/lib/discovery-metadata');
await import('../src/i18n/metadata');
const han = /[\u3400-\u9fff]/;

afterEach(async () => { cleanup(); await setLocale('zh-Hans', false); localStorage.clear(); window.history.replaceState(null, '', '/guides'); });

test('English exported loan summary retains actual financial values and translated labels', async () => {
  const { LoanCalculatorTool } = await import('../src/components/tools/LoanCalculatorTool');
  await setLocale('en');
  let copied = '';
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { copied = text; } } });
  const view = render(<LoanCalculatorTool onToast={() => {}} />);
  fireEvent.click(view.getByRole('button', { name: translateText('载入贷款示例') }));
  await act(async () => { fireEvent.click(view.getByRole('button', { name: translateText('复制贷款摘要') })); });
  assert.ok(copied.includes('$800,000.00'));
  assert.ok(copied.includes('$200,000.00'));
  assert.ok(copied.includes('6%'));
  assert.ok(!han.test(copied), copied);
});

test('exporting a translated checklist keeps custom tasks verbatim', async () => {
  const { emptyMovingChecklist, movingChecklistText } = await import('../src/lib/moving-checklist');
  const checklist = { ...emptyMovingChecklist(), custom: [{ id: 'custom-one', label: '我的原文任务', done: false }] };
  await setLocale('en');
  const result = movingChecklistText(checklist, translateText);
  assert.ok(result.startsWith('Moving checklist\nCompleted'));
  assert.ok(result.includes('[ ] 我的原文任务'));
  assert.ok(!han.test(result.replace('我的原文任务', '')));
});

test('Traditional editorial conversion resolves known phrase ambiguities', async () => {
  await setLocale('zh-Hant');
  assert.equal(translateText('别拿资料照片当当天开花保证'), '別拿資料照片當當天開花保證');
  assert.equal(translateText('别只凭照片付款'), '別只憑照片付款');
});

test('language changes keep DOM identity, drafts, refs, focus and canonical option values', async () => {
  const inputRef = createRef<HTMLInputElement>();
  let selected = '';
  function Example() {
    const [show, setShow] = useState(false);
    return <div><button onClick={() => setShow(!show)}>显示</button>{show && '生活指南'}
      <input ref={inputRef} placeholder="搜索生活指南" defaultValue="我的原始内容" />
      <textarea placeholder="生活指南" defaultValue="不要转换我的草稿" />
      <select aria-label="分类" onChange={event => { selected = event.target.value; }}><option>租房</option><option>二手</option></select>
      <Link to="/guides">生活指南</Link></div>;
  }
  const view = render(<MemoryRouter><Example /></MemoryRouter>);
  const input = inputRef.current!;
  input.focus(); fireEvent.change(input, { target: { value: 'edited draft' } });
  await act(async () => { await setLocale('zh-Hant'); });
  assert.equal(inputRef.current, input); assert.equal(input.value, 'edited draft'); assert.equal(document.activeElement, input);
  assert.equal(view.container.querySelector('textarea')!.value, '不要转换我的草稿');
  assert.equal(view.getByRole('link').textContent, '生活指南');
  fireEvent.change(view.getByRole('combobox'), { target: { value: '二手' } }); assert.equal(selected, '二手');
  await act(async () => { await setLocale('en'); });
  assert.equal(inputRef.current, input); assert.equal(input.value, 'edited draft');
  assert.ok(!han.test(view.getByRole('link').textContent!));
  assert.ok(!han.test(input.placeholder));
  fireEvent.click(view.getByRole('button'));
  assert.equal(inputRef.current, input); assert.equal(input.value, 'edited draft');
});

test('original posts, messages, names, code and editable content are preserved', async () => {
  const view = render(<div><p>发现湾区</p><section translate="no"><p>发现湾区</p><Link to="/">发现湾区</Link></section><div contentEditable suppressContentEditableWarning>发现湾区</div><code>发现湾区</code></div>, { wrapper: MemoryRouter });
  await act(async () => { await setLocale('zh-Hant'); });
  assert.equal(view.container.querySelector('p')!.textContent, '發現灣區');
  assert.equal(view.container.querySelector('section')!.textContent, '发现湾区发现湾区');
  assert.equal(view.container.querySelector('[contenteditable]')!.textContent, '发现湾区');
  await act(async () => { await setLocale('en'); });
  assert.equal(view.container.querySelector('section')!.textContent, '发现湾区发现湾区');
  assert.equal(view.container.querySelector('code')!.textContent, '发现湾区');
});

test('localized JSX preserves Route and Fragment identities and routed form state', async () => {
  const inputRef = createRef<HTMLInputElement>();
  function RoutedForm() {
    const [draft, setDraft] = useState('原始草稿');
    return <input ref={inputRef} placeholder="发现湾区" value={draft} onChange={event => setDraft(event.target.value)} />;
  }
  render(<MemoryRouter initialEntries={['/compose']}><Routes><Fragment><Route path="/compose" element={<RoutedForm />} /></Fragment></Routes></MemoryRouter>);
  const input = inputRef.current!;
  fireEvent.change(input, { target: { value: '我的未发布内容' } });
  await act(async () => { await setLocale('zh-Hant'); });
  assert.equal(inputRef.current, input);
  assert.equal(input.value, '我的未发布内容');
  assert.equal(input.placeholder, '發現灣區');
  await act(async () => { await setLocale('en'); });
  assert.equal(inputRef.current, input);
  assert.equal(input.value, '我的未发布内容');
  assert.ok(!han.test(input.placeholder));
});

test('avatar initials and accessible names remain the user’s original spelling', async () => {
  const view = render(<div><Avatar name="发现湾区" /><Avatar name="发现湾区" src="/avatar.jpg" /><p>发现湾区</p></div>);
  const avatarInitial = view.container.querySelector('[translate=no]')!;
  const image = view.container.querySelector('img')!;
  await act(async () => { await setLocale('zh-Hant'); });
  assert.equal(avatarInitial.textContent, '发');
  assert.equal(image.getAttribute('alt'), '发现湾区');
  assert.equal(view.container.querySelector('p')!.textContent, '發現灣區');
  await act(async () => { await setLocale('en'); });
  assert.equal(avatarInitial.textContent, '发');
  assert.equal(image.getAttribute('alt'), '发现湾区');
  assert.ok(!han.test(view.container.querySelector('p')!.textContent!));
});

test('language selector keeps route filters and hash while saving preference', async () => {
  function RouteReceipt() { const location = useLocation(); return <output>{location.pathname + location.search + location.hash}</output>; }
  const view = render(<MemoryRouter initialEntries={['/guides?q=park#reading']}><LanguageSwitcher /><RouteReceipt /></MemoryRouter>);
  await act(async () => { fireEvent.change(view.getByRole('combobox'), { target: { value: 'zh-Hant' } }); });
  assert.equal(localStorage.getItem(LOCALE_KEY), 'zh-Hant');
  assert.equal(document.documentElement.lang, 'zh-Hant');
  assert.equal(view.container.querySelector('output')!.textContent, '/guides?q=park&lang=zh-Hant#reading');
});

test('explicit shared language wins over browser preference and sharing preserves hash', async () => {
  localStorage.setItem(LOCALE_KEY, 'zh-Hant');
  window.history.replaceState(null, '', '/guides?lang=en');
  await initializeLocale(); assert.equal(getLocale(), 'en');
  assert.equal(localizedUrl('/guides/example?q=free#board'), 'https://www.baylink.us/guides/example?q=free&lang=en#board');
  await setLocale('zh-Hans');
  assert.equal(localizedUrl('/guides/example?lang=en#board'), 'https://www.baylink.us/guides/example#board');
});

test('first visits follow browser preferences without saving or rewriting an automatic choice', async () => {
  const originalLanguages = Object.getOwnPropertyDescriptor(window.navigator, 'languages');
  const originalLanguage = Object.getOwnPropertyDescriptor(window.navigator, 'language');
  try {
    window.history.replaceState(null, '', '/?ref=friend#discover');
    for (const [languages, expected] of [[['en-US', 'zh-CN'], 'en'], [['zh-HK', 'en'], 'zh-Hant'], [['zh-SG', 'en'], 'zh-Hans'], [['es-MX'], 'en']] as const) {
      Object.defineProperty(window.navigator, 'languages', { configurable: true, value: languages });
      await initializeLocale();
      assert.equal(getLocale(), expected);
      assert.equal(document.documentElement.lang, expected);
      assert.equal(localStorage.getItem(LOCALE_KEY), null);
      assert.equal(window.location.search + window.location.hash, '?ref=friend#discover');
    }
    Object.defineProperty(window.navigator, 'languages', { configurable: true, value: [] });
    Object.defineProperty(window.navigator, 'language', { configurable: true, value: 'zh-TW' });
    await initializeLocale();
    assert.equal(getLocale(), 'zh-Hant');
  } finally {
    if (originalLanguages) Object.defineProperty(window.navigator, 'languages', originalLanguages); else Reflect.deleteProperty(window.navigator, 'languages');
    if (originalLanguage) Object.defineProperty(window.navigator, 'language', originalLanguage); else Reflect.deleteProperty(window.navigator, 'language');
  }
});

test('saved choices and explicit links override detection while invalid values do not block it', async () => {
  const originalLanguages = Object.getOwnPropertyDescriptor(window.navigator, 'languages');
  try {
    Object.defineProperty(window.navigator, 'languages', { configurable: true, value: ['en-US'] });
    localStorage.setItem(LOCALE_KEY, 'zh-Hant');
    await initializeLocale();
    assert.equal(getLocale(), 'zh-Hant');
    window.history.replaceState(null, '', '/?lang=zh-Hans');
    await initializeLocale();
    assert.equal(getLocale(), 'zh-Hans');
    window.history.replaceState(null, '', '/?lang=unsupported');
    localStorage.setItem(LOCALE_KEY, 'unsupported');
    await initializeLocale();
    assert.equal(getLocale(), 'en');
  } finally {
    if (originalLanguages) Object.defineProperty(window.navigator, 'languages', originalLanguages); else Reflect.deleteProperty(window.navigator, 'languages');
  }
});

test('browser detection still works when preference storage is unavailable', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const originalLanguages = Object.getOwnPropertyDescriptor(window.navigator, 'languages');
  try {
    Object.defineProperty(window.navigator, 'languages', { configurable: true, value: ['en-US'] });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { throw new Error('Storage blocked'); } });
    await initializeLocale();
    assert.equal(getLocale(), 'en');
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    if (originalLanguages) Object.defineProperty(window.navigator, 'languages', originalLanguages); else Reflect.deleteProperty(window.navigator, 'languages');
  }
});

test('English guide catalog covers every Chinese editorial string and preserves search identity', async () => {
  await setLocale('en');
  const missing = new Set<string>();
  function check(value: unknown) {
    if (typeof value === 'string' && han.test(value) && translateText(value) === value) missing.add(value);
    else if (Array.isArray(value)) value.forEach(check);
    else if (value && typeof value === 'object') Object.values(value).forEach(check);
  }
  guides.forEach(check);
  assert.deepEqual([...missing], [], 'Untranslated guide strings');
  const found = searchGuides(guides, { query: 'library' });
  assert.ok(found.length > 0);
  assert.ok(found.some(({ guide }) => guide.slug.includes('library')));
  assert.ok(searchGuides(guides, { query: 'Target' }).some(({ guide }) => guide.slug === 'bay-area-freebies-deals-2026-09'));
  await setLocale('zh-Hant');
  assert.ok(searchGuides(guides, { query: '圖書館' }).length > 0);
});

test('metadata follows reading language and retains original canonical URL', async () => {
  setPageMetadata({ title: '生活指南', description: '发现湾区', path: '/guides' });
  await setLocale('zh-Hant');
  assert.equal(document.title, '生活指南');
  assert.equal(document.querySelector('meta[name=description]')!.getAttribute('content'), '發現灣區');
  await setLocale('en');
  assert.ok(!han.test(document.title));
  assert.equal(document.querySelector('meta[property="og:locale"]')!.getAttribute('content'), 'en_US');
  assert.equal(document.querySelector('link[rel=canonical]')!.getAttribute('href'), 'https://www.baylink.us/guides');
});

test('a dated guide title follows language changes in the browser and social metadata', async () => {
  const guide = guides.find(({ slug }) => slug === 'bay-area-freebies-deals-2026-10');
  assert.ok(guide);
  const metadata = getGuideMetadata(guide);
  const sharedPath = `${metadata.path}?lang=en#freebie-board-0`;
  window.history.replaceState(null, '', sharedPath);
  setPageMetadata(metadata);

  const titles = [
    ['zh-Hans', '2026 年 10 月湾区省钱攻略：免费场馆、亲子手工与图书馆门票｜BAYLINK'],
    ['en', 'October 2026 Bay Area savings: free museums, kids workshops and library passes｜BAYLINK'],
    ['zh-Hant', '2026 年 10 月灣區省錢攻略：免費場館、親子手工與圖書館門票｜BAYLINK'],
    ['zh-Hans', '2026 年 10 月湾区省钱攻略：免费场馆、亲子手工与图书馆门票｜BAYLINK'],
  ] as const;
  for (const [locale, title] of titles) {
    await setLocale(locale, false);
    assert.equal(document.title, title, locale);
    assert.equal(document.querySelector('meta[property="og:title"]')!.getAttribute('content'), title, locale);
    assert.equal(document.querySelector('meta[name="twitter:title"]')!.getAttribute('content'), title, locale);
    assert.equal(document.querySelector('link[rel=canonical]')!.getAttribute('href'), `https://www.baylink.us${metadata.path}`);
    assert.equal(window.location.pathname + window.location.search + window.location.hash, sharedPath);
  }
});

test('all published editorial metadata titles translate completely and restore their Chinese originals', async () => {
  const pages = [...guides.map(getGuideMetadata), ...localDiscoveries.map(getDiscoveryMetadata)];
  await setLocale('en', false);
  for (const metadata of pages) {
    setPageMetadata(metadata);
    assert.ok(!han.test(document.title), `${metadata.path}: ${document.title}`);
    assert.equal(document.querySelector('meta[property="og:title"]')!.getAttribute('content'), document.title, metadata.path);
    assert.equal(document.querySelector('meta[name="twitter:title"]')!.getAttribute('content'), document.title, metadata.path);
  }
  await setLocale('zh-Hans', false);
  for (const metadata of pages) {
    setPageMetadata(metadata);
    assert.equal(document.title, metadata.title, metadata.path);
    assert.equal(document.querySelector('meta[property="og:title"]')!.getAttribute('content'), metadata.title, metadata.path);
    assert.equal(document.querySelector('meta[name="twitter:title"]')!.getAttribute('content'), metadata.title, metadata.path);
  }
});
