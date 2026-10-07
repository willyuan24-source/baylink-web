import type { Guide } from './guides';
import guideData from './octnov-2026-guides.json';

// Each entry records its own sources and review date; older catalog entries keep theirs.
export const octnov2026Guides = guideData as Guide[];
