import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { currentFreebies } from '../src/data/october-offers';

/**
 * CNT-REGION-4 (api PR #57, API-BB-8 owner decision 1): four one-venue offers gave a street address but no region, so
 * BayBay read them as chain-wide and now keeps them out of every city ask. Each region below comes from the venue's own
 * official address (read 2026-10-17), the same city the record's brand line already names.
 */
const EXPECTED = [
  // randallmuseum.org/faqs: "199 Museum Way, San Francisco, CA 94114"
  { id: 'randall-museum-free', region: 'sf', brand: /SAN FRANCISCO/, address: /199 Museum Way/ },
  // cablecarmuseum.org/info.html: "1201 Mason Street, San Francisco, CA 94108"
  { id: 'cable-car-museum-free', region: 'sf', brand: /SAN FRANCISCO/, address: /1201 Mason Street/ },
  // happyhollow.org/seniorsafari: "San Jose's iconic Happy Hollow Park & Zoo", parking at 748 Story Road
  { id: 'happy-hollow-senior-safari-oct22', region: 'south-bay', brand: /SAN JOSÉ/, address: /748 Story Road/ },
  // poppyandclaro.com: "50 West San Fernando St, San Jose, CA 95113"
  { id: 'poppy-claro-doggie-dinners-fall', region: 'south-bay', brand: /SAN JOSÉ/, address: /50 West San Fernando Street/ },
] as const;

test('the four one-venue offers carry the region of their own address', () => {
  for (const { id, region, brand, address } of EXPECTED) {
    const offer = currentFreebies.find(item => item.id === id);
    assert.ok(offer, `${id} is a current offer`);
    assert.equal(offer.region, region, `${id} region`);
    assert.match(offer.brand, brand, `${id}: the brand line names the same city`);
    assert.match(offer.description, address, `${id}: the description keeps the street address the region comes from`);
  }
});

test('BayBay discovery context exports that region in both locales', () => {
  for (const file of ['public/discovery-context.json', 'public/discovery-context.en.json']) {
    const items = (JSON.parse(readFileSync(file, 'utf8')) as { items: { kind: string; id: string; region?: string }[] }).items;
    for (const { id, region } of EXPECTED) {
      const item = items.find(entry => entry.kind === 'offer' && entry.id === id);
      assert.ok(item, `${file} lists ${id}`);
      assert.equal(item.region, region, `${file}: ${id} region (npm run export:discovery)`);
    }
  }
});
