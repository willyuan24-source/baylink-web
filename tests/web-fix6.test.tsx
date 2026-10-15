// WEB-FIX6: small follow-ups the Wave 5 lanes left (lanes/{WEB-SEO-3,WEB-LINK-2,WEB-COMMUNITY-2,W5-INT}/PR.md): US English
// dates in the UI's own date strings, money on both ends of a price range, a neutral /me 通知 lead while the preferences
// load, and the attraction cards' fallback drawing seeded by the attraction's id. The verifiedAt wording rule has its own
// file (tests/agent-read-wording.test.tsx).
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import React from 'react';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, cleanup, act } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { api } = await import('../src/lib/api');
const { setLocale } = await import('../src/i18n/locale');
const { eventDateChip, eventPriceChip, formatDateChip, offerDeadline, readerDayRange, readerMonthDay } = await import('../src/lib/event-facts');
const { checkLine } = await import('../src/lib/check-dates');
const { monthDay, INDEX_EVENTS } = await import('../src/features/events/events-model');
const { monthDay: homeMonthDay, weekendRange } = await import('../src/features/home/home-model');
const { MONTHLY_EVENTS } = await import('../src/data/monthly-edition');
const { fitSize, textWidth } = await import('../src/lib/share-card-svg');
const { TrustLine, EventRowCard } = await import('../src/features/events/EventCards');
const { TypeCover } = await import('../src/components/ui/TypeCover');
const { NotificationPreferencesCard } = await import('../src/features/profile/NotificationPreferencesCard');
const original = api.request;
afterEach(async () => { cleanup(); api.request = original; localStorage.clear(); await setLocale('zh-Hans', false); });

const MD = /(?:^|[^\d/.:$])(?:1[0-2]|[1-9])\/(?:3[01]|[12]\d|[1-9])(?![\d/%])/u;

test('US English: the date helpers write "Oct 17" on /en and keep "10/17" in Chinese', () => {
  assert.equal(readerMonthDay('2026-10-17'), '10/17');
  assert.equal(readerMonthDay('2026-10-17', true), 'Oct 17');
  assert.equal(readerMonthDay('2026-01-03', true), 'Jan 3');
  assert.equal(readerDayRange('2026-10-17', '2026-10-18'), '10/17–18');
  assert.equal(readerDayRange('2026-10-17', '2026-10-18', true), 'Oct 17–18');
  assert.equal(readerDayRange('2026-10-31', '2026-11-01', true), 'Oct 31–Nov 1');
  assert.equal(monthDay('2026-09-29'), '9/29');
  assert.equal(monthDay('2026-09-29', true), 'Sep 29');
  assert.equal(homeMonthDay('2026-09-29', true), 'Sep 29');
  assert.equal(weekendRange('2026-10-17', '2026-10-18'), '10/17–18');
  assert.equal(weekendRange('2026-10-31', '2026-11-01', true), 'Oct 31–Nov 1');
});

test('US English: date chips, deadlines and check lines read "Sat, Oct 10", "Until Nov 15", "mostly checked Sep 29"', () => {
  const today = '2026-10-08';
  const day = { startDate: '2026-10-10', endDate: '2026-10-10' };
  assert.equal(formatDateChip(eventDateChip(day, today), false).label, '周六 10/10');
  assert.deepEqual(formatDateChip(eventDateChip(day, today), true), { big: 'Oct 10', small: 'Sat', smallFirst: false, label: 'Sat, Oct 10' });
  const run = { startDate: '2026-10-12', endDate: '2026-11-15' };
  assert.equal(formatDateChip(eventDateChip(run, today), true).label, 'From Oct 12');
  assert.equal(formatDateChip(eventDateChip(run, '2026-10-20'), true).label, 'Until Nov 15');
  assert.equal(formatDateChip(eventDateChip(run, '2026-10-20'), false).label, '至 11/15');
  const weekend = { startDate: '2026-10-31', endDate: '2026-11-01' };
  assert.equal(formatDateChip(eventDateChip(weekend, today), true).label, 'Oct 31–Nov 1');
  assert.equal(formatDateChip(eventDateChip(weekend, today), false).label, '10/31–11/1');
  assert.deepEqual(offerDeadline({ endDate: '2026-10-31' }, today)?.text, { zh: '至 10/31', en: 'Until Oct 31' });
  const en = (_: string, english: string) => english, zh = (chinese: string) => chinese;
  assert.equal(checkLine({ mostly: '2026-09-29', latest: '2026-10-12' }, en), 'mostly checked Sep 29 · latest Oct 12');
  assert.equal(checkLine({ mostly: '2026-10-12', latest: '2026-10-12' }, en), 'checked Oct 12');
  assert.equal(checkLine({ mostly: '2026-09-29', latest: '2026-10-12' }, zh), '多数核对于 9/29 · 最近 10/12');
});

