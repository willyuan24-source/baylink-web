import assert from 'node:assert/strict';
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

const offer = (id: string) => {
  const result = currentFreebies.find(item => item.id === id);
  assert.ok(result, `Missing published offer: ${id}`);
  return result;
};
const renderBoard = (today: string) => new JSDOM(renderToStaticMarkup(
  React.createElement(FreebieBoard, { offers: currentFreebies, today }),
)).window.document;
const hasCard = (document: Document, id: string) => Boolean(document.getElementById(`offer-${id}`));

test('the unified guide preserves valid September anchors and adds 15 distinct local benefits', () => {
  assert.equal(currentFreebies.length, 26);
  assert.equal(newOctoberOffers.length, 15);
  assert.equal(new Set(currentFreebies.map(item => item.id)).size, 26);
  const board = octoberDealsGuides[0].blocks.find(block => block.type === 'freebies');
  assert.ok(board?.type === 'freebies');
  for (const id of ['peets-orange-friday-sep25', 'target-beauty-sep26', 'michaels-ghosts-sep26', 'bampfa-free-oct1']) {
    assert.ok(board.offers.some(item => item.id === id), `Broken monthly-guide anchor: ${id}`);
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
  for (const id of ['sfpl-discover-go', 'smcl-discover-go', 'alameda-county-discover-go', 'santa-clara-library-parks-pass', 'japanese-tea-garden-free-hour']) {
    assert.ok(hasCard(october31, id), `Missing month-end benefit: ${id}`);
  }
  assert.equal(hasCard(october31, 'yogurtland-anniversary-oct20'), false);
  const november1 = renderBoard('2026-11-01');
  for (const id of ['bampfa-free-oct1', 'homedepot-october-preview', 'chm-museums-on-us-oct3-4', 'lowes-firefighting-plane-oct17', 'yogurtland-anniversary-oct20']) {
    assert.equal(hasCard(november1, id), false, `Expired October offer leaked into November: ${id}`);
  }
  assert.ok(hasCard(november1, 'sfpl-discover-go'));
});

test('new offers have official source links, clear conditions and a dated guide with prose entry points', () => {
  const officialHosts = new Set(['bampfa.org', 'sjmusart.org', 'computerhistory.org', 'museumca.org', 'about.asianart.org', 'gggp.org', 'www.lowes.com', 'www.yogurtland.com', 'svma.org', 'sfpl.org', 'smcl.org', 'aclibrary.org', 'parks.santaclaracounty.gov']);
  for (const item of newOctoberOffers) {
    const url = new URL(item.sourceUrl);
    assert.equal(url.protocol, 'https:');
    assert.ok(officialHosts.has(url.hostname), `Non-official source for ${item.id}`);
    assert.ok(item.requirement.length > 20);
    assert.ok(item.sourceLabel.length > 4);
    assert.ok(octoberOfferSources.some(source => source.url === item.sourceUrl));
  }
  const guide = octoberDealsGuides[0];
  assert.equal(guide.slug, 'bay-area-freebies-deals-2026-10');
  assert.equal(guide.editionMonth, '2026-10');
  assert.equal(guide.updatedAt, '2026-09-15');
  assert.match(guide.sourceNote || '', /2026-09-15 核对官方来源/);
  assert.ok(guide.blocks.filter(block => block.type === 'link').length >= 3);
  assert.ok(guide.sources.every(source => source.title && source.description && new URL(source.url).protocol === 'https:'));
});
