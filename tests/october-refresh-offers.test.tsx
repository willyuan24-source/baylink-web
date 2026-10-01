import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FreebieBoard } from '../src/components/FreebieBoard';
import { octoberRefreshOffers } from '../src/data/october-refresh-offers';
import { octoberRefreshOpenings } from '../src/data/october-refresh-openings';
import english from '../src/data/october-refresh-en.json';
import { GUIDE_IMAGES } from '../src/data/guide-media';

const offer = (id: string) => {
  const value = octoberRefreshOffers.find(item => item.id === id);
  assert.ok(value, id);
  return value;
};
const board = (today: string) => renderToStaticMarkup(<FreebieBoard offers={octoberRefreshOffers} today={today} />);

test('the reviewed batch has distinct identities, official source links and complete media', () => {
  assert.equal(octoberRefreshOffers.length, 7);
  assert.equal(octoberRefreshOpenings.length, 2);
  const all = [...octoberRefreshOffers, ...octoberRefreshOpenings];
  assert.equal(new Set(all.map(item => item.id)).size, all.length);
  assert.deepEqual([...new Set(octoberRefreshOffers.map(item => item.region).filter(Boolean))].sort(), ['east-bay', 'north-bay', 'peninsula', 'sf', 'south-bay']);
  const officialHosts = new Set(['www.sfzoo.org', 'www.hayward-ca.gov', 'www.woodsideca.gov', 'www.ikea.com', 'www.sonomamarintrain.org', 'outreach-foundation.org', 'content.govdelivery.com', 'www.sonomacounty.com']);
  for (const item of all) {
    assert.equal(item.verifiedAt, '2026-09-30', item.id);
    const url = new URL(item.sourceUrl);
    assert.equal(url.protocol, 'https:');
    assert.ok(officialHosts.has(url.hostname), item.sourceUrl);
    assert.ok(GUIDE_IMAGES[item.imageKey], item.imageKey);
    assert.equal(GUIDE_IMAGES[item.imageKey].kind, 'illustration', item.imageKey);
  }
});

test('October dates are valid and each dated benefit expires independently in the actual board', () => {
  for (const item of octoberRefreshOffers.filter(item => item.availability === 'dated')) {
    assert.ok(item.startDate && item.endDate);
    assert.equal(new Date(`${item.startDate}T12:00:00Z`).toISOString().slice(0, 10), item.startDate);
    assert.equal(new Date(`${item.endDate}T12:00:00Z`).toISOString().slice(0, 10), item.endDate);
    assert.ok(item.startDate <= item.endDate);
    assert.match(item.endDate, /^2026-10-/);
    assert.ok(board(item.endDate).includes(`id="offer-${item.id}"`), item.id);
    const nextDay = new Date(`${item.endDate}T12:00:00Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    assert.ok(!board(nextDay.toISOString().slice(0, 10)).includes(`id="offer-${item.id}"`), item.id);
  }
  assert.ok(board('2026-11-01').includes('id="offer-smart-youth-senior-fare-free"'));
});

test('resident-only admission and age-based transport are not described as universal freebies', () => {
  const zoo = offer('sf-zoo-resident-free-oct7-2026');
  assert.equal(zoo.startDate, '2026-10-07');
  assert.equal(zoo.kind, 'no-purchase');
  assert.match(zoo.requirement, /仅 San Francisco 居民.*政府签发证件.*一人/);
  assert.match(zoo.description, /停车.*不包含/);
  const smart = offer('smart-youth-senior-fare-free');
  assert.equal(smart.availability, 'ongoing');
  assert.equal(smart.startDate, undefined);
  assert.match(smart.requirement, /0–18.*65.*19–64.*付费/);
  assert.match(smart.description, /不自动包含渡轮或其他公交/);
});

test('physical giveaways preserve household, attendance, waiver and supply conditions', () => {
  const hayward = offer('hayward-compost-giveaway-oct24-2026');
  assert.match(hayward.title, /4 袋/);
  assert.match(hayward.requirement, /Hayward 住户.*waiver.*供应有限/);
  assert.match(hayward.description, /1401 Golf Course Road.*Skywest Drive.*West A Street/);
  const woodside = offer('woodside-compost-workshop-gift-oct12-2026');
  assert.match(woodside.requirement, /现场讲座参加者.*先到先得.*送完即止/);
  assert.match(woodside.description, /未公布结束时间、报名要求/);
});

test('retail discounts require payment and membership, with distinct real 2026 end dates', () => {
  const meal = offer('ikea-family-heritage-meal-oct15-2026');
  const goods = offer('ikea-kustfyr-halloween-oct12-2026');
  assert.equal(meal.kind, 'purchase');
  assert.equal(goods.kind, 'purchase');
  assert.equal(meal.endDate, '2026-10-15');
  assert.equal(goods.endDate, '2026-10-12');
  assert.match(meal.requirement, /IKEA Family.*堂食.*\$7\.99.*\$1\.99.*税前/);
  assert.match(meal.description, /不适用线上.*不是免费儿童餐/);
  assert.match(goods.requirement, /会员.*20%.*不能叠加/);
  assert.equal(meal.region, undefined, 'A multi-region offer must not be assigned to one store region');
});

test('educator registration and opening celebrations do not imply general free entry or a first opening date', () => {
  const tech = offer('tech-teachers-tacos-oct23-2026');
  assert.equal(tech.kind, 'reservation');
  assert.match(tech.requirement, /教育工作者.*报名/);
  assert.match(tech.description, /不是全馆全天免费日/);
  assert.ok(octoberRefreshOpenings.every(item => item.openedOn === undefined));
  const sucre = octoberRefreshOpenings.find(item => item.id === 'sucre-damour-fremont-celebration-2026')!;
  assert.equal(sucre.status, 'open');
  assert.equal(sucre.openingType, 'opening-celebration');
  assert.match(sucre.dateLabel, /10\/11 11:30.*非首营业日/);
  assert.match(sucre.editorTip, /不承诺十月到店有赠品/);
  const deadLetter = octoberRefreshOpenings.find(item => item.id === 'dead-letter-sonoma-new-restaurant-2026')!;
  assert.match(deadLetter.editorTip, /9\/1 是旅游局文章日期，不作开业日/);
});

test('every new Chinese display value has an English translation including restrictions and illustration disclosure', () => {
  const dictionary: Record<string, string> = english;
  for (const item of [...octoberRefreshOffers, ...octoberRefreshOpenings]) {
    for (const value of Object.values(item)) {
      if (typeof value !== 'string' || !/[\u3400-\u9fff]/.test(value)) continue;
      assert.ok(dictionary[value], value);
      assert.doesNotMatch(dictionary[value], /[\u3400-\u9fff]/, value);
    }
  }
});
