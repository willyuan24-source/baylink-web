import { createElement, lazy, type ComponentProps, type ComponentType } from 'react';
import type { Guide } from '../../data/guides';
import { chunkLoader } from '../../lib/chunk-recovery';

/**
 * Article blocks whose renderers carry a catalog of their own (WEB-DATA-SPLIT): the deals board reads the offer media and,
 * through it, the local-discoveries catalog; the city directory reads the attractions and the current-events cards. Only a
 * few guides have these blocks, so the renderers are chunks of their own, loaded with the guide's record (guide-store.ts)
 * and rendered synchronously once loaded: the article never suspends after its record is in, and the prerender (which
 * awaits `preloadGuideBlocks`) writes the same markup.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- React.lazy's own constraint
function preloadable<C extends ComponentType<any>>(load: () => Promise<C>) {
  let loaded: C | undefined;
  let promise: Promise<C> | undefined;
  const preload = (): Promise<C> => promise ||= load().then(component => (loaded = component)).catch((error: unknown) => { promise = undefined; throw error; });
  const Lazy = lazy(() => preload().then(component => ({ default: component })));
  function Block(props: ComponentProps<C>) {
    return loaded ? createElement(loaded, props) : createElement(Lazy, props);
  }
  return Object.assign(Block, { preload, isLoaded: () => !!loaded });
}

export const FreebieBoardBlock = preloadable(chunkLoader(() => import('../../components/FreebieBoard'), module => module.FreebieBoard));
export const CityExplorationBlock = preloadable(chunkLoader(() => import('../../components/CityExplorationDirectory'), module => module.CityExplorationDirectory));

const blocksOf = (guide: Pick<Guide, 'blocks'>) => [
  ...(guide.blocks.some(block => block.type === 'freebies') ? [FreebieBoardBlock] : []),
  ...(guide.blocks.some(block => block.type === 'city-exploration') ? [CityExplorationBlock] : []),
];

/** Load the heavy block renderers this article uses (none for most guides). */
export const preloadGuideBlocks = (guide: Pick<Guide, 'blocks'>): Promise<void> => Promise.all(blocksOf(guide).map(block => block.preload())).then(() => undefined);

/** Whether the article renders without suspending. */
export const guideBlocksReady = (guide: Pick<Guide, 'blocks'>): boolean => blocksOf(guide).every(block => block.isLoaded());

/** Every heavy block renderer (the prerender renders all guides in one process). */
export const preloadAllGuideBlocks = (): Promise<void> => Promise.all([FreebieBoardBlock.preload(), CityExplorationBlock.preload()]).then(() => undefined);
