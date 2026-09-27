import type { PlacedTag } from '../game/flags';

/**
 * Write the laid-out tags (game/flags.ts layoutPanoramaTags) into the DOM: position (the box's top-left), shown or not,
 * and the leader line's length down to the anchor for lifted tags. `anchors` = the projected anchor per id.
 */
export function placePanoramaTags(root: HTMLElement, placed: readonly PlacedTag[], anchors: ReadonlyMap<string, { x: number; y: number }>) {
  const byId = new Map(placed.map(p => [p.id, p] as const));
  root.querySelectorAll<HTMLElement>('.ob-pano-tag').forEach(el => {
    const p = byId.get(el.dataset.id ?? '');
    if (!p) { if (el.dataset.show !== '0') el.dataset.show = '0'; return; }
    const tr = `translate3d(${p.box.l.toFixed(1)}px, ${p.box.t.toFixed(1)}px, 0)`;
    if (el.style.transform !== tr) el.style.transform = tr;
    if (el.dataset.show !== '1') el.dataset.show = '1';
    const a = anchors.get(p.id);
    const lead = p.lead && a ? Math.max(0, a.y - p.box.b) : 0;
    el.style.setProperty('--ob-lead', `${lead.toFixed(0)}px`);
    el.style.setProperty('--ob-lead-x', `${a ? (a.x - p.box.l).toFixed(0) : 0}px`);
  });
}
