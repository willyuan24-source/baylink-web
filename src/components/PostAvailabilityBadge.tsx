import { postAvailability } from '../lib/postAvailability';
import type { PostData } from '../lib/types';

export function PostAvailabilityBadge({ post }: { post: PostData }) {
  const status = postAvailability(post);
  return <span title={status.detail} className={`inline-flex rounded-md px-2 py-1 text-xs ${status.tone === 'confirmed' ? 'bg-baylink-green-light text-baylink-green' : 'bg-baylink-section text-baylink-text-secondary'}`}>{status.label}</span>;
}
