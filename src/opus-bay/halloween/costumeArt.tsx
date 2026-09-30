import type { CostumeKind } from '../economy/items';

/**
 * Wave 6 · lane G (W6-G3) · the 小铺 tiles' pictures of the Halloween costumes (economy/Shop.tsx ItemArt asks for them
 * when an item has `costume`): small inline SVGs in the style of the shop's hat pictures.
 */
export function CostumeArt({ kind }: { kind: CostumeKind }) {
  if (kind === 'witch-hat') {
    return (
      <svg viewBox="0 0 48 48" width="46" height="46" aria-hidden>
        <ellipse cx="24" cy="36" rx="20" ry="5" fill="#2c2238" />
        <path d="M15 35 L24 9 L31 6 L27 14 L33 35 Z" fill="#3a2d4a" />
        <path d="M15.5 31c5 2 12 2 17 0l.5 4c-6 2-12 2-18 0z" fill="#e8792b" />
        <rect x="22" y="31" width="5" height="4" rx="1" fill="#e0a94a" />
      </svg>
    );
  }
  if (kind === 'pumpkin-head') {
    return (
      <svg viewBox="0 0 48 48" width="46" height="46" aria-hidden>
        <ellipse cx="24" cy="28" rx="17" ry="13" fill="#e8792b" />
        <path d="M18 16c-3 5-3 19 0 24M30 16c3 5 3 19 0 24M24 15v26" stroke="#d2641f" strokeWidth="2" fill="none" />
        <path d="M22 16c0-4 1-6 3-8" stroke="#5e7a3a" strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d="M17 25l3-4 3 4zM25 25l3-4 3 4z" fill="#3b2a18" />
        <path d="M16 31c3 4 13 4 16 0l-3 1-2-1-2 1-2-1-2 1-2-1z" fill="#3b2a18" />
      </svg>
    );
  }
  if (kind === 'bat-wings') {
    // W7-G2: the pelican's bat wings (two scalloped wings, finger ribs, the orange piping)
    return (
      <svg viewBox="0 0 48 48" width="46" height="46" aria-hidden>
        {[1, -1].map(s => (
          <g key={s} transform={s < 0 ? 'translate(48 0) scale(-1 1)' : undefined}>
            <path d="M23 20 L41 14 L45 22 L42 30 C40 27 37 27 36 31 C34 27 30 27 29 32 C27 28 25 28 23 30 Z" fill="#3b2d4a" />
            <path d="M41 14 L42 30 M41 14 L36 31 M41 14 L29 32" stroke="#231a2c" strokeWidth="1.2" fill="none" />
            <path d="M23 20 L41 14" stroke="#e8792b" strokeWidth="2.2" strokeLinecap="round" />
          </g>
        ))}
        <ellipse cx="24" cy="25" rx="4" ry="6" fill="#f6ecd9" />
      </svg>
    );
  }
  if (kind === 'cat-ears') {
    return (
      <svg viewBox="0 0 48 48" width="46" height="46" aria-hidden>
        <path d="M8 34c2-14 30-14 32 0" stroke="#2a2530" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <path d="M9 26 L12 8 L22 20 Z" fill="#2a2530" />
        <path d="M39 26 L36 8 L26 20 Z" fill="#2a2530" />
        <path d="M12 22 L13.5 13 L19 20 Z" fill="#f2a0b5" />
        <path d="M36 22 L34.5 13 L29 20 Z" fill="#f2a0b5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 48 48" width="46" height="46" aria-hidden>
      <path d="M10 42c0-22 5-34 14-34s14 12 14 34l-4-3-3 3-3-3-4 3-3-3-3 3-3-3z" fill="#f6f3ee" stroke="#d9d3c3" strokeWidth="1" />
      <ellipse cx="19.5" cy="21" rx="2.6" ry="3.6" fill="#26222b" />
      <ellipse cx="28.5" cy="21" rx="2.6" ry="3.6" fill="#26222b" />
      <ellipse cx="24" cy="29" rx="2.2" ry="2.8" fill="#26222b" />
    </svg>
  );
}
