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
