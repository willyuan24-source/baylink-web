import assert from 'node:assert/strict';
import test from 'node:test';
import { enableUsEnglishTimes, loadLocale, translateText } from '../src/i18n/locale';

// CNT-GUIDES-3 (GPT en-review 10-15, EN-04..06): Chinese punctuation in a line without Chinese reads the English way on /en.
test('a line without Chinese drops its Chinese punctuation on /en: source titles, list separators, brackets', async () => {
  await loadLocale('en');
  // the Opus Bay game keeps its dictionary as generated (no site switch yet)
  assert.equal(translateText('SF Rec & Parks：JFK Promenade', 'en'), 'SF Rec & Parks：JFK Promenade');
  await enableUsEnglishTimes();
  assert.equal(translateText('SF Rec & Parks：JFK Promenade', 'en'), 'SF Rec & Parks: JFK Promenade');
  assert.equal(translateText('EBRPD：Visitor Safety', 'en'), 'EBRPD: Visitor Safety');
  assert.equal(translateText('Merchant、Main、Parker Streets', 'en'), 'Merchant, Main, Parker Streets');
  assert.equal(translateText('Hiller Aviation Museum，601 Skyway Road', 'en'), 'Hiller Aviation Museum, 601 Skyway Road');
  assert.equal(translateText('Marin：415-473-4636；Sonoma：707-565-4636。', 'en'), 'Marin: 415-473-4636; Sonoma: 707-565-4636.');
  assert.equal(translateText('NUMU（Los Gatos）', 'en'), 'NUMU (Los Gatos)');
  // a word after the closing bracket gets its space; a time or a thousands mark between digits gets none
  assert.equal(translateText('NUMU（Los Gatos）Museum', 'en'), 'NUMU (Los Gatos) Museum');
  assert.equal(translateText('Doors 10：30, Hall B', 'en'), 'Doors 10:30, Hall B');
  assert.equal(translateText('1，000 seats，free', 'en'), '1,000 seats, free');
  // a line that still has Chinese in it (the untranslated rest after a known label) keeps its full-width punctuation
  assert.match(translateText('资讯核对日期：未定（待确认）', 'en'), /未定（待确认）$/u);
  // the 、 a guide's "For:" row puts between two English audience names is its own text node
  assert.equal(translateText('、', 'en'), ', ');
  // text without such punctuation, and the Chinese locales, are unchanged
  assert.equal(translateText('SF Rec & Parks: JFK Promenade', 'en'), 'SF Rec & Parks: JFK Promenade');
  assert.equal(translateText('SF Rec & Parks：JFK Promenade', 'zh-Hans'), 'SF Rec & Parks：JFK Promenade');
});
