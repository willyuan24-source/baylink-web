import type { Locale } from '../../i18n/locale';
import type { Bilingual } from '../core/types';
import { withLang } from '../data/links';

/**
 * Wave 6 · lane S (W6-S3) · BAYLINK's new openings in the toy city: a small 新店 / New sign at the street address of each
 * opening of GPT's autumn release (`src/data/autumn-release-openings.json`, 2026-09-29) that is in San Francisco, open
 * (not only announced) and has a street address OpenStreetMap confirms. E at the sign opens a card with the shop's name,
 * what it is, the address, the site's note on hours and a link to its BAYLINK page (`/openings/:id`). Nothing is sold
 * and no coin is paid here: it is a pointer to the site, like the event cards.
 *
 *   OPENING_SIGNS      the signs (the site's id, name, address; the OSM point and the day it was checked)
 *   openingUrl(id, l)  the BAYLINK page
 *   (realsf/openingSigns.ts initOpenings(), city mode: the nearest sign within SIGN_NEAR is built — one merged mesh on
 *   the event kits' material program —, its pennant flies near it, E opens the card realsf/OpeningCard.tsx)
 *
 * The point is where the site's address is in OSM; the sign stands on the pavement next to it (a probe over the
 * published city's walking network, tests/opus-bay-w6-s-openings.test.ts).
 */

export interface OpeningSign {
  /** BAYLINK's opening id (`/openings/:id`) */
  id: string;
  name: string;
  what: Bilingual;
  address: string;
  /** the site's hours note, shortened (its page has the full text); it names the shop's own site as the one to check */
  hours: Bilingual;
  /** the sign on the pavement at the address (world units) and the way it faces (rad) */
  x: number;
  z: number;
  yaw: number;
  /** the address in OpenStreetMap (its point), and the day it was checked */
  osm: { lat: number; lng: number };
  osmUrl: string;
  verifiedAt: string;
  /** the site's own check of the opening */
  siteVerifiedAt: string;
}

const deg = (d: number) => (d * Math.PI) / 180;

export const OPENING_SIGNS: readonly OpeningSign[] = [
  {
    id: 'sergeant-ma', name: 'Sergeant Ma',
    what: { zh: '水岸餐厅 · 加州食材配亚洲风味', en: 'Waterfront restaurant · California produce, Asian flavours' },
    address: '185 Berry Street, San Francisco, CA 94107',
    hours: { zh: '官网：周一至周六 16:00–21:00，周日休息', en: 'Its site: Mon–Sat 16:00–21:00, closed Sunday' },
    // 185 Berry St is China Basin's two buildings (OSM ways 46264110 "Berry Street Building", 46264108 "Wharfside")
    x: 358.7, z: 208.3, yaw: deg(302), osm: { lat: 37.7764556, lng: -122.3921108 },
    osmUrl: 'https://www.openstreetmap.org/way/46264110', verifiedAt: '2026-09-29', siteVerifiedAt: '2026-09-28',
  },
  {
    id: 'kaiyo-handroll-union', name: 'Kaiyō Handroll Bar',
    what: { zh: '日秘融合手卷吧', en: 'Nikkei handroll bar' },
    address: '1838 Union St, San Francisco, CA 94123',
    hours: { zh: '订位时间以门店官网为准', en: 'Booking hours: see its site' },
    // OSM node 693507981 "KAIYŌ, 1838 Union Street"; the sign on the pavement pocket beside the building
    x: -205.8, z: 305.5, yaw: deg(84), osm: { lat: 37.7979631, lng: -122.4295323 },
    osmUrl: 'https://www.openstreetmap.org/node/693507981', verifiedAt: '2026-09-29', siteVerifiedAt: '2026-09-29',
  },
  {
    id: 'sf-athanor-new-restaurant-2026', name: 'Athanor',
    what: { zh: '十道式晚餐餐厅（需预订）', en: 'Ten-course dinner restaurant (booking)' },
    address: '2600 Sutter Street, San Francisco, CA',
    hours: { zh: '官网：晚餐周二至周六，周日、周一休息', en: 'Its site: dinner Tue–Sat, closed Sun–Mon' },
    // OSM way 27054290 (the address 2600 Sutter Street, Lower Pacific Heights)
    // the point falls on the toy corner of Sutter & Broderick: the sign on the pavement beside the corner building
    x: -178.5, z: 569.5, yaw: deg(51), osm: { lat: 37.784889, lng: -122.443353 },
    osmUrl: 'https://www.openstreetmap.org/way/27054290', verifiedAt: '2026-09-29', siteVerifiedAt: '2026-09-28',
  },
];

/** the site's page of an opening */
export const openingUrl = (id: string, locale: Locale) => withLang(`/openings/${encodeURIComponent(id)}`, locale);

/** the sign is built within this distance of the player (u); its pennant shows within FLAG_FAR */
export const SIGN_NEAR = 260;
export const FLAG_FAR = 320;
/** the E prompt stands 1 u in front of the sign (its front: local +z turned by yaw) and answers within PROMPT_R */
export const PROMPT_R = 5;
export const signFront = (s: Pick<OpeningSign, 'x' | 'z' | 'yaw'>) => ({ x: s.x + Math.sin(s.yaw), z: s.z + Math.cos(s.yaw) });
export const OPENING_GOLD = '#e0a94a';
export const OVERLAY_ID = 'realsf-opening';

export const signById = (id: string) => OPENING_SIGNS.find(s => s.id === id);

