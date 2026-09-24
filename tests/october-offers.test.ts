import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { FreebieBoard } from '../src/components/FreebieBoard';
import { currentFreebies, newOctoberOffers, octoberOfferSources } from '../src/data/october-offers';
import { octoberDealsGuides } from '../src/data/guides-october-deals';
import { monthlyDealsGuides } from '../src/data/guides-deals';
import { septemberFreebies } from '../src/data/september-freebies';
import { verifiedSeptemberOffers } from '../src/data/september-offers-update';
import { additionalOctoberOffers } from '../src/data/october-offers-extra';
import { autumnRefreshOffers } from '../src/data/autumn-refresh-offers';
import { GUIDE_IMAGES } from '../src/data/guide-media';

const offer = (id: string) => {
  const result = currentFreebies.find(item => item.id === id);
  assert.ok(result, `Missing published offer: ${id}`);
  return result;
};
const renderBoard = (today: string) => new JSDOM(renderToStaticMarkup(
  React.createElement(FreebieBoard, { offers: currentFreebies, today }),
)).window.document;
const hasCard = (document: Document, id: string) => Boolean(document.getElementById(`offer-${id}`));

test('the unified guide preserves valid September anchors and includes both October benefit batches', () => {
  assert.equal(currentFreebies.length, 32 + autumnRefreshOffers.length);
  assert.equal(newOctoberOffers.length, 15);
  assert.equal(additionalOctoberOffers.length, 7);
  assert.equal(new Set(currentFreebies.map(item => item.id)).size, currentFreebies.length);
  const board = octoberDealsGuides[0].blocks.find(block => block.type === 'freebies');
  assert.ok(board?.type === 'freebies');
  for (const id of ['peets-orange-friday-sep25', 'target-beauty-sep26', 'michaels-ghosts-sep26', 'bampfa-free-oct1']) {
    assert.ok(board.offers.some(item => item.id === id), `Broken monthly-guide anchor: ${id}`);
  }
  for (const item of additionalOctoberOffers) {
    assert.equal(board.offers.filter(offer => offer.id === item.id).length, 1, `Additional benefit must appear once: ${item.id}`);
    assert.ok(!newOctoberOffers.some(offer => offer.id === item.id), 'The second batch must not duplicate the first batch');
  }
});

test('ended giveaways are removed from both data sources and promotional guide prose', () => {
  const removed = ['target-eucerin-sep12', 'lowes-haunted-house-sep12', 'michaels-foam-sep12', 'nothing-bundt-joy-sep15'];
  for (const source of [currentFreebies, septemberFreebies, verifiedSeptemberOffers]) {
    for (const id of removed) assert.equal(source.some(item => item.id === id), false, id);
  }
  // Editorial source notes may state what was removed; the actual promotional prose must not retain it.
  const prose = [...monthlyDealsGuides, ...octoberDealsGuides].map(guide => JSON.stringify({
    title: guide.title, subtitle: guide.subtitle, summary: guide.summary,
    blocks: guide.blocks.filter(block => block.type !== 'freebies'),
  })).join('\n');
  assert.doesNotMatch(prose, /Confetti Bundtlet|La Boulangerie|9\/12｜Marina|9\/15｜Nothing Bundt Cakes|9 月 12 日 10:00–14:00/);
  const html = renderBoard('2026-09-15');
  for (const id of removed) assert.equal(hasCard(html, id), false);
});

