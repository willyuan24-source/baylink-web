import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/**
 * Wave 7 · lane S (W7-S3): the site's Sep 29 offers in the game — the seniors' free Muni in live.json (re-exported by
 * scripts/opus-sf/export-live.ts, its rule read from SFMTA's English page) and the Chase Center ticket's Muni line on the
 * cards at Chase Center (realsf/HowToGo.tsx → BAYLINK's /offers/chase-center-ticket-muni-included).
 */

const g = globalThis as unknown as Record<string, unknown>;
g.location = { search: '?world=city&save=off', href: 'http://localhost/opus-bay?world=city&save=off', pathname: '/opus-bay', hostname: 'localhost' };
g.window ??= globalThis;

const live = await import('../src/opus-bay/realsf/live');
const { EVENT_VENUES } = await import('../src/opus-bay/realsf/eventVenues');

test('W7-S3 live.json: the seniors’ free Muni is a standing transit offer with the English SFMTA rule; the other rows unchanged', async () => {
  const raw = JSON.parse(fs.readFileSync(path.resolve('public/opus-bay/sf/v1/live.json'), 'utf8'));
  const offers = live.parseLive(raw)!;
  const seniors = offers.find(o => o.id === 'sfmta-free-muni-seniors');
  assert.ok(seniors, 'in live.json');
  assert.equal(seniors!.kind, 'transit');
  assert.equal(seniors!.free, true);
  assert.equal(seniors!.place, null);
  assert.match(seniors!.who.zh, /65/);
  assert.match(seniors!.who.zh, /申请/);
  assert.equal(seniors!.rule?.url, 'https://www.sfmta.com/fares/free-muni-seniors-ages-65');
  assert.equal(seniors!.rule?.verifiedAt, '2026-09-29');
  assert.equal(seniors!.href, '/offers/sfmta-free-muni-seniors');
  assert.ok(live.standingOffers(offers).some(o => o.id === 'sfmta-free-muni-seniors'), 'a standing offer (长期福利)');
  assert.deepEqual(live.offersOn('2026-10-10', offers).map(t => t.offer.id).filter(id => id.startsWith('sfmta')), [], 'never a dated row');
  // the site still publishes it (the export fails otherwise) and it is not a purchase
  const { currentFreebies } = await import('../src/data/october-offers');
  const site = currentFreebies.find(o => o.id === 'sfmta-free-muni-seniors');
  assert.ok(site && site.kind !== 'purchase');
  // the Chase Center ticket offer is a purchase: never a live.json row (the card's line instead)
  assert.ok(!offers.some(o => o.id === 'chase-center-ticket-muni-included'));
  assert.equal(currentFreebies.find(o => o.id === 'chase-center-ticket-muni-included')?.kind, 'purchase');
});

test('W7-S3 the Chase Center cards: the ticket-includes-Muni line with the BAYLINK offer link; not at Thrive City or elsewhere', async () => {
  const { registerHooks } = await import('node:module');
  const styles = registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
  const H = await import('../src/opus-bay/realsf/HowToGo');
  styles.deregister();
  const chase = EVENT_VENUES.find(v => v.id === 'chase-center')!;
  const thrive = EVENT_VENUES.find(v => v.id === 'thrive-city')!;
  assert.ok(H.chaseMuniAt(chase), 'the arena events');
  assert.ok(H.chaseMuniAt({ x: 491.19, z: 258.83 }), 'the Chase Center place card');
  assert.ok(!H.chaseMuniAt(thrive), 'Thrive City’s free plaza events are not ticketed there');
  assert.ok(!H.chaseMuniAt({ x: 131.5, z: 15.1 }));
  assert.match(H.CHASE_MUNI_NOTE.zh, /不含缆车/);
  const { createElement: h } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const html = renderToStaticMarkup(h(H.default, { point: { x: chase.x, z: chase.z } }));
  assert.match(html, /持大通中心活动票/);
  assert.match(html, /href="\/offers\/chase-center-ticket-muni-included"/);
  assert.doesNotMatch(renderToStaticMarkup(h(H.default, { point: { x: thrive.x, z: thrive.z } })), /chase-center-ticket-muni-included/);
});
