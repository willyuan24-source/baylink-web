import type { GuideImage } from '../data/guide-media';

/**
 * The home catalog's compact srcset (UI9-IMG-B2): an image's D8 ladder rungs as one digit, 1 = an `-800` file, 2 = a `-1200`
 * file (3 both, 0 neither), from which homeImageSrcSet writes the exact srcset again (data/image-ladder.ts ladderSrcSet's
 * rule, repeated here so the home's JS does not load the ladder table; tests/image-manifest.test.ts holds the two equal).
 * scripts/generate-home-catalog.ts stores the digit only when it rebuilds the image's srcset character for character;
 * src/lib/home-catalog.ts expands it.
 */
const rung = (src: string, suffix: string) => src.replace(/\.webp$/, `-${suffix}.webp`);

export function homeImageSrcSet({ src, width }: Pick<GuideImage, 'src' | 'width'>, rungs: number): string {
  if (width <= 480) return `${src} ${width}w`;
  const candidates = [`${rung(src, 'small')} 480w`];
  if ((rungs & 1) === 1 && width > 800) candidates.push(`${rung(src, '800')} 800w`);
  candidates.push((rungs & 2) === 2 ? `${rung(src, '1200')} ${Math.min(1200, width)}w` : `${src} ${width}w`);
  return candidates.join(', ');
}

export function homeImageRungs(image: Pick<GuideImage, 'src' | 'width' | 'srcSet'>): number | undefined {
  if (!image.srcSet) return undefined;
  const rungs = (image.srcSet.includes(`${rung(image.src, '800')} `) ? 1 : 0) + (image.srcSet.includes(`${rung(image.src, '1200')} `) ? 2 : 0);
  return homeImageSrcSet(image, rungs) === image.srcSet ? rungs : undefined;
}