test('October workshop dates stay absolute and SMCL eligibility includes residence', () => {
  const homeDepot = offer('homedepot-october-preview');
  assert.equal(homeDepot.title, '10/3 免费做女巫糖果盒');
  assert.equal(homeDepot.dateLabel, '10/3 周六 · 需提前预约');
  assert.doesNotMatch(`${homeDepot.title} ${homeDepot.dateLabel}`, /下月|九月|本月/);
  assert.equal(homeDepot.startDate, '2026-10-03');
  const lowes = offer('lowes-firefighting-plane-oct17');
  assert.equal(lowes.startDate, '2026-10-17');
  assert.equal(lowes.endDate, '2026-10-17');
  assert.match(lowes.sourceUrl, /^https:\/\/www\.lowes\.com\/events\/register\/firefighting-plane$/);
  assert.match(lowes.requirement, /Kids Profile/);
  assert.match(lowes.requirement, /预约/);
  const yogurtland = offer('yogurtland-anniversary-oct20');
  assert.equal(yogurtland.startDate, '2026-10-20');
  assert.equal(yogurtland.endDate, '2026-10-20');
  assert.match(yogurtland.description, /2026 每月 20 日/);
  assert.equal(yogurtland.kind, 'purchase');
  assert.match(yogurtland.requirement, /Real Rewards/);
  const smcl = offer('smcl-discover-go');
  assert.match(smcl.requirement, /居住于 SMCL 服务范围内/);
  assert.match(smcl.requirement, /16 岁及以上/);
  assert.match(smcl.requirement, /eCard 和机构卡不适用/);
  assert.match(JSON.stringify(octoberDealsGuides[0].blocks), /卡号只识别入口，不代表有预约资格/);
});

test('calendar-rule free days are identified and material ticket restrictions remain visible', () => {
  for (const id of ['sjma-free-oct2', 'omca-free-oct4', 'asian-art-free-oct4', 'conservatory-free-oct6', 'botanical-free-oct13']) {
    const item = offer(id);
    assert.match(`${item.requirement} ${item.description}`, /规则/, `Do not present a rule-derived date as a separately announced event: ${id}`);
  }
  assert.match(offer('asian-art-free-oct4').requirement, /特展另付 \$10/);
  assert.match(offer('omca-free-oct4').requirement, /包含特别展览/);
  assert.match(offer('chm-museums-on-us-oct3-4').requirement, /仅持卡人.*同伴不包含/);
  assert.match(offer('santa-clara-library-parks-pass').description, /不含 Uvas Canyon、Sunnyvale Baylands、露营/);
  for (const id of ['ikea-emeryville-as-is-wednesdays', 'poppy-claro-doggie-dinners-fall']) {
    assert.match(offer(id).description, /规则/);
    assert.match(offer(id).description, /未公布.*结束日/);
  }
});

test('new local benefits retain the family, residence, borrowing and purchase restrictions', () => {
  const sfmoma = offer('sfmoma-family-oct25');
  assert.equal(sfmoma.startDate, '2026-10-25');
  assert.equal(sfmoma.endDate, '2026-10-25');
  assert.match(sfmoma.requirement, /18 岁及以下/);
  assert.match(sfmoma.requirement, /最多两位成人/);
  assert.match(sfmoma.requirement, /加价特展需另购票/);
  assert.match(sfmoma.dateLabel, /提前两周/);
  assert.equal(sfmoma.kind, 'reservation');
  const sonoma = offer('sonoma-county-museum-family-oct10');
  assert.equal(sonoma.startDate, '2026-10-10');
  assert.equal(sonoma.endDate, '2026-10-10');
  assert.match(sonoma.dateLabel, /11:00–13:00/);
  assert.match(sonoma.description, /其他时段入馆条件请先确认/);
  const tools = offer('berkeley-tool-lending');
  assert.match(tools.requirement, /超过 18 岁.*Berkeley 居民或本市物业业主/);
  assert.match(tools.requirement, /核验地址或产权/);
  assert.match(tools.requirement, /一次最多 10 件/);
  assert.match(tools.description, /图书证本身不能替代.*居住资格审核/);
  const detector = offer('sfpl-radon-detector-loan');
  assert.match(detector.requirement, /SFPL 图书证/);
  assert.match(detector.requirement, /先到先得.*21 天.*须归还/);
  const ikea = offer('ikea-emeryville-as-is-wednesdays');
  assert.equal(ikea.kind, 'purchase');
  assert.match(ikea.requirement, /IKEA Family.*会员号/);
  assert.match(ikea.requirement, /不能叠加.*不可退/);
  assert.match(ikea.dateLabel, /仅 Emeryville 实体店/);
  const petMeal = offer('poppy-claro-doggie-dinners-fall');
  assert.equal(petMeal.kind, 'purchase');
  assert.match(petMeal.requirement, /供宠物狗享用/);
  assert.match(petMeal.requirement, /天气允许/);
  assert.match(petMeal.requirement, /成人餐饮另付/);
});

