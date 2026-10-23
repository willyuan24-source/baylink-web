import { createCoverPage, getCover, itemKey, judge, lookup, type CoverContext, type CoverItem, type CoverPage, type ResolvedCover } from './cover-core';

/**
 * A list's covers (UI9-R2): resolveCovers and the dealing of its ③ pictures, in their own module so a page that resolves
 * one cover at a time (/plan's weekend picks call getCover only) does not load them. Every caller imports resolveCovers from
 * lib/cover (cover.ts re-exports this module and cover-core.ts); this module imports cover-core.ts, never cover.ts, so the
 * two never import each other and the bundle puts this module only on the pages that call it.
 */

/**
 * Resolve a list in display order on one page, so de-duplication is deterministic. Its ③ pictures are dealt first (planPool).
 */
export function resolveCovers(items: readonly CoverItem[], ctx: CoverContext): ResolvedCover[] {
  const context = { ...ctx, page: ctx.page ?? createCoverPage() };
  planPool(items, context);
  return items.map(item => getCover(item, context));
}

/**
 * Deal a list's ③ pictures before it resolves (UI9-R2, R2-05): one card after another, a card that takes its first new
 * picture can leave a later card none (the 10/24 calendar: five Halloween cards, five pictures between them, one repeated).
 * A dry run on a copy of the page finds the cards that show a ③ picture; a matching over their candidates (augmenting paths
 * in display order, a free candidate first) gives as many of them as possible a picture the page has not shown, each on
 * one card. A lead keeps the picture it takes (its first, the hero-size one); an item dealt one before keeps it; a card left
 * without one repeats the picture shown farthest away (getCover).
 */
function planPool(items: readonly CoverItem[], ctx: CoverContext & { page: CoverPage }) {
  const { page } = ctx;
  const plan = page.plan ??= new Map();
  const copy: CoverPage = { ...page, claims: new Map(page.claims), order: new Map(page.order), plan: new Map(plan),
    shared: new Map([...page.shared ?? []].map(([src, shown]) => [src, new Map(shown)])) };
  const cards: { me: string; at: number; options: { key: string; src: string }[] }[] = [];
  for (const item of items) {
    const me = itemKey(item);
    const cover = getCover(item, { ...ctx, page: copy });
    if (cover.tier !== 'stock' || plan.has(me) || cards.some(card => card.me === me)) continue;
    const taken = (src: string) => [...page.shared?.get(src)?.keys() ?? []].some(other => other !== me)
      || [...plan].some(([other, held]) => other !== me && held.src === src);
    const options: { key: string; src: string }[] = [];
    for (const key of item.lead ? [cover.key] : item.imageKeys ?? (item.imageKey ? [item.imageKey] : [])) {
      const image = lookup(ctx.images, key);
      const outcome = image && judge(item, key, image, ctx, 'image');
      const src = image?.src;
      if (src && outcome && 'cover' in outcome && outcome.cover.tier === 'stock' && !taken(src) && !options.some(option => option.src === src)) options.push({ key, src });
    }
    cards.push({ me, at: copy.order!.get(me)!, options });
  }
  const owner = new Map<string, number>();
  const pick: { key: string; src: string }[] = [];
  const place = (card: number, tried: Set<string>): boolean => {
    const { options } = cards[card];
    const free = options.find(option => !owner.has(option.src));
    const take = (option: { key: string; src: string }) => { owner.set(option.src, card); pick[card] = option; return true; };
    if (free) return take(free);
    return options.some(option => !tried.has(option.src) && !!tried.add(option.src) && place(owner.get(option.src)!, tried) && take(option));
  };
  cards.forEach((_, index) => place(index, new Set()));
  cards.forEach((card, index) => { if (pick[index]) plan.set(card.me, { ...pick[index], at: card.at }); });
}
