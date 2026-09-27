import type { PlacedTag } from '../game/flags';

const setVar = (el: HTMLElement, name: string, v: string) => { if (el.style.getPropertyValue(name) !== v) el.style.setProperty(name, v); };

/**
 * Write the laid-out tags (game/flags.ts layoutPanoramaTags) into the DOM: position (the box's top-left), shown or not,
 * and the leader line's length down to the anchor for lifted tags. `anchors` = the projected anchor per id. Runs on
 * every projection change for the 10 s of a panorama: no map, no node list, and a style is written only when it changed.
 */
export function placePanoramaTags(root: HTMLElement, placed: readonly PlacedTag[], anchors: ReadonlyMap<string, { x: number; y: number }>) {
  const tags = root.children;
  for (let i = 0; i < tags.length; i++) {
    const el = tags[i] as HTMLElement;
    if (!el.classList.contains('ob-pano-tag')) continue;
    const id = el.dataset.id ?? '';
    let p: PlacedTag | undefined;
    for (let k = 0; k < placed.length; k++) if (placed[k].id === id) { p = placed[k]; break; }
    if (!p) { if (el.dataset.show !== '0') el.dataset.show = '0'; continue; }
    const tr = `translate3d(${p.box.l.toFixed(1)}px, ${p.box.t.toFixed(1)}px, 0)`;
    if (el.style.transform !== tr) el.style.transform = tr;
    if (el.dataset.show !== '1') el.dataset.show = '1';
    const a = anchors.get(p.id);
    const lead = p.lead && a ? Math.max(0, a.y - p.box.b) : 0;
    setVar(el, '--ob-lead', `${lead.toFixed(0)}px`);
    setVar(el, '--ob-lead-x', `${a ? (a.x - p.box.l).toFixed(0) : 0}px`);
  }
}