test('SSR hides expired offers at September and October boundaries while keeping ongoing benefits', () => {
  const september30 = renderBoard('2026-09-30');
  assert.ok(hasCard(september30, '85c-september-cake'));
  assert.ok(hasCard(september30, 'peets-cold-brew-pass-september'));
  assert.equal(hasCard(september30, 'target-beauty-sep26'), false);
  const october1 = renderBoard('2026-10-01');
  assert.equal(hasCard(october1, '85c-september-cake'), false);
  assert.equal(hasCard(october1, 'peets-cold-brew-pass-september'), false);
  assert.ok(hasCard(october1, 'bampfa-free-oct1'));
  assert.equal(hasCard(renderBoard('2026-10-02'), 'bampfa-free-oct1'), false);
  const october31 = renderBoard('2026-10-31');
  for (const id of ['sfpl-discover-go', 'smcl-discover-go', 'alameda-county-discover-go', 'santa-clara-library-parks-pass', 'japanese-tea-garden-free-hour', 'cantor-stanford-free', 'sfpl-radon-detector-loan', 'berkeley-tool-lending', 'ikea-emeryville-as-is-wednesdays']) {
    assert.ok(hasCard(october31, id), `Missing month-end benefit: ${id}`);
  }
  assert.equal(hasCard(october31, 'yogurtland-anniversary-oct20'), false);
  const november1 = renderBoard('2026-11-01');
  for (const id of ['bampfa-free-oct1', 'homedepot-october-preview', 'chm-museums-on-us-oct3-4', 'lowes-firefighting-plane-oct17', 'yogurtland-anniversary-oct20', 'sonoma-county-museum-family-oct10', 'sfmoma-family-oct25']) {
    assert.equal(hasCard(november1, id), false, `Expired October offer leaked into November: ${id}`);
  }
  assert.ok(hasCard(november1, 'sfpl-discover-go'));
});

test('additional dated family benefits remain visible on their day and expire the next day', () => {
  assert.ok(hasCard(renderBoard('2026-10-10'), 'sonoma-county-museum-family-oct10'));
  assert.equal(hasCard(renderBoard('2026-10-11'), 'sonoma-county-museum-family-oct10'), false);
  assert.ok(hasCard(renderBoard('2026-10-25'), 'sfmoma-family-oct25'));
  assert.equal(hasCard(renderBoard('2026-10-26'), 'sfmoma-family-oct25'), false);
});

test('benefit cards show registered media with its context while retaining the conditions and genuine source', () => {
  const document = renderBoard('2026-09-15');
  for (const item of [...newOctoberOffers, ...additionalOctoberOffers]) {
    const image = GUIDE_IMAGES[item.imageKey];
    assert.ok(image, `${item.id} references registered media`);
    assert.ok(readFileSync(new URL(`../public${image.src}`, import.meta.url)).length > 0, `${item.id} image file exists`);
    assert.ok(image.credit && image.caption);
    const card = document.getElementById(`offer-${item.id}`);
    assert.ok(card, item.id);
    assert.equal(card.querySelector('img')?.getAttribute('src'), image.src);
    assert.equal(card.querySelector('img')?.getAttribute('alt'), image.alt);
    assert.ok(card.textContent?.includes(image.caption));
    if (item.imageNote) assert.ok(card.textContent?.includes(item.imageNote));
    if (image.kind !== 'illustration') assert.equal(new URL(image.creditUrl!).protocol, 'https:');
    assert.ok(card.textContent?.includes(item.title));
    assert.ok(card.textContent?.includes(item.requirement));
    assert.ok([...card.querySelectorAll('a')].some(link => link.getAttribute('href') === item.sourceUrl));
  }
});