test('US English: every event\'s English date still fits a share card\'s cover (374 px at the 44 px floor)', () => {
  const today = '2026-10-15';
  for (const event of MONTHLY_EVENTS) {
    const date = formatDateChip(eventDateChip(event, today), true);
    if (!date.big) continue; // "See details for dates" is not a date (unchanged)
    const big = date.big;
    assert.ok(textWidth(big, fitSize(big, 374, 128, 44)) <= 374, `${event.id}: ${big}`);
    assert.doesNotMatch(date.label, MD, `${event.id}: ${date.label}`);
  }
});

test('US English: the cards\' source check and row date render "Source checked Sep 29" and "Sat, Oct 17" on /en', async () => {
  const event = INDEX_EVENTS.find(item => item.startDate === item.endDate && item.verifiedAt && item.startDate >= '2026-10-15')!;
  assert.ok(event, 'a one-day event in the index');
  const cover = { tier: 'type' } as never;
  for (const english of [false, true]) {
    await setLocale(english ? 'en' : 'zh-Hans', false);
    const view = render(<MemoryRouter><p data-testid="trust"><TrustLine day="2026-09-29" /></p><EventRowCard event={event} cover={cover} today="2026-10-15" day={event.startDate} /></MemoryRouter>);
    assert.equal(view.getByTestId('trust').textContent, english ? 'Source checked Sep 29' : '官网核对 9/29');
    const row = view.container.querySelector('.ui-row-card__date')?.textContent ?? '';
    if (english) { assert.match(row, /^(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat), [A-Z][a-z]{2} \d{1,2}\b/u, row); assert.doesNotMatch(row, MD, row); }
    else assert.match(row, /^周[日一二三四五六] \d{1,2}\/\d{1,2}/u, row);
    cleanup();
  }
});

test('a price range prints money on both ends with one precision: "$22.80–$28.80", "$8–$12", "$9.50–$12.00"', () => {
  assert.deepEqual(eventPriceChip({ cost: 'paid', price: { min: 22.8, max: 28.8 } })?.text, { zh: '$22.80–$28.80', en: '$22.80–$28.80' });
  assert.deepEqual(eventPriceChip({ cost: 'paid', price: { min: 8, max: 12 } })?.text, { zh: '$8–$12', en: '$8–$12' });
  assert.deepEqual(eventPriceChip({ cost: 'paid', price: { min: 9.5, max: 12 } })?.text, { zh: '$9.50–$12.00', en: '$9.50–$12.00' });
  assert.deepEqual(eventPriceChip({ cost: 'paid', price: { min: 22.8 } })?.text, { zh: '$22.80', en: '$22.80' }, 'a single price is unchanged');
  for (const event of MONTHLY_EVENTS) {
    const text = eventPriceChip(event)?.text.en ?? '';
    if (text.includes('–')) assert.match(text, /^\$\d+(?:\.\d\d)?–\$\d+(?:\.\d\d)?$/u, `${event.id}: ${text}`);
  }
});

test('/me 通知: while the preferences load, the lead claims no state (not the preset-off "由你主动选择接收。")', async () => {
  localStorage.setItem('currentUser', JSON.stringify({ id: 'owner', token: 'test-only', email: 'owner@example.test' }));
  api.request = () => new Promise(() => {});
  const leads = { 'zh-Hans': '站外提醒发到你验证过的邮箱或手机。', 'zh-Hant': '站外提醒發到你驗證過的信箱或手機。', en: 'Reminders go to the email or phone you have verified.' } as const;
  for (const locale of ['zh-Hans', 'zh-Hant', 'en'] as const) {
    await setLocale(locale, false);
    let view!: ReturnType<typeof render>;
    await act(async () => { view = render(<NotificationPreferencesCard userId="owner" />); });
    const lead = view.container.querySelector('.me-notify > p')?.textContent ?? '';
    assert.ok(lead.startsWith(leads[locale]), `${locale}: ${lead}`);
    assert.doesNotMatch(lead, /由你主动选择接收|由你主動選擇接收|Choose which reminders/u, locale);
    assert.ok(view.getByRole('button', { name: locale === 'en' ? 'Loading notification settings…' : locale === 'zh-Hant' ? '正在載入通知設定…' : '正在加载通知设置…' }));
    cleanup();
  }
});

test('the attraction cards\' fallback drawing is seeded by the attraction id, so every language draws the same picture', async () => {
  const source = readFileSync(new URL('../src/components/AttractionExplorer.tsx', import.meta.url), 'utf8');
  assert.match(source, /<TypeCover tone="outdoors" family="guide"[^>]*\sseed=\{item\.id\}/u);
  const art = (title: string) => {
    const view = render(<TypeCover tone="outdoors" family="guide" label="" title={title} seed="golden-gate-park" ratio="3:2" ratioLock ariaHidden />);
    const value = view.container.querySelector('[data-art]')?.getAttribute('data-art');
    cleanup();
    return value;
  };
  assert.ok(art('金门公园'));
  assert.equal(art('金门公园'), art('Golden Gate Park'));
});
