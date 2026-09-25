import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import { JSDOM } from 'jsdom';
import SanFranciscoExplorer from '../src/features/little-bay/SanFranciscoExplorer';
import { SF_LANDMARKS } from '../src/features/little-bay/sf-world';
import { PLANNER_EVENTS } from '../src/data/planner-catalog';
import { eventOccursOn } from '../src/lib/event-calendar';
import type { Stop } from '../src/lib/planner';

// Keep scene imports behind their real Suspense boundary; these checks do not
// create a WebGL context and work in the same server-rendering path as prerender.
function renderExplorer(date: string, stops: Stop[] = [], freeOnly = false) {
  return new JSDOM(renderToStaticMarkup(
    <StaticRouter location={`/play?date=${date}`}>
      <SanFranciscoExplorer date={date} stops={stops} freeOnly={freeOnly} onShowList={() => { throw new Error('Rendering must not navigate'); }} onAddPlace={() => { throw new Error('Rendering must not alter the real itinerary'); }} />
    </StaticRouter>,
  )).window.document;
}

test('Mini SF server UI exposes all real landmarks and defaults to BayBay city exploration with guide links available before WebGL', () => {
  const doc = renderExplorer('2026-10-10');
  const options = [...doc.querySelectorAll<HTMLOptionElement>('.sf-explorer-bar select option')];
  assert.deepEqual(options.filter(option => option.value).map(option => option.value), SF_LANDMARKS.map(place => place.id));
  assert.equal(options.find(option => option.selected)?.value, 'park');
  assert.match(doc.querySelector('.sf-scene-heading h2')?.textContent || '', /BAYBAY/);
  const modes = [...doc.querySelectorAll<HTMLButtonElement>('.sf-travel-toggle button')];
  assert.equal(modes.find(button => button.textContent?.includes('走路'))?.getAttribute('aria-pressed'), 'true');
  assert.equal(modes.find(button => button.textContent?.includes('开车'))?.getAttribute('aria-pressed'), 'false');
  assert.match(doc.querySelector('.sf-ground-caption')?.textContent || '', /点地面走路/);
  const guide = doc.querySelector('a[href="/guides/golden-gate-park-free-car-free-day-guide"]');
  assert.ok(guide, 'the real guide is usable even while the 3D scene loads');
  assert.equal(guide.getAttribute('target'), '_blank', 'reading a guide preserves the unsaved game itinerary');
  assert.match(guide.getAttribute('rel') || '', /noopener/);
  assert.ok(doc.querySelector('a[href="https://www.sfrecpark.org/770/Golden-Gate-Park"]'));
});

test('the displayed SF event count follows exact occurrences, free admission and empty dates', () => {
  for (const date of ['2026-10-03', '2026-10-10', '2026-10-13', '2027-02-01', '']) {
    for (const freeOnly of [false, true]) {
      const doc = renderExplorer(date, [], freeOnly);
      const eventButton = [...doc.querySelectorAll<HTMLButtonElement>('.sf-place-actions button')].find(button => button.textContent?.includes('这一天的活动'));
      assert.ok(eventButton);
      const expected = PLANNER_EVENTS.filter(event => event.region === 'sf' && (!freeOnly || event.cost === 'free') && eventOccursOn(event, date));
      assert.equal(eventButton.querySelector('span')?.textContent, String(expected.length), `${date}; freeOnly=${freeOnly}`);
      assert.equal(eventButton.getAttribute('aria-expanded'), 'false');
    }
  }
});

test('a real place already on the ticket is disabled without confusing event and place IDs', () => {
  const action = (doc: Document) => [...doc.querySelectorAll<HTMLButtonElement>('.sf-place-actions button')].find(button => /加入.*周末/.test(button.textContent || ''))!;
  assert.equal(action(renderExplorer('2026-10-10')).disabled, false);
  const alreadyAdded = action(renderExplorer('2026-10-10', [{ kind: 'place', id: 'golden-gate-park' }]));
  assert.equal(alreadyAdded.disabled, true);
  assert.match(alreadyAdded.textContent || '', /已加入/);
  assert.equal(action(renderExplorer('2026-10-10', [{ kind: 'event', id: 'golden-gate-park' }])).disabled, false);
});

test('initial HTML never awards a physical prize, fabricates a claim or opens digging before arrival', () => {
  const doc = renderExplorer('2026-10-10');
  assert.equal(doc.querySelector('.sf-dig'), null);
  assert.equal(doc.querySelector('[role="dialog"]'), null);
  assert.equal(doc.querySelector('.sf-reward'), null);
  assert.doesNotMatch(doc.body.textContent || '', /兑奖码|领取凭证|恭喜获得|claim code/i);
  assert.equal(doc.querySelector('a[href^="mailto:"]'), null);
});


test('expanded scene retains landmark navigation, map, travel modes and camera controls within its own subtree', () => {
  const doc = renderExplorer('2026-10-10');
  const stage = doc.querySelector('.sf-stage')!;
  const navigation = stage.querySelector('nav[aria-label="游戏内地点与地图"]');
  assert.ok(navigation, 'in-scene navigation survives expansion of only the stage');
  assert.equal(navigation.querySelectorAll('select option').length, SF_LANDMARKS.length + 1);
  assert.ok([...navigation.querySelectorAll('button')].some(button => button.textContent?.includes('全城地图')));
  assert.equal(stage.querySelectorAll('.sf-travel-toggle button').length, 2);
  assert.equal(stage.querySelector('.sf-view-toggle')?.getAttribute('aria-expanded'), 'false');
  assert.ok(stage.querySelector('button[aria-label="放大画面"]'));
  assert.equal(doc.querySelectorAll('.sf-explorer-bar').length, 1, 'one location selector avoids hidden duplicate controls');
});
