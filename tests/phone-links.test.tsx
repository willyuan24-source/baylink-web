import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window), IS_REACT_ACT_ENVIRONMENT: true,
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window), cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { StaticRouter } = await import('react-router');
await import('../src/i18n/router');
const { setLocale, translateText } = await import('../src/i18n/locale');
const { findPhoneNumbers, parsePhoneDirectory } = await import('../src/lib/phone-numbers');
const { linkifyPhones, PhoneText } = await import('../src/lib/phone-links');
const { UtilityDirectory } = await import('../src/components/UtilityDirectory');
const { UTILITY_CITIES } = await import('../src/data/guides-utilities');
const { getGuideBySlug } = await import('../src/data/guides');
const { guideBlockText } = await import('../src/lib/guide-content');

afterEach(async () => { await setLocale('zh-Hans', false); });
const tels = (text: string) => findPhoneNumbers(text).map(match => match.tel);

test('US numbers in the formats the guides and listings use become tel:+1 links', () => {
  for (const [text, want] of [
    ['全州信息线为 800-510-2020。', ['+18005102020']],
    ['请致电 1-800-434-0222；预约时说明需要中文。', ['+18004340222']],
    ['电话 415-677-7556，项目按个人情况评估。', ['+14156777556']],
    ['Call (415) 677-7556 or (800)434-0222.', ['+14156777556', '+18004340222']],
    ['电话（415）677-7556', ['+14156777556']],
    ['415.677.7556 · 415 677 7556', ['+14156777556', '+14156777556']],
    ['+1 650 821 7014 and +14156012119', ['+16508217014', '+14156012119']],
    ['Tel:510-839-2022', ['+15108392022']],
    ['800-743-5000 / 800-743-7782', ['+18007435000', '+18007437782']],
    ['San Francisco：415-355-3555；San Mateo：844-868-0938；Santa Clara：408-350-3200。', ['+14153553555', '+18448680938', '+14083503200']],
    ['Room 101 415-677-7556', ['+14156777556']],
    ['若正在发生医疗紧急情况，请拨 911。', ['911']],
    ['非紧急问题拨 311，市府会转给对应部门。', ['311']],
    ['If someone is in danger, call 911. Call 311 within San Francisco.', ['911', '311']],
    ['撥打 988 心理危機熱線', ['988']],
  ] as const) assert.deepEqual(tels(text), want, text);
});

test('dates, prices, ZIP codes, years, ranges, times, ids and example numbers are never phones', () => {
  for (const text of [
    '2026-10-08', '10/08/2026', '10-12-2026', '2026 年 10 月 8 日', '10 月 17 日（周六）',
    '$1,234.56', '$415-677-7556', '$12–$20', '800-1,000 美元', '$800-$1,200',
    '94110', '94110-1234', 'CA 94110-1234', '2025-2026', '2025–2026 学年', '1999-2000',
    '10-12', '3-5 岁', '100-200 人', '1-2 小时', '9:30-11:00', '10:00–16:00', '12:00-16:00',
    '4156777556', '1234567890', 'ISBN 978-0-306-40615-7', '123-456-7890', '415-677-75561', '415-677-7556-1', '415-677-7556x',
    'https://example.org/415-677-7556', 'https://example.org/?tel=415-677-7556', 'a@415-677-7556', 'id_415-677-7556',
    '415-555-0123', '+1 415 555 0199', '211 Bay Area', 'SF311 网页', '911 事件纪念', '511：深夜交通', 'recall 911', 'call 9110',
  ]) assert.deepEqual(tels(text), [], text);
});

test('linkifyPhones keeps every character of the text and adds an aria-label that says what the tap does', () => {
  const text = '全州信息线为 800-510-2020。紧急情况请拨 911。';
  const html = renderToStaticMarkup(<p>{linkifyPhones(text, { name: '加州老龄事务局' })}</p>);
  const p = new JSDOM(html).window.document.querySelector('p')!;
  assert.equal(p.textContent, text);
  const links = [...p.querySelectorAll('a')];
  assert.deepEqual(links.map(link => link.getAttribute('href')), ['tel:+18005102020', 'tel:911']);
  assert.equal(links[0].getAttribute('aria-label'), '拨打 加州老龄事务局 800-510-2020');
  assert.ok(links.every(link => link.className.split(' ').includes('phone-chip')));
  // Closing punctuation stays on the chip's line instead of starting the next one.
  assert.deepEqual([...p.querySelectorAll('.phone-chip-keep')].map(keep => keep.textContent), ['800-510-2020。', '911。']);
  const english = new JSDOM(renderToStaticMarkup(<p>{linkifyPhones('The line is 800-510-2020. Or call (415) 677-7556 / 800-434-0222')}</p>)).window.document;
  assert.deepEqual([...english.querySelectorAll('.phone-chip-keep')].map(keep => keep.textContent), ['800-510-2020.']);
  assert.equal(english.querySelectorAll('a[href^="tel:"]').length, 3);
  assert.equal(english.querySelector('p')!.textContent, 'The line is 800-510-2020. Or call (415) 677-7556 / 800-434-0222');
  assert.deepEqual(linkifyPhones('没有电话号码的段落。'), ['没有电话号码的段落。']);
  assert.deepEqual(linkifyPhones(''), ['']);
});

test('county lists become label/number pairs; any other sentence is left alone', () => {
  assert.deepEqual(parsePhoneDirectory('Alameda：510-577-1900；Contra Costa：925-229-8434。'), [
    { label: 'Alameda', number: '510-577-1900', tel: '+15105771900' },
    { label: 'Contra Costa', number: '925-229-8434', tel: '+19252298434' },
  ]);
  assert.deepEqual(parsePhoneDirectory('Marin: 415-473-4636; Sonoma: 707-565-4636; Napa/Solano: 707-784-8960.')?.map(entry => entry.label), ['Marin', 'Sonoma', 'Napa/Solano']);
  for (const text of ['全州信息线为 800-510-2020。', 'San Francisco：415-355-3555', '地址：408 22nd Avenue；电话：415-677-7556 转 2。', 'A：B；C：D']) assert.equal(parsePhoneDirectory(text), null, text);
});

const seniorSlug = 'bay-area-chinese-senior-services-referral-guide';

test('PhoneText leaves text without numbers exactly as the host element would have translated it', async () => {
  for (const [locale, prefix] of [['zh-Hans', ''], ['zh-Hant', '/zh-Hant'], ['en', '/en']] as const) {
    await setLocale(locale, false);
    const text = getGuideBySlug(seniorSlug)!.blocks.find(block => block.type === 'paragraph')!;
    const html = renderToStaticMarkup(<StaticRouter location={`${prefix}/`}><p><PhoneText text={guideBlockText(text)} /></p></StaticRouter>);
    assert.equal(new JSDOM(html).window.document.querySelector('p')!.textContent, translateText(guideBlockText(text), locale));
  }
});

test('the utilities directory keeps one tel: link per displayed number, each a 44px row chip', () => {
  const html = renderToStaticMarkup(<UtilityDirectory cities={UTILITY_CITIES.slice(0, 12)} title="City directory" text="Lookup" />);
  const document = new JSDOM(html).window.document;
  const links = [...document.querySelectorAll<HTMLAnchorElement>('a[href^="tel:"]')];
  assert.ok(links.length > 20);
  for (const link of links) {
    assert.equal(link.getAttribute('href'), `tel:+1${link.textContent!.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '')}`);
    assert.match(link.className, /phone-chip--row/);
    assert.match(link.getAttribute('aria-label')!, /^拨打 .+ \d/);
  }
});
