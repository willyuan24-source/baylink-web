import { useEffect, useRef } from 'react';
import { lionBadges } from './sealions';
import './play.css';

/**
 * Wave 5 · lane A · the sea-lion count's numbers (overlay 'play-lion-badges', play/sealions.ts): a small gold badge with
 * its number over each lion counted, placed every animation frame from the scene system's screen points (the DOM is
 * updated directly, no React render per frame). Taps pass through to the game (pointer-events: none).
 */

export default function SeaLionBadges() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let id = 0;
    const tick = () => {
      const el = ref.current;
      if (el) {
        const list = lionBadges();
        while (el.children.length < list.length) { const b = document.createElement('span'); b.className = 'ob-play-lion-badge'; el.appendChild(b); }
        Array.from(el.children).forEach((c, i) => {
          const b = list[i], s = (c as HTMLElement).style;
          if (!b) { s.display = 'none'; return; }
          s.display = '';
          s.transform = `translate(${b.x.toFixed(1)}px, ${b.y.toFixed(1)}px)`;
          if (c.textContent !== String(b.n)) c.textContent = String(b.n);
        });
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);
  return <div ref={ref} className="ob-play-lion-badges" aria-hidden />;
}
