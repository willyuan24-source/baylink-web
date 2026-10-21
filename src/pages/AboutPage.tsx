import { AboutContent } from '../components/AboutContent';
import { useApp } from '../app/context';
import '../components/about-baylink.css';

/**
 * /about#about-method-title is the one 我们怎么核对 target (captain decision 10; the footer, 更多 and the trust lines link
 * it). The layout's usePageScroll lands it, on a direct load and after an in-app link (it waits for the page to render),
 * and Back restores the reader's own place; html's scroll-padding-top (design.css) puts the heading 16px under the sticky
 * header, and the page arrival does not rise when the URL has a hash (route-arrival.tsx), so nothing moves it after.
 */
export default function AboutPage() {
  const { openBayBay, warmBayBay } = useApp();
  return <AboutContent onAskBayBay={() => openBayBay()} onWarmBayBay={warmBayBay} />;
}
