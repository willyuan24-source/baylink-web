import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/**
 * Wave 8 · W8-C, the completeness fix pass (docs/opus-bay/sf-w8-integration.md "Completeness pass"): the items the
 * completeness critic listed as safe and cheap, each red before its fix.
 *  - lane S's own finding 2 (ui/Floating.tsx LiveRegion): the screen-reader prompt went stale when the focused
 *    interactable renamed itself in place (the jets' 看看飞行表演 → 跟上船队 read the old verb). It re-reads the focus on
 *    the interactables' epoch, as Hud.tsx's ContextAction has since W6-K1.
 */

const src = (p: string) => fs.readFileSync(path.resolve('src/opus-bay', p), 'utf8');

test('W8-C S-2 the screen-reader prompt re-reads a focused interactable renamed in place (the interactables epoch, as the HUD prompt)', () => {
  const f = src('ui/Floating.tsx');
  const live = f.slice(f.indexOf('export function LiveRegion'), f.indexOf('export function DebugOverlay'));
  assert.match(live, /useSyncExternalStore\(subscribeInteractables, interactablesEpoch, interactablesEpoch\)/, 'LiveRegion subscribes to the interactables epoch');
  assert.match(live, /useEffect\(\(\) => \{ reread\(n => n \+ 1\); \}, \[epoch\]\);/, 'and re-renders after the list is swapped in');
  assert.match(f, /import \{ BAYBAY_ID, interactableById, interactablesEpoch, subscribeInteractables \} from '\.\.\/game\/interactables';/);
});
