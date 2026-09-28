import type { RealInfo } from '../../core/types';

/** A licensed landmark photo and its file page (data/sf/cityPois.ts CITY_PHOTOS). */
export type CityPhoto = NonNullable<RealInfo['photo']> & { page: string };

/**
 * W5-V3 (lane V): lane C's photo table, unchanged, moved into the city's data chunk (data/sf/cityDataChunk.ts) so
 * district mode never downloads it; data/sf/cityPois.ts re-exports it as CITY_PHOTOS.
 *
 * Licensed photos from src/data/sf-landmark-photo-assets.json (small 480 w variants, credits as published there),
 * only where the photo shows this landmark (the Castro photo is the crosswalk, not the theatre: not reused).
 */
export const CITY_PHOTOS: Record<string, CityPhoto> = {
  'golden-gate-bridge': { src: '/guides/attractions/sf-bridge-small.webp', credit: 'Frank Schulenburg / Wikimedia Commons (resized)', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', page: 'https://commons.wikimedia.org/wiki/File:Golden_Gate_Bridge_as_seen_from_Battery_East.jpg' },
  'palace-of-fine-arts': { src: '/guides/attractions/sf-palace-small.webp', credit: 'Daderot / Wikimedia Commons (resized)', license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/deed.en', page: 'https://commons.wikimedia.org/wiki/File:Lagoon_-_Palace_of_Fine_Arts_-_San_Francisco,_CA_-_DSC02422.jpg' },
  'dragon-gate': { src: '/guides/attractions/sf-chinatown-small.webp', credit: 'Bob B. Brown / Wikimedia Commons (resized)', license: 'CC BY 2.0', licenseUrl: 'https://creativecommons.org/licenses/by/2.0', page: 'https://commons.wikimedia.org/wiki/File:San_Francisco_California,_February_2023_-_Dragon_Gate.jpg' },
  'conservatory-of-flowers': { src: '/guides/distinct/ggp-conservatory-small.webp', credit: 'Fastily / Wikimedia Commons (resized)', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', page: 'https://commons.wikimedia.org/wiki/File:Exterior_of_the_Conservatory_of_Flowers_1_2016-11-13.jpg' },
  'painted-ladies': { src: '/guides/editorial/neighborhood-small.webp', credit: 'dconvertini / Wikimedia Commons (resized)', license: 'CC BY-SA 2.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0', page: 'https://commons.wikimedia.org/wiki/File:Alamo_Square,_San_Francisco,_California,_USA_-_52461549392.jpg' },
  'lombard-crooked-street': { src: '/guides/sf-map/lombard-small.webp', credit: 'Mattias Hill / Wikimedia Commons (resized)', license: 'CC BY 3.0', licenseUrl: 'https://creativecommons.org/licenses/by/3.0', page: 'https://commons.wikimedia.org/wiki/File:Lombard_street_in_San_Francisco.jpg' },
  'cable-car-turntable': { src: '/guides/sf-map/cable-car-small.webp', credit: 'JCruzTheTruth / Wikimedia Commons (resized)', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', page: 'https://commons.wikimedia.org/wiki/File:Cable_Car_No._15,_Powell_Market_turntable,_San_Francisco_(2012).jpg' },
  'twin-peaks': { src: '/guides/sf-map/twin-peaks-small.webp', credit: 'King of Hearts / Wikimedia Commons (resized)', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0', page: 'https://commons.wikimedia.org/wiki/File:San_Francisco_from_Twin_Peaks_September_2013_panorama_5_edit.jpg' },
  'sutro-baths': { src: '/guides/sf-map/sutro-small.webp', credit: 'Dietmar Rabich / Wikimedia Commons (resized)', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', page: 'https://commons.wikimedia.org/wiki/File:San_Francisco_(CA,_USA),_Sutro_Baths_--_2022_--_3045.jpg' },
  'de-young-tower': { src: '/guides/sf-map/de-young-small.webp', credit: 'WolfmanSF / Wikimedia Commons (resized)', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0', page: 'https://commons.wikimedia.org/wiki/File:De_Young_Museum_pano.jpg' },
  'city-hall': { src: '/guides/sf-map/city-hall-small.webp', credit: 'Bernard Spragg. NZ / Wikimedia Commons (resized)', license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/deed.en', page: 'https://commons.wikimedia.org/wiki/File:San_Francisco_City_Hall._(37843070504).jpg' },
  'oracle-park': { src: '/guides/sf-map/oracle-park-small.webp', credit: 'Missvain / Wikimedia Commons (resized)', license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/deed.en', page: 'https://commons.wikimedia.org/wiki/File:Oracle_Park_-_August_2025_-_Sarah_Stierch_-_09.jpg' },
};
