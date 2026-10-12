import assert from 'node:assert/strict';
import test from 'node:test';
import { guides, getGuideBySlug, type Guide } from '../src/data/guides';
import { GUIDE_EDITORIAL, getGuideEditorial, type EditorialCopy, type GuideEditorial } from '../src/data/guide-editorial';
import { GUIDE_COVER_ANSWERS } from '../src/data/guide-editorial/answers';

// The pilot reading aids repeat facts from their article; they never add a number, date, price or phone of their own
// (plan rule 7, WEB-GUIDES brief: "only from facts already in the article"). CNT-GUIDES adds new facts with a source read.
const PILOTS = [
  'bay-area-chinese-senior-services-referral-guide', 'bay-area-medicare-hicap-medi-cal-guide', 'bay-area-dental-care-insurance-low-cost-guide',
  'bay-area-social-security-retirement-preparation-guide', 'bay-area-naturalization-official-path-guide', 'bay-area-free-tax-help-vita-calfile-guide',
  'california-tenant-deposit-rights-help-guide', 'california-driver-license-id-preparation-guide',
];

const articleText = (guide: Guide) => JSON.stringify([guide.title, guide.subtitle, guide.summary, guide.audience, guide.blocks, guide.sources, guide.sourceNote ?? '']);
const copies = (editorial: GuideEditorial): EditorialCopy[] => [
  editorial.cover.question, editorial.cover.title, editorial.cover.answer, ...(editorial.cover.line ? [editorial.cover.line] : []),
  ...(editorial.cover.phone ? [editorial.cover.phone.label] : []),
  ...editorial.keyFacts.flatMap(fact => [fact.label, fact.value]),
  ...(editorial.contacts ?? []).flatMap(contact => [contact.name, ...(contact.languages ?? []), ...(contact.note ? [contact.note] : [])]),
  ...editorial.slides.flatMap(slide => [slide.kicker, slide.title, ...(slide.body ? [slide.body] : []), ...(slide.items ?? []), ...(slide.phones ?? []).map(phone => phone.label)]),
  ...(editorial.steps ?? []).filter((step): step is EditorialCopy => !!step),
];
const digitRuns = (text: string) => [...text.matchAll(/\d+(?:[-.,]\d+)*/g)].map(match => match[0]);
const digitsOnly = (text: string) => text.replace(/\D/g, '');
const CHINESE_NUMERALS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

test('the eight pilot guides are published and each has a carousel, 30 秒看懂 and step conclusions', () => {
  assert.deepEqual(Object.keys(GUIDE_EDITORIAL).sort(), [...PILOTS].sort());
  for (const slug of PILOTS) {
    const guide = getGuideBySlug(slug);
    assert.ok(guide, slug);
    const editorial = getGuideEditorial(slug)!;
    assert.ok(editorial.keyFacts.length >= 3 && editorial.keyFacts.length <= 5, `${slug}: 3–5 key facts`);
    assert.ok(editorial.slides.length >= 3 && editorial.slides.length <= 8, `${slug}: cover + 3–8 slides`);
    const headings = guide.blocks.filter(block => block.type === 'heading').length;
    assert.ok((editorial.steps ?? []).length <= headings, `${slug}: no step conclusion without a heading`);
    assert.ok(GUIDE_COVER_ANSWERS[slug], `${slug}: index cover answer`);
  }
  assert.equal(getGuideEditorial('bay-area-airport-arrival-guide'), undefined);
  assert.equal(getGuideEditorial('constructor'), undefined, 'own properties only');
});

test('every number in the pilot copy (zh and en) already appears in its article', () => {
  for (const slug of PILOTS) {
    const guide = getGuideBySlug(slug)!;
    const article = articleText(guide);
    // A small count may be written as a Chinese numeral in the article ("五年" → "5 年").
    const present = (run: string) => article.includes(run) || (/^\d{1,2}$/.test(run) && Number(run) <= 10 && article.includes(CHINESE_NUMERALS[Number(run)]));
    const all = [...copies(getGuideEditorial(slug)!), GUIDE_COVER_ANSWERS[slug]];
    for (const copy of all) for (const text of [copy.zh, copy.en]) for (const run of digitRuns(text)) {
      assert.ok(present(run), `${slug}: "${run}" in "${text}" is not in the article`);
    }
  }
});

test('phone numbers and sources in the pilot data match the article exactly', () => {
  for (const slug of PILOTS) {
    const guide = getGuideBySlug(slug)!;
    const article = articleText(guide);
    const editorial = getGuideEditorial(slug)!;
    const phones = [
      ...(editorial.cover.phone ? [editorial.cover.phone] : []),
      ...(editorial.contacts ?? []),
      ...editorial.slides.flatMap(slide => slide.phones ?? []),
    ];
    for (const phone of phones) {
      assert.ok(article.includes(phone.number), `${slug}: ${phone.number} is written in the article`);
      assert.equal(phone.tel, `+1${digitsOnly(phone.number).replace(/^1(?=\d{10}$)/, '')}`, `${slug}: ${phone.number} dials ${phone.tel}`);
    }
    const sources = [...editorial.keyFacts.map(fact => fact.source), ...(editorial.contacts ?? []).map(contact => contact.source), ...editorial.slides.map(slide => slide.source)];
    for (const source of sources) if (source !== undefined) assert.ok(source >= 1 && source <= guide.sources.length, `${slug}: source ${source}`);
  }
});

test('every part of a contact address is written in the article', () => {
  let checked = 0;
  for (const slug of PILOTS) {
    const article = articleText(getGuideBySlug(slug)!);
    for (const contact of getGuideEditorial(slug)!.contacts ?? []) for (const part of [contact.address ?? []].flat().join(',').split(/[,/]/).map(item => item.trim()).filter(Boolean)) {
      assert.ok(article.includes(part), `${slug}: "${part}" of ${contact.address} is not in the article`);
      checked++;
    }
  }
  assert.ok(checked >= 6, 'the senior-services addresses are checked');
});

test('pilot copy is written in both languages and the English has no Chinese', () => {
  for (const slug of PILOTS) for (const copy of [...copies(getGuideEditorial(slug)!), GUIDE_COVER_ANSWERS[slug]]) {
    assert.ok(copy.zh.trim() && copy.en.trim(), `${slug}: ${copy.zh}`);
    assert.doesNotMatch(copy.en, /[㐀-鿿]/u, `${slug}: ${copy.en}`);
  }
  assert.ok(guides.length >= 141);
});
