import assert from 'node:assert/strict';
import test from 'node:test';
import '../src/i18n/metadata';
import { setLocale } from '../src/i18n/locale';
import { ENGLISH_TITLE_LIMIT, englishDocumentTitle, renderMetadataHtml } from '../src/lib/seo';
import { guides } from '../src/data/guides';
import { localDiscoveries, discoveryShare } from '../src/data/local-discoveries';
import { getDiscoveryMetadata } from '../src/lib/discovery-metadata';
import { getGuideMetadata } from '../src/lib/guide-metadata';
import { languagePath } from '../src/lib/language-path';

/** H46 (I13-09): English <title>s are at most 60 characters; og:title and the H1 keep the full title. */
test('H46: the English search title gives way in order — short title, name alone, name before its break, a word cut', () => {
  assert.equal(englishDocumentTitle('Calendar | BAYLINK'), 'Calendar | BAYLINK', 'a short title is kept');
  assert.equal(englishDocumentTitle('Ameswell Barks & Boos: a pet parade, costumes and market | BAYLINK', 'Ameswell Barks & Boos'), 'Ameswell Barks & Boos | BAYLINK');
  assert.equal(englishDocumentTitle('Ameswell Barks & Boos: a pet parade, costumes and market | BAYLINK', '阿姆斯韦尔宠物游行'), 'Ameswell Barks & Boos: a pet parade, costumes and market', 'an untranslated short title is skipped');
  assert.equal(englishDocumentTitle('Halloween crafts and a costume contest at the Dublin Library | BAYLINK'), 'Halloween crafts and a costume contest at the Dublin Library');
  assert.equal(englishDocumentTitle('October BART updates: Mission elevator delay, less West Oakland parking and Yellow Line work | BAYLINK'), 'October BART updates | BAYLINK');
  assert.equal(englishDocumentTitle('About BAYLINK | Where to go and how to get it done in the Bay, with sources'), 'About BAYLINK', 'the brand is not repeated');
  assert.equal(englishDocumentTitle('Bay Area events, deals and new openings · fall 2026, through 11/30 | BAYLINK'), 'Bay Area events, deals and new openings | BAYLINK');
  // a cut ends a phrase where it can (review 10-14: "…Alviso Marina without… | BAYLINK"); the full title stays in og:title
  assert.equal(englishDocumentTitle('Begin birdwatching at Alviso Marina without committing to a long salt-pond loop around the bay | BAYLINK'), 'Begin birdwatching at Alviso Marina | BAYLINK');
  assert.equal(englishDocumentTitle('SFPL · Kanopy · Stream films at home for free with an SFPL library card | BAYLINK'), 'SFPL · Stream films at home for free | BAYLINK');
  assert.equal(englishDocumentTitle('Crumbl · Birthday dessert reward for Silver members and above | BAYLINK'), 'Crumbl · Birthday dessert reward | BAYLINK');
  assert.equal(englishDocumentTitle('How to write BAYLINK housing and service posts that build trust and get responses | BAYLINK'), 'How to write BAYLINK housing and service posts');
  assert.equal(englishDocumentTitle('Setting Up Utilities, Internet, and Your Address After a Bay Area Move: From Handover to the First Bill | BAYLINK'), 'Setting Up Utilities, Internet, and Your Address | BAYLINK');
  // a list that goes on keeps its "…"; without any break, a word cut with "…"
  assert.equal(englishDocumentTitle('OMCA · Oakland · Oct 4: Free California Art, History, and Natural Science Galleries | BAYLINK'), 'OMCA · Oct 4: Free California Art, History… | BAYLINK');
  const cut = englishDocumentTitle('Supercalifragilistic expialidocious extraordinarily unbelievable tremendously long words | BAYLINK');
  assert.ok(cut.length <= ENGLISH_TITLE_LIMIT && cut.endsWith('… | BAYLINK'), cut);
});

test('H46: every event, offer, opening and guide has an English <title> of at most 60 characters, and og:title keeps the full one', async () => {
  await setLocale('en', false);
  try {
    const pages = [...localDiscoveries.map(item => ({ ...getDiscoveryMetadata(item), path: languagePath(discoveryShare(item).path, 'en') })),
      ...guides.map(guide => ({ ...getGuideMetadata(guide), path: languagePath(`/guides/${guide.slug}`, 'en') }))];
    const long: string[] = [];
    let shortened = 0;
    for (const metadata of pages) {
      const head = renderMetadataHtml(metadata);
      const decode = (text: string) => text.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
      const title = decode(/<title>([^<]*)<\/title>/.exec(head)![1]);
      const ogTitle = decode(/property="og:title" content="([^"]*)"/.exec(head)![1]);
      if (title.length > ENGLISH_TITLE_LIMIT) long.push(`${title.length} ${metadata.path} ${title}`);
      if (title !== ogTitle) { shortened++; assert.ok(ogTitle.length > ENGLISH_TITLE_LIMIT, metadata.path); }
      assert.doesNotMatch(title, /[㐀-鿿]/, metadata.path);
    }
    assert.deepEqual(long, []);
    assert.ok(shortened > 100, `${shortened} titles shortened`);
  } finally { await setLocale('zh-Hans', false); }
});

test('H46: Chinese titles of offers keep their whole name (the short title shortens English only)', async () => {
  await setLocale('zh-Hans', false);
  const offer = localDiscoveries.find(item => item.kind === 'offer' && (item.offer as { shortTitle?: string }).shortTitle)!;
  const metadata = getDiscoveryMetadata(offer);
  assert.equal(metadata.shortTitleScope, 'en');
  assert.match(renderMetadataHtml(metadata), new RegExp(`<title>${metadata.title.slice(0, 6).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
});
