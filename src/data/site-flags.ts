/**
 * Owner switches for whole parts of the site (WEB-COMMUNITY-2).
 *
 * COMMUNITY_VISIBLE (H04 fallback, default true). Set it to false in a one-line PR to pause 邻里信息 (the neighborhood
 * board) while it has no real posts:
 * - no 邻里 entry in the 更多 (•••) panel, on the home page or in search (QuickExplore);
 * - /category/* and post pages (the app, the prerendered pages and the server post page) show a calm
 *   「邻里信息暂停中」 page with noindex, and say where messages are;
 * - the sign-in sheet's account line promises no posting (LoginModal, W5-INT);
 * - /messages and existing conversations keep working (nothing is deleted; flipping it back shows everything again).
 * The OPUS contract is untouched either way (npm run test:opus).
 */
export let COMMUNITY_VISIBLE = true;

/** Tests only: render both states in one process (an ES module export is a live binding). */
export function setCommunityVisibleForTests(visible: boolean): void {
  COMMUNITY_VISIBLE = visible;
}
