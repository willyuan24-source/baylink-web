import { PageContainer } from './ui/HeroCard';
import { SkeletonFeed } from './ui/SkeletonCard';

/**
 * The prerendered first paint of /me, /messages, /my-week and /together (src/app/account-shell.ts): no page heading of its
 * own (each page has its own H1 once the app renders it), only a fixed-height skeleton and one polite loading line, so a
 * direct open never shows the homepage first.
 */
export function AccountShell() {
  return <PageContainer size="content" className="account-shell"><SkeletonFeed rows count={4} /></PageContainer>;
}
