import { charApi, type CharApi } from '../actors/charApi';
import { WEAR_SLOTS, type WearSlot } from '../data/playSave';
import { registerFrameDecorator } from '../game/photoFrames';
import { registerWarmup } from '../world/warmup';
import { drawFrame } from './frames';
import { hatMesh, hatWarmup } from './hats';
import { itemById, type ItemDef } from './items';
import { subscribeLedger } from './ledger';
import { wornItem } from './wallet';

/**
 * Wave 5 · lane E · W5-E7: the looks on the bodies, the rides and the photos — through lane F's charApi (frozen
 * interface, actors/charApi.ts; F's implementation actors/charImpl.ts) and lane C's frame hook.
 *
 *   baybay-scarf  charApi.tint('baybay', 'scarf', colour)        player-hat   tint('player', 'hat', colour)
 *   baybay-hat    charApi.attach('baybay', 'head', hat mesh)      player-pack  tint('player', 'pack', colour)
 *   bike · car · pelican   charApi.vehiclePaint(kind, PAINTS id)  frame        the photo decorator 'e-frame'
 *
 * The worn state lives in the play save (`play.w`, the ledger writes it); a try-on in the 小铺 is a PREVIEW on top of
 * it (setPreview), dropped when the sheet closes. Only slots whose look changed are sent again (a tint repaints vertex
 * colours). charApi() is null until lane F's actors are up and changes when they remount: a 1 s check re-sends every
 * look to a new implementation (and BAYBAY's GLB swap keeps her hat and scarf on F's side).
 */

type Look = string | null;
const preview = new Map<WearSlot, ItemDef | null>();
let sent: Partial<Record<WearSlot, Look>> = {};
let sentTo: CharApi | null = null;

/** What a slot shows now: the try-on, else the worn item, else the default (null). */
export function lookOf(slot: WearSlot): ItemDef | null {
  return preview.has(slot) ? preview.get(slot)! : wornItem(slot);
}

function send(api: CharApi, slot: WearSlot, it: ItemDef | null) {
  switch (slot) {
    case 'baybay-scarf': api.tint('baybay', 'scarf', it?.color ?? null); break;
    case 'baybay-hat': api.attach('baybay', 'head', it?.hat ? hatMesh(it.hat) : null); break;
    case 'player-hat': api.tint('player', 'hat', it?.color ?? null); break;
    case 'player-pack': api.tint('player', 'pack', it?.color ?? null); break;
    case 'bike': case 'car': case 'pelican': api.vehiclePaint(slot, it?.paint ?? null); break;
    case 'frame': break; // painted at the shutter (the decorator reads lookOf('frame'))
  }
}

/** Send the looks that changed (all of them to a new charApi implementation). */
export function syncLooks(api: CharApi | null = charApi()): number {
  if (!api) return 0;
  // a new implementation starts at the default looks: send only what differs
  if (api !== sentTo) { sent = Object.fromEntries(WEAR_SLOTS.map(s => [s, null])); sentTo = api; }
  let n = 0;
  for (const slot of WEAR_SLOTS) {
    const it = lookOf(slot);
    const look = it?.id ?? null;
    if (sent[slot] === look) continue;
    try { send(api, slot, it); } catch (error) { if (import.meta.env?.DEV) console.warn('[opus-bay wear]', slot, error); }
    sent[slot] = look;
    n++;
  }
  return n;
}

/** The 小铺's try-on: show `id` (or the default look: null) in its slot until clearPreview. */
export function setPreview(slot: WearSlot, id: string | null): void {
  const it = id ? itemById(id) ?? null : null;
  if (it && it.slot !== slot) return;
  preview.set(slot, it);
  syncLooks();
}

/** Drop every try-on (the sheet closes): the worn looks come back. */
export function clearPreview(): void {
  if (!preview.size) return;
  preview.clear();
  syncLooks();
}

/** Start: the looks follow the ledger; the frame decorator; the hats' warm-up. Returns the off. */
export function initWear(): () => void {
  const offs: (() => void)[] = [
    subscribeLedger(() => { syncLooks(); }),
    registerFrameDecorator('e-frame', f => { const it = lookOf('frame'); if (it?.frame) drawFrame(it.frame, f); }, 10),
    registerWarmup('e-hats', hatWarmup),
  ];
  syncLooks();
  const timer = setInterval(() => { syncLooks(); }, 1000);
  return () => {
    clearInterval(timer);
    for (const off of offs.splice(0).reverse()) off();
    preview.clear();
    // leave the bodies as they were before (the feature stops: city teardown)
    const api = charApi();
    if (api && api === sentTo) for (const slot of WEAR_SLOTS) if (sent[slot]) { try { send(api, slot, null); } catch { /* the actors are going too */ } }
    sent = {};
    sentTo = null;
  };
}

/** tests */
export function __resetWearForTests(): void { preview.clear(); sent = {}; sentTo = null; }
