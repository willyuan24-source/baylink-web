import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// UI9-PREP moved code into files of their own so that the UI-9 area lanes edit different files. The old import paths
// that frozen code still uses keep working, and the moved exports are the same functions.

test('PageHeader and PageContainer live in ui/PageHeader.tsx; HeroCard.tsx re-exports them for the frozen /explore page', async () => {
  const fromFile = await import('../src/components/ui/PageHeader');
  const fromHero = await import('../src/components/ui/HeroCard');
  const fromBarrel = await import('../src/components/ui');
  assert.equal(fromHero.PageHeader, fromFile.PageHeader);
  assert.equal(fromHero.PageContainer, fromFile.PageContainer);
  assert.equal(fromBarrel.PageHeader, fromFile.PageHeader);
  assert.equal(fromBarrel.PageContainer, fromFile.PageContainer);
  assert.equal(fromBarrel.HeroCard, fromHero.HeroCard);
  assert.doesNotMatch(readFileSync('src/components/ui/HeroCard.tsx', 'utf8'), /function Page(?:Header|Container)/, 'one definition, in PageHeader.tsx');
  // AttractionExplorer.tsx (OPUS contract, frozen) imports them from HeroCard: that path must keep resolving.
  assert.match(readFileSync('src/components/AttractionExplorer.tsx', 'utf8'), /import \{ PageContainer, PageHeader \} from '\.\/ui\/HeroCard';/);
});

test('the offer and new-shop cards live in events/BoardCards.tsx (UI9-FREE), the event cards stay in EventCards.tsx (UI9-EVENTS)', async () => {
  const boards = await import('../src/features/events/BoardCards');
  const events = await import('../src/features/events/EventCards');
  assert.equal(typeof boards.OfferFeedCard, 'function');
  assert.equal(typeof boards.OpeningFeedCard, 'function');
  assert.ok(!('OfferFeedCard' in events) && !('OpeningFeedCard' in events), 'one home for each card');
  for (const card of ['EventFeedCard', 'EventHeroCard', 'EventRowCard', 'EventMeta', 'TrustLine'] as const) assert.equal(typeof events[card], 'function', card);
  assert.match(readFileSync('src/features/events/PerksView.tsx', 'utf8'), /import \{ OfferFeedCard \} from '\.\/BoardCards';/);
  assert.match(readFileSync('src/features/events/OpeningsView.tsx', 'utf8'), /import \{ OpeningFeedCard \} from '\.\/BoardCards';/);
});

test('the save controls\' CSS lives in saves/saves.css, global and right after reader-library.css; the reader shelf stays', async () => {
  const reader = readFileSync('src/components/reader-library.css', 'utf8');
  const saves = readFileSync('src/features/saves/saves.css', 'utf8');
  assert.doesNotMatch(reader, /\.saves-/, 'no save-control rule left in the reader sheet');
  assert.match(reader, /\.reader-shelf \{/);
  assert.match(saves, /\.saves-control \{/);
  const main = readFileSync('src/main.tsx', 'utf8').split(/\r?\n/);
  const at = main.indexOf("import './components/reader-library.css'");
  assert.ok(at > 0 && main[at + 1] === "import './features/saves/saves.css'", 'the same place in the global cascade');
  const { cssLoadGraph } = await import('../scripts/check-style-ratchet.mjs');
  assert.ok(cssLoadGraph().global.includes('src/features/saves/saves.css'), 'loaded at boot, for the prerendered pages');
});

test('the BayBay panel frame (.member-baybay-*) and the 👎 reasons (.baybay-downvote*) moved to BayBay\'s sheets', async () => {
  const uncommented = (path: string) => readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const member = uncommented('src/features/member-ui.css');
  const conversation = readFileSync('src/features/baybay-conversation.css', 'utf8');
  assert.doesNotMatch(member, /member-baybay/, 'member-ui.css keeps sign-in and publishing only');
  assert.match(member, /\.member-compose-overlay \{ position: fixed;/);
  // UI9-BB then moved the panel's frame out of the global sheet into its lazy one (F's Sheet replaces the
  // .member-baybay-* frame); the global sheet keeps QuickExplore's two rules only.
  assert.doesNotMatch(conversation.replace(/\/\*[\s\S]*?\*\//g, ''), /member-baybay|\.baybay-/);
  const entry = uncommented('src/features/feedback/feedback-entry.css');
  const panel = readFileSync('src/features/baybay/baybay-panel.css', 'utf8');
  assert.doesNotMatch(entry, /baybay/, 'feedback-entry.css keeps the report and footer links only');
  // UI9-BB put the reasons on F's chips: the bespoke button look, its opacity :disabled and its focus rule are gone.
  for (const selector of ['.baybay-downvote{', '.baybay-downvote>span{', '.baybay-downvote-failed{', '.baybay-downvote-done{', '.baybay-feedback>:is(.baybay-downvote,.baybay-downvote-done){']) assert.ok(panel.includes(selector), selector);
  for (const selector of ['.baybay-downvote button{', '.baybay-downvote button[disabled]{']) assert.ok(!panel.includes(selector), selector);
  // Lazy, like feedback-entry.css was: it arrives with the panel chunk, after the global sheets (audit-integration.css's
  // .baybay-feedback button has the same specificity as .baybay-downvote button and must keep losing to it).
  assert.match(readFileSync('src/components/BayBayAssistantEntry.tsx', 'utf8'), /^import '\.\.\/features\/baybay\/baybay-panel\.css';$/m);
  const { cssLoadGraph } = await import('../scripts/check-style-ratchet.mjs');
  const graph = cssLoadGraph();
  assert.ok(graph.lazy.includes('src/features/baybay/baybay-panel.css') && !graph.global.includes('src/features/baybay/baybay-panel.css'));
  // UI9-INT dropped the emptied audit-integration.css (its .baybay-feedback rules live in the panel's sheet).
  assert.ok(!graph.global.includes('src/audit-integration.css'));
});
