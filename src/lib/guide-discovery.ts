import { guides, getRelatedGuides, type Guide } from '../data/guides';
import { getBayAreaToday } from './monthly';

/** Every other guide in "Read next" order, before the date filter: the editorial topic picks for `count` places first. */
export function rankRelatedGuides(guide: Guide, count = 3): Guide[] {
  const tags = new Set(guide.tags.filter(tag => !['湾区', '生活', '攻略'].includes(tag)));
  const editorial = getRelatedGuides(guide, count).map(item => item.slug);
  const rank = (candidate: Guide) => (candidate.category === guide.category ? 4 : 0)
    + candidate.tags.filter(tag => tags.has(tag)).length * 3
    + candidate.audience.filter(audience => guide.audience.includes(audience)).length;
  return guides.filter(candidate => candidate.slug !== guide.slug)
    .sort((a, b) => (editorial.includes(a.slug) ? editorial.indexOf(a.slug) : 100) - (editorial.includes(b.slug) ? editorial.indexOf(b.slug) : 100) || rank(b) - rank(a) || b.updatedAt.localeCompare(a.updatedAt) || a.slug.localeCompare(b.slug));
}

/** Fill the reading journey across categories while keeping expired editions out of suggestions. */
export function discoverRelatedGuides(guide: Guide, count = 3, today = getBayAreaToday()): Guide[] {
  return rankRelatedGuides(guide, count)
    .filter(candidate => !candidate.editionMonth || candidate.editionMonth >= today.slice(0, 7))
    .slice(0, count);
}
