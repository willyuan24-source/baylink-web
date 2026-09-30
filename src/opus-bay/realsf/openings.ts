import type { Locale } from '../../i18n/locale';
import type { Bilingual } from '../core/types';
import { withLang } from '../data/links';

/**
 * Wave 6 · lane S (W6-S3) · BAYLINK's new openings in the toy city: a small 新店 / New sign at the street address of each
 * opening the site publishes that is in San Francisco, open (not only announced) and has a street address OpenStreetMap
 * confirms. W7-S: the site's own list and rule — `currentOpenings` (src/data/local-discoveries.ts), status open /
 * soft_open, region sf, the filter src/data/planner-local-stops.ts uses — not only the autumn release file (Raising
 * Cane's, La Boulangerie at ERIA, the Mess Hall were published by the site but had no sign). E at the sign opens a card with the shop's name,
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
  // ---- W7-S: the site's other open San Francisco openings (currentOpenings, 2026-09-29); OSM read on 2026-09-29 ----
  {
    id: 'raising-canes-jefferson-sf', name: 'Raising Cane’s · Fisherman’s Wharf',
    what: { zh: '炸鸡柳快餐 · 旧金山首店', en: 'Chicken-finger counter · its first in SF' },
    address: '211 Jefferson Street, San Francisco, CA 94133',
    hours: { zh: '门店页：每天 10:00 起，营业到深夜', en: 'Store page: daily from 10:00 until late' },
    // OSM way 91185861 (the address 211 Jefferson Street); the sign on the Jefferson St pavement 3.2 u west of it, facing
    // the street — 6.8 u from the Crab Wheel sign (37.8079, -122.4159), whose card would otherwise take the E prompt
    x: -204.6, z: 79.4, yaw: deg(71.8), osm: { lat: 37.8080974, lng: -122.4160763 },
    osmUrl: 'https://www.openstreetmap.org/way/91185861', verifiedAt: '2026-09-29', siteVerifiedAt: '2026-09-27',
  },
  {
    id: 'boulangerie-eria-celebration', name: 'La Boulangerie at ERIA Marina',
    what: { zh: '法式面包咖啡馆', en: 'French bakery café' },
    address: '2300 Chestnut Street, San Francisco, CA 94123',
    hours: { zh: '官网：每天 7:00–14:30，周末有早午餐', en: 'Its site: daily 7:00–14:30, weekend brunch' },
    // OSM way 272700939 (2300–2320 Chestnut Street); the sign on the Chestnut St pavement in front
    x: -331.8, z: 387.0, yaw: deg(153.4), osm: { lat: 37.8003427, lng: -122.4415071 },
    osmUrl: 'https://www.openstreetmap.org/way/272700939', verifiedAt: '2026-09-29', siteVerifiedAt: '2026-09-15',
  },
  {
    id: 'mess-hall-presidio-breadwinner', name: 'The Mess Hall · Breadwinner',
    what: { zh: '公园餐饮大厅 · 汉堡三明治', en: 'Park food hall · burgers, sandwiches' },
    address: '201 Halleck Street, San Francisco, CA 94129',
    hours: { zh: 'Breadwinner 11:00 起，其他档口看官网', en: 'Breadwinner from 11:00; other stalls: its site' },
    // OSM way 30130770 (Building 201, 201 Halleck Street, by Presidio Tunnel Tops); the sign facing the Tunnel Tops lawn
    x: -471.5, z: 482.2, yaw: deg(303), osm: { lat: 37.8026073, lng: -122.454658 },
    osmUrl: 'https://www.openstreetmap.org/way/30130770', verifiedAt: '2026-09-29', siteVerifiedAt: '2026-09-15',
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

