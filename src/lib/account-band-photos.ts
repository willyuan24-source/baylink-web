/**
 * The two photos under the account pages' header bands (UI9-R2-ACCOUNT-UTILITY, R2-15: /me and /together "look like a
 * generic template"; no picture slot at all). Both are approved ③ category stock photos (UI9-IMG-B1b, owner approval in
 * chat 2026-10-21 09:28 PT; records in src/data/category-stock-photos.json, sources in
 * docs/category-media-sources-2026-10-21.md): no new download, no faces and no children (DECISIONS 24: a skyline and two
 * coffees). They are labelled 示意图 on the picture (DECISIONS 23) and credited under it, and they never pose as a listed
 * venue or event. The band is decorative, so `alt` is empty here (the record's alt text would only ship as an unused string).
 *
 * The page imports these two records instead of the whole registry (src/data/guide-media.ts, about 30 KB gzip), so the
 * fields are copied here; tests/ui9-r2-account-utility.test.tsx keeps every field equal to the registry's record and the
 * srcset equal to the image ladder's rungs (src/data/generated/image-ladder.json). `focal` is the band's own crop (a wide
 * strip), not the record's card focal point.
 */
export type BandPhoto = {
  key: string;
  src: string;
  srcSet: string;
  width: number;
  height: number;
  alt: string;
  credit: string;
  creditUrl: string;
  licenseUrl: string;
  focal: readonly [number, number];
};

export const BAND_PHOTOS = {
  // /me: the city across the bay at dusk (湾区去哪、怎么办).
  me: {
    key: 'stock-city-sights-2',
    src: '/guides/category-stock/stock-city-sights-2.webp',
    srcSet: '/guides/category-stock/stock-city-sights-2-small.webp 480w, /guides/category-stock/stock-city-sights-2.webp 1280w',
    width: 1280, height: 853,
    alt: '',
    credit: '示意图 · 摄影 Leo_Visions / Unsplash',
    creditUrl: 'https://unsplash.com/photos/rZfgjSxJnFA',
    licenseUrl: 'https://unsplash.com/license',
    focal: [50, 60],
  },
  // /together: two coffees on a café table: two people meeting (一起去: 散步、看展、咖啡). Not a family photo: the page is for
  // adults meeting people they don't know (18 岁以上), so no children and no faces.
  together: {
    key: 'stock-cafe-tea-4',
    src: '/guides/category-stock/stock-cafe-tea-4.webp',
    srcSet: '/guides/category-stock/stock-cafe-tea-4-small.webp 480w, /guides/category-stock/stock-cafe-tea-4.webp 1280w',
    width: 1280, height: 854,
    alt: '',
    credit: '示意图 · 摄影 Daniel Seßler / Unsplash',
    creditUrl: 'https://unsplash.com/photos/wYKEz3GPdCA',
    licenseUrl: 'https://unsplash.com/license',
    focal: [62, 45],
  },
} as const satisfies Record<string, BandPhoto>;
