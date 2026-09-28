import { CompassBadge } from './CompassBadge';
import { initNotebook, notebookCount } from './notebookRun';
import { initShop } from './shopRun';
import { initWear } from './wear';

/**
 * Wave 5 · lane E · W5-E5 / E6 / E7: the part of the economy loaded right after the ledger's chunk (economy/index.ts):
 * the looks (wear.ts: charApi, the hats, the photo frame), the 小铺's world side (shopRun.ts: More → 小铺, the stall,
 * the 飞行券, the compass and the magnifier) and the live notebook (notebookRun.ts). The sheets themselves (Shop.tsx,
 * Notebook.tsx) load when first opened.
 */

export { notebookCount };

export function initExtras(): () => void {
  const offs = [initWear(), initShop(CompassBadge), initNotebook()];
  return () => { for (const off of offs.splice(0).reverse()) { try { off(); } catch (error) { if (import.meta.env?.DEV) console.warn('[opus-bay economy]', error); } } };
}
