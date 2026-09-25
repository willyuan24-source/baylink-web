import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import { getUnifiedPlace } from '../src/features/little-bay/unified-bay-world';
import { unifiedPlaceEvents } from '../src/features/little-bay/unified-place-events';
import type { PlannerEvent } from '../src/lib/planner';
import { PLANNER_EVENTS } from '../src/data/planner-catalog';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/play' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, cleanup, fireEvent, waitFor } = await import('@testing-library/react');
const { default: UnifiedPlacePanel } = await import('../src/features/little-bay/UnifiedPlacePanel');
afterEach(() => cleanup());

test('regional nearby events require a venue location, the chosen day and matching region', () => {
  const place = getUnifiedPlace('peninsula:stanford')!;
  const base: PlannerEvent = { ...PLANNER_EVENTS[0], id: 'nearby', region: 'peninsula', startDate: '2026-09-25', endDate: '2026-09-25', occurrenceDates: ['2026-09-25'], location: { lng: place.coordinate[0], lat: place.coordinate[1], precision: 'venue', label: 'Venue', sourceUrl: 'https://example.com/venue' } };
  const events: PlannerEvent[] = [base, { ...base, id: 'area', location: { ...base.location!, precision: 'area' } }, { ...base, id: 'wrong-region', region: 'sf' }, { ...base, id: 'no-location', location: undefined }, { ...base, id: 'other-date', occurrenceDates: ['2026-09-26'] }, { ...base, id: 'distant', location: { ...base.location!, lat: place.coordinate[1] + 1 } }, { ...base, id: 'invalid', location: { ...base.location!, lat: NaN } }];
  assert.deepEqual(unifiedPlaceEvents(events, place, '2026-09-25').map(event => event.id), ['nearby']);
});

test('place dialog shows the exact photograph, keeps expansion in one dialog and contains movement keys', () => {
  const trigger = document.createElement('button'); document.body.append(trigger); trigger.focus();
  let closed = 0, movement = 0; const routes: string[] = [];
  const onKey = () => { movement++; }; window.addEventListener('keydown', onKey);
  try {
    const place = getUnifiedPlace('sf:ferry')!;
    const view = render(<UnifiedPlacePanel place={place} locale="en" date="2026-09-25" addedPlaceIds={[]} onClose={() => { closed++; }} onNavigate={key => routes.push(key)} />);
    const close = view.getByRole('button', { name: 'Close place details' });
    assert.equal(document.activeElement, close);
    assert.match(view.getByRole('img').getAttribute('src') || '', /ferry/);
    assert.equal(view.getByRole('link', { name: 'Official visitor information' }).getAttribute('href'), place.sourceUrl);
    assert.equal(view.queryByRole('link', { name: 'Read full guide' }), null);
    fireEvent.click(view.getByRole('button', { name: /Enlarge attraction photograph/ }));
    assert.equal(view.getAllByRole('dialog').length, 1);
    fireEvent.keyDown(view.getByRole('button', { name: 'Close photograph' }), { key: 'ArrowUp' });
    assert.equal(movement, 0);
    fireEvent.keyDown(view.getByRole('button', { name: 'Close photograph' }), { key: 'Escape' });
    assert.equal(closed, 0); assert.equal(document.activeElement, close);
    fireEvent.click(view.getByRole('button', { name: 'Navigate here in the game' }));
    assert.deepEqual(routes, ['sf:ferry']); assert.equal(closed, 1);
    const last = view.getByRole('link', { name: 'See the San Francisco event calendar' });
    close.focus(); fireEvent.keyDown(close, { key: 'Tab', shiftKey: true }); assert.equal(document.activeElement, last);
    fireEvent.keyDown(last, { key: 'Tab' }); assert.equal(document.activeElement, close);
    fireEvent.keyDown(close, { key: 'Escape' }); assert.equal(closed, 2);
    view.unmount(); assert.equal(document.activeElement, trigger);
  } finally { window.removeEventListener('keydown', onKey); trigger.remove(); }
});

test('regional reader connects existing guide and planner without offering duplicate additions', async () => {
  const place = getUnifiedPlace('peninsula:stanford')!;
  const additions: string[] = [];
  const view = render(<UnifiedPlacePanel place={place} locale="en" date="2026-09-25" addedPlaceIds={[]} onAddPlace={id => additions.push(id)} onClose={() => {}} onNavigate={() => {}} />);
  await waitFor(() => assert.ok(view.getByRole('link', { name: 'Read full guide' })));
  assert.equal(view.getByRole('link', { name: 'Read full guide' }).getAttribute('href'), `/guides/${place.guideSlug}?lang=en`);
  fireEvent.click(view.getByRole('button', { name: 'Add to my day' })); assert.deepEqual(additions, ['stanford']);
  view.rerender(<UnifiedPlacePanel place={place} locale="en" date="2026-09-25" addedPlaceIds={['stanford']} onAddPlace={id => additions.push(id)} onClose={() => {}} onNavigate={() => {}} />);
  assert.equal((view.getByRole('button', { name: 'Added to my day' }) as HTMLButtonElement).disabled, true);
  assert.match(view.getByRole('img').getAttribute('src') || '', /stanford/);
});
