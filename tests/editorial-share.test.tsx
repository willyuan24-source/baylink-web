import assert from 'node:assert/strict';
import test, { after, afterEach, beforeEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://www.baylink.us/this-month', pretendToBeVisual: true,
});
const browserGlobals = {
  window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node,
  localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true,
};
const previousGlobals = new Map(Object.keys(browserGlobals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
for (const [key, value] of Object.entries(browserGlobals)) {
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
}
const originalFetch = globalThis.fetch;
const { render, fireEvent, cleanup, act, within } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { setLocale } = await import('../src/i18n/locale');
const { eventShare, offerShare, openingShare, guideShare, editorialShareUrl, editorialShareText, shareCardPath } = await import('../src/lib/editorial-share');
const { cardLines, renderShareCardSvg } = await import('../src/lib/share-card-svg');
const { localDiscoveries, getLocalDiscovery, discoveryShare } = await import('../src/data/local-discoveries');
const { getGuideBySlug } = await import('../src/data/guides');
const { EditorialShareActions } = await import('../src/components/EditorialShareActions');
const { LocalDiscoveryDetail } = await import('../src/components/LocalDiscoveryDetail');

const event = localDiscoveries.find(item => item.kind === 'event')!.event;
const offer = localDiscoveries.find(item => item.kind === 'offer' && item.offer.endDate)!.offer;
const shop = localDiscoveries.find(item => item.kind === 'opening')!.shop;
const guide = getGuideBySlug('bay-area-freebies-deals-2026-10')!;
const card = offerShare(offer);
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5FoAAAAASUVORK5CYII=', 'base64');
const setBrowserProperty = (key: string, value: unknown) => Object.defineProperty(navigator, key, { configurable: true, value });
const setLegacyCopy = (copy: () => boolean) => Object.defineProperty(document, 'execCommand', { configurable: true, value: copy });
const setClipboard = (copy: (text: string) => Promise<void>) => setBrowserProperty('clipboard', { writeText: copy });
const pngResponse = () => new Response(png, { status: 200, headers: { 'content-type': 'image/png' } });
const clickShare = async (view: ReturnType<typeof render>) => {
  await act(async () => { fireEvent.click(view.getByRole('button', { name: `分享：${card.title}`, exact: true })); });
};
const openCard = async (view: ReturnType<typeof render>) => {
  await act(async () => { fireEvent.click(view.getByRole('button', { name: `分享卡片：${card.title}`, exact: true })); });
  return within(view.getByRole('dialog', { name: 'BAYLINK 分享卡片' }));
};

beforeEach(async () => {
  await setLocale('zh-Hans', false);
  for (const key of ['share', 'canShare', 'clipboard']) Reflect.deleteProperty(navigator, key);
  setLegacyCopy(() => false);
  globalThis.fetch = async () => { throw new Error('Unexpected network request in editorial sharing test'); };
});
afterEach(async () => {
  cleanup();
  await setLocale('zh-Hans', false);
  for (const key of ['share', 'canShare', 'clipboard']) Reflect.deleteProperty(navigator, key);
  Reflect.deleteProperty(document, 'execCommand');
  dom.window.history.replaceState(null, '', '/this-month');
  dom.window.localStorage.clear();
  globalThis.fetch = originalFetch;
});
after(() => {
  dom.window.close();
  for (const [key, descriptor] of previousGlobals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

test('events, offers, openings and guides share their own public detail URL with only locale and attribution', async () => {
  dom.window.history.replaceState(null, '', '/this-month?lang=en&access_token=private-token&draft=private-draft#private-fragment');
  const samples = [
    [eventShare(event), `/events/${event.id}`],
    [offerShare(offer), `/offers/${offer.id}`],
    [openingShare(shop), `/openings/${shop.id}`],
    [guideShare(guide), `/guides/${guide.slug}`],
  ] as const;
  for (const locale of ['zh-Hans', 'zh-Hant', 'en'] as const) {
    await setLocale(locale, false);
    for (const [item, expectedPath] of samples) {
      const url = new URL(editorialShareUrl(item));
      assert.equal(url.origin, 'https://www.baylink.us');
      assert.equal(url.pathname, expectedPath);
      assert.equal(url.searchParams.get('from'), 'share');
      assert.equal(url.searchParams.get('lang'), locale === 'zh-Hans' ? null : locale);
      assert.deepEqual([...url.searchParams.keys()].sort(), locale === 'zh-Hans' ? ['from'] : ['from', 'lang']);
      assert.equal(url.hash, '');
      const text = editorialShareText(item);
      assert.match(text, /BAYLINK/);
      assert.ok(text.includes(url.href), 'Copied prose includes the same recipient URL');
      assert.doesNotMatch(text, /private-token|private-draft|private-fragment|access_token/);
    }
  }
});

test('a cancelled native text share does not copy or announce success', async () => {
  const nativePayloads: ShareData[] = [];
  let copies = 0;
  setClipboard(async () => { copies++; });
  setBrowserProperty('share', async (payload: ShareData) => {
    nativePayloads.push(payload);
    throw new DOMException('User dismissed the share sheet', 'AbortError');
  });
  const view = render(<EditorialShareActions item={card} />);
  await clickShare(view);
  assert.equal(nativePayloads.length, 1);
  assert.equal(nativePayloads[0].url, editorialShareUrl(card));
  assert.equal(nativePayloads[0].text, editorialShareText(card));
  assert.equal(copies, 0);
  assert.ok(view.queryByRole('status') === null);
  assert.ok(view.queryByRole('textbox') === null);
  assert.equal(view.getByRole('button', { name: `分享：${card.title}`, exact: true }).hasAttribute('disabled'), false);
});

test('without native sharing, copy success is announced only after the actual clipboard write resolves', async () => {
  let finishCopy!: () => void;
  const writes: string[] = [];
  setClipboard(text => {
    writes.push(text);
    return new Promise<void>(resolve => { finishCopy = resolve; });
  });
  const view = render(<EditorialShareActions item={card} />);
  await clickShare(view);
  assert.deepEqual(writes, [editorialShareText(card)]);
  assert.ok(view.queryByRole('status') === null, 'Pending clipboard access is not a successful copy');
  assert.equal(view.getByRole('button', { name: `分享：${card.title}`, exact: true }).hasAttribute('disabled'), true);
  await act(async () => { finishCopy(); });
  assert.match(view.getByRole('status').textContent!, /分享文案已复制/);
  assert.ok(view.queryByRole('textbox') === null);
});

test('an unsupported native API falls back to a successful legacy copy after clipboard denial', async () => {
  setBrowserProperty('share', async () => { throw new DOMException('Unsupported', 'NotSupportedError'); });
  setClipboard(async () => { throw new Error('Clipboard denied'); });
  const legacyWrites: string[] = [];
  setLegacyCopy(() => {
    legacyWrites.push(document.querySelector('textarea')!.value);
    return true;
  });
  const view = render(<EditorialShareActions item={card} />);
  await clickShare(view);
  assert.deepEqual(legacyWrites, [editorialShareText(card)]);
  assert.match(view.getByRole('status').textContent!, /分享文案已复制/);
  assert.equal(document.querySelector('textarea'), null, 'Temporary copy element is removed');
});

test('when both copying mechanisms fail, a selectable read-only manual link replaces a success notice', async () => {
  setClipboard(async () => { throw new Error('Clipboard denied'); });
  setLegacyCopy(() => false);
  const view = render(<EditorialShareActions item={card} />);
  await clickShare(view);
  assert.equal(view.getByRole('status').textContent, '请手动复制下方链接。');
  const input = view.getByRole('textbox', { name: '手动复制分享链接' }) as HTMLInputElement;
  assert.equal(input.value, editorialShareUrl(card));
  assert.equal(input.readOnly, true);
  fireEvent.focus(input);
  assert.equal(input.selectionStart, 0);
  assert.equal(input.selectionEnd, input.value.length);
  assert.equal(document.querySelector('textarea'), null);
  assert.doesNotMatch(view.baseElement.textContent!, /分享文案已复制/);
});

test('the card modal requests and downloads a same-origin PNG for this specific item', async () => {
  const requested: string[] = [];
  globalThis.fetch = async input => {
    requested.push(String(input));
    return pngResponse();
  };
  const view = render(<EditorialShareActions item={card} />);
  const dialog = await openCard(view);
  assert.deepEqual(requested, [`/share-cards/offer-${offer.id}.png`]);
  const download = dialog.getByRole('link', { name: '保存分享卡片' }) as HTMLAnchorElement;
  const url = new URL(download.href);
  assert.equal(url.origin, window.location.origin);
  assert.equal(url.pathname, `/share-cards/offer-${offer.id}.png`);
  assert.equal(url.search, '');
  assert.equal(download.download, `BAYLINK-${offer.id}.png`);
  const preview = dialog.getByRole('img', { name: `BAYLINK 分享卡片：${card.title}` });
  assert.equal(preview.getAttribute('src'), url.pathname);
  assert.equal(preview.getAttribute('width'), '1200');
  assert.equal(preview.getAttribute('height'), '630');
  assert.equal((dialog.getByRole('textbox') as HTMLInputElement).value, editorialShareUrl(card));
  assert.ok(dialog.queryByRole('status') === null, 'Merely opening a card is not a copy or download success');
});

test('missing or non-PNG card responses keep link sharing available without a download or success claim', async () => {
  for (const response of [
    new Response('not found', { status: 404 }),
    new Response('<html>SPA fallback</html>', { status: 200, headers: { 'content-type': 'text/html' } }),
  ]) {
    globalThis.fetch = async () => response;
    const view = render(<EditorialShareActions item={card} />);
    const dialog = await openCard(view);
    assert.ok(dialog.getByText('卡片暂时无法加载，仍可分享下方链接。'));
    assert.ok(dialog.queryByRole('link', { name: '保存分享卡片' }) === null);
    assert.ok(dialog.queryByRole('button', { name: '分享图片' }) === null);
    assert.ok(dialog.queryByRole('status') === null);
    assert.equal((dialog.getByRole('textbox') as HTMLInputElement).value, editorialShareUrl(card));
    assert.ok(dialog.getByRole('button', { name: '复制文案与链接' }));
    view.unmount();
  }
});

test('a PNG preview decoding failure also disables native image sharing and download', async () => {
  globalThis.fetch = async () => pngResponse();
  setBrowserProperty('canShare', () => true);
  setBrowserProperty('share', async () => {});
  const view = render(<EditorialShareActions item={card} />);
  const dialog = await openCard(view);
  assert.ok(dialog.getByRole('button', { name: '分享图片' }), 'Native file sharing is available after fetching a PNG');
  fireEvent.error(dialog.getByRole('img', { name: `BAYLINK 分享卡片：${card.title}` }));
  assert.ok(dialog.getByText('卡片暂时无法加载，仍可分享下方链接。'));
  assert.ok(dialog.queryByRole('link', { name: '保存分享卡片' }) === null);
  assert.ok(dialog.queryByRole('button', { name: '分享图片' }) === null, 'A failed preview must not leave a broken image share action');
  assert.ok(dialog.queryByRole('status') === null);
});

test('native image sharing receives the PNG file, and dismissing it does not copy or claim success', async () => {
  globalThis.fetch = async () => pngResponse();
  let copies = 0;
  let payload: ShareData | undefined;
  setClipboard(async () => { copies++; });
  setBrowserProperty('canShare', (data: ShareData) => data.files?.[0]?.type === 'image/png');
  setBrowserProperty('share', async (data: ShareData) => {
    payload = data;
    throw new DOMException('Cancelled', 'AbortError');
  });
  const view = render(<EditorialShareActions item={card} />);
  const dialog = await openCard(view);
  await act(async () => { fireEvent.click(dialog.getByRole('button', { name: '分享图片' })); });
  assert.ok(payload?.files);
  assert.equal(payload.files.length, 1);
  assert.equal(payload.files[0].name, `BAYLINK-${offer.id}.png`);
  assert.equal(payload.files[0].type, 'image/png');
  assert.equal(payload.files[0].size, png.length);
  assert.equal(payload.text, editorialShareText(card));
  assert.equal(copies, 0);
  assert.ok(dialog.queryByRole('status') === null);
});

test('SVG cards retain BAYLINK identity and a QR path while escaping hostile editorial text', () => {
  const unsafe = { ...card, title: '<script>alert("x")</script> & 🌉', label: '活动 <安全>', date: '10/25 & "Sunday"', area: '<Oakland>' };
  const qrPath = 'M0 0h7v7H0zM2 2h3v3H2z';
  const logo = 'data:image/png;base64,' + png.toString('base64');
  const svg = renderShareCardSvg(unsafe, qrPath, 21, logo);
  const parsed = new dom.window.DOMParser().parseFromString(svg, 'image/svg+xml');
  assert.equal(parsed.querySelector('parsererror'), null);
  assert.equal(parsed.documentElement.getAttribute('viewBox'), '0 0 1200 630');
  assert.match(parsed.documentElement.textContent!, /BAYLINK/);
  assert.match(parsed.documentElement.textContent!, /YOUR BAY\. YOUR PEOPLE\./);
  assert.match(parsed.documentElement.textContent!, /baylink\.us/);
  assert.match(parsed.documentElement.textContent!, /扫码查看这条详情/);
  assert.equal(parsed.querySelector('script'), null);
  assert.ok(svg.includes('&lt;script&gt;'));
  assert.ok(svg.includes('&amp;'));
  assert.ok(svg.includes('&quot;'));
  assert.equal(parsed.querySelector('image')?.getAttribute('href'), logo);
  assert.equal(parsed.querySelector('svg svg path')?.getAttribute('d'), qrPath);
  assert.equal(parsed.querySelector('svg svg')?.getAttribute('viewBox'), '-4 -4 29 29');
});

test('wrapping and truncation never split a supplementary Unicode character', () => {
  const lines = cardLines('🌉🎉'.repeat(60), 28, 16, 2);
  assert.equal(lines.length, 2);
  assert.ok(lines.at(-1)?.endsWith('…'), 'An overlong title visibly signals truncation');
  assert.ok(lines.join('').includes('🌉'));
  for (const character of Array.from(lines.join(''))) {
    const point = character.codePointAt(0)!;
    assert.ok(point < 0xD800 || point > 0xDFFF, 'No lone UTF-16 surrogate remains');
  }
  assert.equal(shareCardPath({ kind: 'offer', id: 'fixture/slash ?#' }), '/share-cards/offer-fixture%2Fslash%20%3F%23.png');
});

test('recipient detail lookup rejects unknown kinds and IDs, and old offer links still explain their conditions', () => {
  assert.equal(getLocalDiscovery('unknown', event.id), undefined);
  assert.equal(getLocalDiscovery('event', 'not-a-published-event'), undefined);
  assert.equal(getLocalDiscovery('opening', offer.id), undefined);
  assert.equal(getLocalDiscovery('guide', guide.slug), undefined, 'Guide pages have their own route, not a discovery record');
  const item = getLocalDiscovery('offer', offer.id)!;
  assert.equal(discoveryShare(item).path, `/offers/${offer.id}`);
  const view = render(<MemoryRouter><LocalDiscoveryDetail item={item} today="2027-01-01" /></MemoryRouter>);
  assert.equal(view.getByRole('heading', { level: 1 }).textContent, card.title);
  assert.ok(view.getAllByText(offer.requirement).length > 0);
  assert.match(view.baseElement.textContent!, /日期已过/);
  assert.equal(view.getByRole('link', { name: '查看领取入口' }).getAttribute('href'), offer.sourceUrl);
  assert.ok(view.getByRole('button', { name: `分享：${card.title}`, exact: true }));
});
