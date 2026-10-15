import assert from 'node:assert/strict';
import test from 'node:test';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { PLANNER_EVENTS } from '../src/data/planner-catalog';
import { loadLocale, translateText } from '../src/i18n/locale';

/**
 * H69 as a rule rather than a list (CNT-SUPPLY-2 review, 2026-10-14). These library systems publish that their programmes are
 * free (docs/source-reads-2026-10.md: CNT-HOTFIX-2 "H69 · library programme policies" and the CNT-SUPPLY-2 policy table), so an
 * event they host never says 费用待确认 while a sister event of the same system says 免费. A batch that leaves one at "unknown"
 * names it in EXEMPT with the reason; tests/cnt-hotfix-1013.test.ts keeps #41's own list.
 */
const POLICY_HOSTS: Readonly<Record<string, string>> = {
  'sfpl.org': 'San Francisco Public Library',
  'smcl.bibliocommons.com': 'San Mateo County Libraries',
  'sjpl.bibliocommons.com': 'San José Public Library',
  'marinlibrary.bibliocommons.com': 'Marin County Free Library',
  'sccl.bibliocommons.com': 'Santa Clara County Library District',
  'events.sonomalibrary.org': 'Sonoma County Library',
};
const EXEMPT: Readonly<Record<string, string>> = {
  'sfpl-richmond-lego-oct7-2026': 'ended 10/7, before the 10/13 policy read; the archived card keeps the wording it was published with',
  'sfpl-ocean-view-stem-oct8-2026': 'ended 10/8, before the 10/13 policy read; the archived card keeps the wording it was published with',
  'sfpl-garden-green-bin-oct10-2026': 'ended 10/10, before the 10/13 policy read; the archived card keeps the wording it was published with',
};
const HAN = /[㐀-鿿]/u;
const host = (url: string | undefined) => { try { return new URL(url ?? '').hostname.replace(/^www\./u, ''); } catch { return ''; } };
const policyEvents = MONTHLY_EVENTS.filter(event => Object.hasOwn(POLICY_HOSTS, host(event.officialUrl)));

test('H69 rule: no programme of a policy-free library system is left at cost "unknown" without a named reason', () => {
  assert.ok(policyEvents.length >= 90, `found ${policyEvents.length} policy-library events`);
  const unknown = policyEvents.filter(event => event.cost === 'unknown').map(event => event.id);
  assert.deepEqual(unknown.filter(id => !Object.hasOwn(EXEMPT, id)), [], 'set cost "free" (sales: 免费入场 with goods priced) or add the id to EXEMPT with the reason');
  for (const [id, reason] of Object.entries(EXEMPT)) {
    assert.ok(reason.length > 20, id);
    assert.ok(unknown.includes(id), `${id} is no longer an unknown-cost event of a policy library: drop the exemption`);
  }
});

test('H69 rule: free programmes of those systems are $0 for the planner', () => {
  const planner = new Map(PLANNER_EVENTS.map(event => [event.id, event]));
  const free = policyEvents.filter(row => row.cost === 'free');
  assert.ok(free.length >= 80, `found ${free.length}`);
  for (const event of free) {
    const plan = planner.get(event.id);
    if (plan) assert.equal(plan.planning?.admissionUsd, 0, `${event.id} (${POLICY_HOSTS[host(event.officialUrl)]})`);
  }
});

test('H69 rule: the labels #41 introduced read the same in English wherever this batch uses them', async () => {
  await loadLocale('en');
  for (const label of ['图书馆活动免费', '图书馆活动免费；需在图书馆网站报名', '图书馆活动免费；随到随参加', '免费入场；书按价购买']) {
    assert.ok(policyEvents.some(event => event.costLabel === label && /^(?:smcl|sjpl|sccl|marin|scl)-/u.test(event.id) && event.verifiedAt >= '2026-10-13'), label);
    assert.doesNotMatch(translateText(label, 'en'), HAN, label);
  }
});

test('H69 rule: the 2026-10-13 batch reads like #41 (图书馆活动免费, or 免费入场 for sales) in every policy system', () => {
  const batch = policyEvents.filter(event => event.verifiedAt >= '2026-10-13' && /^(?:smcl|sjpl|sccl|marin|scl)-/u.test(event.id));
  assert.ok(batch.length >= 19, `found ${batch.length}`);
  for (const event of batch.filter(row => row.cost === 'free')) {
    if (/图书馆活动免费|免费入场/u.test(event.costLabel)) continue;
    assert.match(event.costLabel, /^免费/u, `${event.id}: ${event.costLabel}`);
  }
  for (const event of batch) assert.doesNotMatch(event.costLabel, /活动页没有写(?:入场)?费用/u, `${event.id}: ${event.costLabel}`);
});
