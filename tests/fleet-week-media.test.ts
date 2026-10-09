import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import federalPublicDomainMedia from '../src/data/federal-pd-media.json';
import octnovExtraImages from '../src/data/octnov-2026-extra-image-updates.json';
import { OCTNOV_EVENT_MEDIA_UPDATES } from '../src/data/octnov-2026-event-photo-aliases';
import { EVENT_CONTEXT_PHOTOS } from '../src/data/event-image-usage';
import { GUIDE_IMAGES } from '../src/data/guide-media';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { PLANNER_EVENTS } from '../src/data/planner-catalog';
import { VERIFIED_EVENT_PLACE_MEDIA_UPDATES, VERIFIED_PLACE_PHOTO_ALIASES } from '../src/data/verified-place-media-updates';
import { loadLocale, translateEditorial, translateText } from '../src/i18n/locale';
import { getImageProvenance } from '../src/lib/image-provenance';
import { getListingImage } from '../src/lib/offer-media';

const FLEET_WEEK = 'san-francisco-fleet-week-2026';
const PHOTO = 'dvids-blue-angels-sffw-2024';
const event = () => MONTHLY_EVENTS.find(item => item.id === FLEET_WEEK)!;
const record = () => federalPublicDomainMedia.find(item => item.key === PHOTO)!;

test('Fleet Week shows the reviewed U.S. Navy Blue Angels photograph, not the Fisherman’s Wharf venue sign', () => {
  assert.equal(event().imageKey, PHOTO);
  assert.equal(PLANNER_EVENTS.find(item => item.id === FLEET_WEEK)?.imageKey, PHOTO, 'planner and Little Bay read the same image');
  const image = getListingImage(PHOTO)!;
  assert.ok(image, 'listing cards and the detail page resolve the photo');
  assert.equal(image.kind, 'photo');
  assert.equal(image.fullFrame, undefined, 'a landscape photo is cropped by cards, not letterboxed');
  assert.deepEqual([image.width, image.height], [1280, 853]);
  // An event-specific photograph of a past Fleet Week, not an approved venue/theme alias.
  assert.equal(Object.hasOwn(VERIFIED_PLACE_PHOTO_ALIASES, PHOTO), false);
  assert.equal(Object.hasOwn(EVENT_CONTEXT_PHOTOS, PHOTO), false);
  assert.ok(!VERIFIED_PLACE_PHOTO_ALIASES['verified-fishermans-wharf'].caption.includes('Fleet Week'), 'the wharf sign no longer mentions Fleet Week');
  assert.equal(MONTHLY_EVENTS.find(item => item.id === 'sf-fishermans-wharf-chowder-fest-2026')?.imageKey, 'verified-fishermans-wharf');
});

