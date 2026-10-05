import type { FreebieOffer } from '../components/FreebieBoard';
import { GUIDE_IMAGES } from '../data/guide-media';

/** Offers show traceable photos/posters, or a text card when no suitable image exists. */
export function getListingImage(imageKey: string) {
  const image = Object.hasOwn(GUIDE_IMAGES, imageKey) ? GUIDE_IMAGES[imageKey] : undefined;
  return image?.kind === 'illustration' ? undefined : image;
}

export const getOfferImage = (offer: Pick<FreebieOffer, 'imageKey'>) => getListingImage(offer.imageKey);