test('offer media preserves verified places and labels generic tools, passes and product themes honestly', () => {
  for (const id of ['smcl-discover-go', 'alameda-county-discover-go', 'santa-clara-library-parks-pass']) {
    assert.equal(offer(id).imageKey, 'october-library-culture', `${id} must not use an unrelated SFPL building photo`);
    assert.match(offer(id).imageNote || '', /非真实/);
  }
  for (const [id, key, place] of [
    ['sfpl-radon-detector-loan', 'library', /San Francisco|旧金山/],
    ['cantor-stanford-free', 'region-cantor', /Cantor/],
  ] as const) {
    assert.equal(offer(id).imageKey, key);
    const image = GUIDE_IMAGES[key];
    assert.equal(image.kind, 'photo');
    assert.match(`${image.alt} ${image.caption}`, place);
  }
  assert.match(offer('sfpl-radon-detector-loan').imageNote || '', /非探测器或现有库存/);
  assert.match(offer('berkeley-tool-lending').imageNote || '', /非该馆现场或现有库存/);
  assert.match(offer('ikea-emeryville-as-is-wednesdays').imageNote || '', /非 IKEA 门店或实际库存/);
  assert.match(offer('lowes-firefighting-plane-oct17').imageNote || '', /非本次消防飞机成品/);
  assert.match(offer('poppy-claro-doggie-dinners-fall').imageNote || '', /非餐厅现场或实际套餐/);
});

test('empty or unavailable offer image keys safely omit media without losing conditions or the official link', () => {
  for (const imageKey of ['', 'unregistered-offer-test-image']) {
    const item = { ...offer('cantor-stanford-free'), imageKey };
    const document = new JSDOM(renderToStaticMarkup(React.createElement(FreebieBoard, { offers: [item], today: '2026-09-15' }))).window.document;
    const card = document.getElementById(`offer-${item.id}`)!;
    assert.equal(card.querySelector('img'), null);
    assert.equal(card.querySelector('.bl-freebie-picture-open'), null);
    assert.ok(card.textContent?.includes(item.requirement));
    assert.ok([...card.querySelectorAll('a')].some(link => link.getAttribute('href') === item.sourceUrl));
  }
});

test('new offers have official source links, clear conditions and a dated guide with prose entry points', () => {
  const officialHosts = new Set(['bampfa.org', 'sjmusart.org', 'computerhistory.org', 'museumca.org', 'about.asianart.org', 'gggp.org', 'www.lowes.com', 'www.yogurtland.com', 'svma.org', 'sfpl.org', 'smcl.org', 'aclibrary.org', 'parks.santaclaracounty.gov', 'museumsc.org', 'www.sfmoma.org', 'museum.stanford.edu', 'www.berkeleypubliclibrary.org', 'www.ikea.com', 'www.poppyandclaro.com']);
  for (const item of [...newOctoberOffers, ...additionalOctoberOffers]) {
    const url = new URL(item.sourceUrl);
    assert.equal(url.protocol, 'https:');
    assert.ok(officialHosts.has(url.hostname), `Non-official source for ${item.id}`);
    assert.ok(item.requirement.length > 20);
    assert.ok(item.sourceLabel.length > 4);
    assert.ok(octoberOfferSources.some(source => source.url === item.sourceUrl));
  }
  assert.ok(additionalOctoberOffers.every(item => item.verifiedAt === '2026-09-15'));
  const guide = octoberDealsGuides[0];
  assert.equal(guide.slug, 'bay-area-freebies-deals-2026-10');
  assert.equal(guide.editionMonth, '2026-10');
  assert.equal(guide.updatedAt, '2026-09-23');
  assert.match(guide.sourceNote || '', /部分页面读取受限，相关条款保留 9 月 8–15 日的核查记录/);
  assert.ok(guide.blocks.filter(block => block.type === 'link').length >= 3);
  assert.ok(guide.sources.every(source => source.title && source.description && new URL(source.url).protocol === 'https:'));
});