test('the Fleet Week photo carries honest DVIDS attribution, a 2024 archive label and no official-image claim', () => {
  const image = GUIDE_IMAGES[PHOTO];
  assert.match(image.creditUrl!, /^https:\/\/www\.dvidshub\.net\/image\/\d+\//);
  assert.equal(image.licenseUrl, 'https://www.dvidshub.net/about/copyright');
  assert.match(image.credit, /^U\.S\. Navy photo by Mass Communication Specialist 1st Class Jacob I\. Allison \/ DVIDS \/ Public domain · /);
  assert.match(image.credit, /美国战争部（国防部）.*不意味着也不构成战争部的认可/, 'the DoW non-endorsement notice sits in the credit line');
  assert.doesNotMatch(image.credit, /官方|official/i, 'a public-domain Navy photo is not labelled as an official event image');
  assert.match(image.caption, /^2024 年/, 'the capture year is the first year in the caption');
  assert.match(image.caption, /资料照片/);
  assert.match(image.caption, /练习飞行/, 'the frame is the practice day before the 2024 show');
  assert.match(image.caption, /不是 2026 年/);
  assert.match(image.caption, /以官方日程为准/);
  assert.equal(getImageProvenance(image), '资料图 · 2024');
  assert.equal(getImageProvenance(image, true), 'Archive photo · 2024');
});

test('the DVIDS record keeps its image id, VIRIN, capture date and rendition consistent', () => {
  const source = record();
  assert.ok(source, 'the photo has its original attribution record');
  for (const field of ['src', 'alt', 'caption', 'credit', 'creditUrl', 'licenseUrl', 'width', 'height'] as const) {
    assert.equal(GUIDE_IMAGES[PHOTO][field], source[field], field);
  }
  // The srcset comes from the D8 image ladder: a 58 KB original needs no 800/1200 rung, so it stays 480 w small + original.
  assert.equal(GUIDE_IMAGES[PHOTO].srcSet, `${source.src.replace(/\.webp$/, '-small.webp')} 480w, ${source.src} ${source.width}w`);
  assert.equal(/^https:\/\/www\.dvidshub\.net\/image\/(\d+)\//.exec(source.creditUrl)?.[1], source.dvidsImageId);
  const original = new URL(source.originalUrl);
  assert.equal(original.protocol, 'https:');
  assert.equal(original.hostname, 'd1ldvf68ux039x.cloudfront.net', 'the public DVIDS CDN rendition');
  assert.equal(/^\/thumbs\/photos\/\d{4}\/(\d+)\//.exec(original.pathname)?.[1], source.dvidsImageId);
  // A VIRIN starts with the capture date (YYMMDD) and the service letter (N = U.S. Navy).
  const [, yymmdd, service] = /^(\d{6})-([A-Z])-[A-Z0-9]+-\d+$/.exec(source.virin) ?? [];
  assert.equal(`20${yymmdd.slice(0, 2)}-${yymmdd.slice(2, 4)}-${yymmdd.slice(4)}`, source.photoDate);
  assert.equal(service, 'N');
  assert.match(source.credit, /^U\.S\. Navy photo/);
  assert.ok(source.caption.startsWith('2024 年 10 月 10 日'), 'the caption date matches photoDate');
});

test('later image override maps cannot silently replace the Fleet Week photo', () => {
  assert.equal(VERIFIED_EVENT_PLACE_MEDIA_UPDATES[FLEET_WEEK].imageKey, PHOTO);
  // monthly-edition applies these after the verified map, so an entry there would win.
  assert.equal(Object.hasOwn(OCTNOV_EVENT_MEDIA_UPDATES, FLEET_WEEK), false);
  assert.equal(Object.hasOwn(octnovExtraImages, FLEET_WEEK), false);
});

test('Fleet Week image text is complete in English and in the scoped dictionary event pages load', async () => {
  await loadLocale('en');
  const image = GUIDE_IMAGES[PHOTO];
  const translated = translateEditorial({ event: event(), image }, 'en');
  assert.doesNotMatch(JSON.stringify(translated), /\p{Script=Han}/u);
  assert.match(translated.image.caption, /^2024 archive photo: .*practice flight.*not from the 2026 show/);
  assert.match(translated.image.credit, /does not imply or constitute DoW endorsement$/);
  assert.doesNotMatch(translated.image.credit, /official/i);
  assert.equal(getImageProvenance(translated.image, true), 'Archive photo · 2024');
  const discovery = JSON.parse(readFileSync(new URL('../src/data/generated/english-scopes/discovery.json', import.meta.url), 'utf8')) as Record<string, string>;
  const ui = JSON.parse(readFileSync(new URL('../src/data/generated/english-scopes/ui.json', import.meta.url), 'utf8')) as Record<string, string>;
  for (const text of [image.alt, image.caption, image.credit]) assert.equal({ ...ui, ...discovery }[text], translateText(text, 'en'), text);
});

test('Traditional Chinese keeps the archive-photo disclosure', async () => {
  await loadLocale('zh-Hant');
  const image = GUIDE_IMAGES[PHOTO];
  assert.equal(translateText(getImageProvenance(image), 'zh-Hant'), '資料圖 · 2024');
  const caption = translateText(image.caption, 'zh-Hant');
  assert.match(caption, /^2024 年/);
  assert.match(caption, /資料照片/);
  assert.match(caption, /不是 2026 年/);
  assert.match(translateText(image.credit, 'zh-Hant'), /美國戰爭部（國防部）/);
});
