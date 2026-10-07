import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { testLanes } from '../scripts/test-lanes.mjs';

test('parallel lanes cover the complete real test inventory exactly once', async () => {
  const inventory = (await readdir('tests', { recursive: true })).filter(file => /\.test\.(ts|tsx|mjs)$/.test(file))
    .map(file => `tests/${file.replaceAll('\\', '/')}`).sort();
  const { all, site, opus } = await testLanes();
  assert.deepEqual(all, inventory);
  assert.deepEqual([...site, ...opus].sort(), inventory);
  assert.equal(new Set([...site, ...opus]).size, inventory.length);
  assert.ok(opus.some(file => file.includes('little-bay')));
  assert.ok(site.includes('tests/audit-calendar-monthly.test.tsx'));
});

test('the existing required check fails closed over both lanes and complete artifact checks', async () => {
  const workflow = await readFile('.github/workflows/check.yml', 'utf8');
  const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
  assert.match(workflow, /on: \[push, pull_request\]/);
  assert.doesNotMatch(workflow, /paths-ignore:|paths:|continue-on-error:/);
  assert.equal((workflow.match(/run: npm run pretest/g) || []).length, 2);
  assert.match(workflow, /run: npm run test:site/);
  assert.match(workflow, /run: npm run test:opus/);
  assert.match(workflow, /run: npm run release:hosting/);
  const aggregate = workflow.slice(workflow.indexOf('\n  check:'));
  assert.match(aggregate, /if: \$\{\{ always\(\) \}\}/);
  assert.match(aggregate, /needs: \[site, opus, release\]/);
  for (const job of ['site', 'opus', 'release']) assert.ok(aggregate.includes(`needs.${job}.result`));
  for (const result of ['SITE_RESULT', 'OPUS_RESULT', 'RELEASE_RESULT']) assert.ok(aggregate.includes(`"$${result}" != "success"`));
  assert.match(aggregate, /exit 1/);
  const complete = packageJson.scripts['release:build'].split(' && ').filter(command => command !== 'npm test');
  assert.deepEqual(packageJson.scripts['release:hosting'].split(' && '), complete,
    'parallel CI must preserve every non-test release:build gate');
});
