/**
 * Wave 9 · lane P (sf-w9-lead.md §3 P; the first-use review docs/opus-bay/review-2026-10-01-first-use.md R§5 #4 and its R§6
 * tech rows): the cold start (no frame until the first frame's programs are linked; Start 准备中… until then), the WebGL
 * probe (no WebGL: the title stays with links; software GL: quality low + a note), the context-lost card by device, and
 * GameRoot's city-only figures in the city chunk.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import * as THREE from 'three';

const src = (p: string) => fs.readFileSync(path.join('src/opus-bay', p), 'utf8');

// --- GameRoot toward 255 KB: the city-only figures in the city chunk ---

test('W9-P GameRoot: the rideable ferry\'s sun deck and the city gull ride with the city chunk (world/sf/cityFigures.ts fills life.ts\'s slot); the district keeps its ferry and gull', async () => {
  const life = src('world/life.ts');
  assert.ok(!life.includes('function sunDeck(') && !life.includes('export function cityGullGeometry('), 'the code is not back in GameRoot\'s life.ts');
  assert.match(src('world/sf/cityMode.ts'), /^import '\.\/cityFigures';\r?$/m, 'the city chunk loads it');
  const L = await import('../src/opus-bay/world/life');
  const tris = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.getAttribute('position').count) / 3;
  const before = tris(L.ferryGeometry('#2f8f88', true));
  assert.equal(L.cityFigures.deck, null, 'nothing filled before the city chunk');
  assert.equal(before, tris(L.ferryGeometry('#2f8f88', true)));
  await import('../src/opus-bay/world/sf/cityFigures');
  assert.equal(typeof L.cityFigures.deck, 'function');
  assert.equal(typeof L.cityFigures.gull, 'function');
  const deck = L.ferryGeometry('#2f8f88', true), closed = L.ferryGeometry('#2f8f88', false);
  assert.notEqual(tris(deck), tris(closed), 'the open-deck ferry differs from the enclosed one again');
});
