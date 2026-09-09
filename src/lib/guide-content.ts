import type { GuideBlock } from '../data/guides';

/** Keep search and BayBay exports consistent with the complete readable block. */
export const guideBlockText = (block: GuideBlock): string => {
  if ('items' in block) return block.items.join('\n');
  const base = `${'title' in block && block.title ? `${block.title}\n` : ''}${block.text}`;
  return block.type === 'route' ? [base, ...block.stops.map(stop => `${stop.title}\n${stop.text}`)].join('\n\n') : base;
};
