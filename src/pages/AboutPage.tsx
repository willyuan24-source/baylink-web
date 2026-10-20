import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { AboutContent } from '../components/AboutContent';
import { useApp } from '../app/context';
import '../components/about-baylink.css';

/**
 * /about#about-method-title is the one 我们怎么核对 target (captain decision 10; the footer, 更多 and the trust lines link
 * it). The page scrolls to the hash once it has rendered, on a direct load (the app replaces the prerendered page) and
 * after an in-app link; html's scroll-padding-top (design.css) lands the heading 16px under the sticky header.
 */
export default function AboutPage() {
  const { openBayBay, warmBayBay } = useApp();
  const { hash, key } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const target = document.getElementById(hash.slice(1));
    if (!target) return;
    const frame = window.requestAnimationFrame(() => target.scrollIntoView({ block: 'start', behavior: 'auto' }));
    return () => window.cancelAnimationFrame(frame);
  }, [hash, key]);
  return <AboutContent onAskBayBay={() => openBayBay()} onWarmBayBay={warmBayBay} />;
}
