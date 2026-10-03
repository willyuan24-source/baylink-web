import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { UTILITY_CITIES, utilityGuides } from '../src/data/guides-utilities';
import { UtilityDirectory, UtilityContactDirectory } from '../src/components/UtilityDirectory';
import { utilityCityMatches } from '../src/lib/utility-directory';
import { BROADBAND_MAP_URL } from '../src/data/utility-types';
import { guideBlockText } from '../src/lib/guide-content';
import { guides, getGuideBySlug } from '../src/data/guides';
import { searchGuides } from '../src/lib/guide-search';
import { loadLocale, setLocale, translateEditorial } from '../src/i18n/locale';
import telecom from '../src/data/utilities-telecom.json';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/guides', pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, fireEvent, cleanup } = await import('@testing-library/react');
afterEach(async () => { cleanup(); await setLocale('zh-Hans', false); });
after(() => dom.window.close());

const guide = utilityGuides[0];
const city = (name: string) => UTILITY_CITIES.find(item => item.city === name)!;

test('all nine counties and 101 incorporated municipalities have three service categories and official lookup links', () => {
  assert.equal(UTILITY_CITIES.length, 101);
  assert.equal(new Set(UTILITY_CITIES.map(item => item.city)).size, 101);
  const counts = Object.fromEntries([...new Set(UTILITY_CITIES.map(item => item.county))].map(county => [county, UTILITY_CITIES.filter(item => item.county === county).length]));
  assert.deepEqual(counts, { 'San Francisco': 1, 'San Mateo': 20, 'Santa Clara': 15, Alameda: 14, 'Contra Costa': 19, Marin: 11, Napa: 5, Sonoma: 9, Solano: 7 });
  for (const row of UTILITY_CITIES) {
    assert.equal(row.verifiedAt, '2026-10-02');
    assert.ok(!row.city.startsWith('Unincorporated'));
    assert.equal(new URL(row.municipalUrl).protocol, 'https:');
    for (const category of [row.water, row.electric, row.waste]) {
      assert.ok(category.length > 0, row.city);
      for (const contact of category) {
        assert.ok(contact.name.trim(), row.city);
        const url = new URL(contact.url);
        assert.equal(url.protocol, 'https:', `${row.city}: ${contact.url}`);
        assert.equal(url.username + url.password, '');
        if (contact.phone) assert.ok(contact.phone.replace(/\D/g, '').length >= 10, `${row.city}: ${contact.phone}`);
      }
    }
  }
});

test('known municipal-power and multiple-water-service exceptions remain explicit', () => {
  for (const name of ['Alameda','Palo Alto','Santa Clara','Healdsburg']) {
    assert.ok(city(name).electric.some(contact => !/PG&E|Clean|MCE|Ava|WestLight/i.test(contact.name)), name);
  }
  for (const name of ['San Jose','East Palo Alto','Pleasant Hill','Dixon','Belmont']) assert.ok(city(name).water.length >= 2, name);
  assert.match(JSON.stringify(city('Sebastopol').waste), /Sonoma County Resource Recovery|SCRR/i);
  assert.match(JSON.stringify(city('Redwood City').electric), /WestLight/);
  for (const row of UTILITY_CITIES) for (const provider of row.electric) if (provider.name === 'PG&E') assert.match(provider.phone?.replace(/\D/g,'') || '', /^1?8776606789$/);
});

test('SSR retains every city and its address-check link, and phone links call the displayed numbers', () => {
  const html = renderToStaticMarkup(<UtilityDirectory cities={UTILITY_CITIES} title="City directory" text="Lookup" />);
  const parsed = new JSDOM(html);
  const doc = parsed.window.document;
  assert.equal(doc.querySelectorAll('details.utility-city').length, 101);
  assert.equal(doc.querySelectorAll(`a[href="${BROADBAND_MAP_URL}"]`).length, 101);
  for (const link of doc.querySelectorAll<HTMLAnchorElement>('a[href^="tel:"]')) {
    const digits = link.textContent!.replace(/\D/g, '');
    assert.equal(link.getAttribute('href'), `tel:+${digits.length === 10 ? '1' : ''}${digits}`);
  }
  parsed.window.close();
});

test('city and county filters work together, support Chinese aliases, and recover from an empty result', () => {
  const view = render(<UtilityDirectory cities={UTILITY_CITIES} title="城市目录" text="说明" />);
  const search = view.getByRole('searchbox', {name:'搜索城市或服务商'});
  fireEvent.change(search, {target:{value:'舊金山'}});
  assert.equal(view.container.querySelectorAll('details').length, 2); // Also matches South San Francisco's Chinese alias.
  assert.match(view.container.querySelector('summary')!.textContent!, /San Francisco/);
  fireEvent.change(view.getByLabelText('按县筛选'), {target:{value:'Santa Clara'}});
  assert.equal(view.container.querySelectorAll('details').length, 0);
  assert.ok(view.getByText(/没有找到匹配项/));
  fireEvent.click(view.getByRole('button', {name:'清除筛选'}));
  assert.equal(view.container.querySelectorAll('details').length, 101);
  fireEvent.change(view.getByLabelText('按县筛选'), {target:{value:'San Mateo'}});
  assert.equal(view.container.querySelectorAll('details').length, 20);
  assert.ok(utilityCityMatches(city('Fremont'), '菲利蒙'));
  assert.ok(utilityCityMatches(city('Berkeley'), 'EBMUD'));
});

test('the complete article, city notes and telecom notes have English translations', async () => {
  await loadLocale('en');
  const translated = translateEditorial(guide, 'en');
  assert.doesNotMatch(JSON.stringify(translated), /\p{Script=Han}/u);
  assert.doesNotMatch(translated.blocks.map(guideBlockText).join('\n'), /\p{Script=Han}/u);
  await setLocale('en', false);
  const view = render(<UtilityDirectory cities={UTILITY_CITIES} title="城市联络目录" text="" />);
  assert.ok(view.getByRole('searchbox', {name:'Search city or provider'}));
  fireEvent.change(view.getByRole('searchbox'), {target:{value:'Healdsburg'}});
  assert.doesNotMatch(view.container.textContent || '', /\p{Script=Han}/u);
});

test('search, published article and exported text include all city contacts and the telecom table', () => {
  assert.equal(getGuideBySlug(guide.slug)?.title, guide.title);
  assert.equal(guide.editionMonth, undefined);
  const exported = guide.blocks.map(guideBlockText).join('\n');
  for (const row of UTILITY_CITIES) {
    assert.ok(exported.includes(row.city));
    for (const provider of [...row.water,...row.electric,...row.waste]) {
      assert.ok(exported.includes(provider.url));
      if (provider.phone) assert.ok(exported.includes(provider.phone));
    }
  }
  for (const query of ['Healdsburg','Pleasant Hill','水电','垃圾','Sonic','WestLight']) assert.ok(searchGuides(guides, {query}).some(result => result.guide.slug === guide.slug), query);
  assert.equal(telecom.internet.length, 10);
  assert.equal(telecom.mobile.length, 12);
  const visible = telecom.mobile.find(provider => provider.name === 'Visible')!;
  assert.equal('phone' in visible, false);
  const html = renderToStaticMarkup(<UtilityContactDirectory contacts={telecom.mobile} title="Mobile" text="Help" anchor="utility-mobile-contacts" />);
  assert.ok(html.includes('utility-mobile-contacts'));
  assert.ok(html.includes('tel:+18003310500'));
});
