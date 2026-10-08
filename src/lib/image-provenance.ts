import type { GuideImage } from '../data/guide-media';

/**
 * Optional media fields the image pipeline adds over time (WEB-IMAGES: `ownShot`, `shotAt`, structured
 * `rights`; the 3D postcards: `scene3d`). Every one is optional, so today's registry reads exactly as before.
 */
export type ProvenanceInput = Pick<GuideImage, 'kind' | 'credit' | 'caption'> & {
  /** BAYLINK's own photograph (owner or editor on location): the only source of the 实拍 label. */
  ownShot?: boolean;
  /** Capture date of an own shot, YYYY-MM-DD. */
  shotAt?: string;
  /** A rendered view of the 3D world (the Opus Bay postcards), never a photograph. */
  scene3d?: boolean;
  /** Today's records keep a prose string; a structured record's `basis` decides whether the image is official. */
  rights?: string | { basis?: string };
};

const OFFICIAL_BASES = new Set(['official', 'permission', 'press-kit', 'promo-editorial']);
const rightsBasis = (image: ProvenanceInput) => typeof image.rights === 'object' && image.rights ? image.rights.basis : undefined;

/** Month/day of an own shot; the year is added only when it is not the reader's current year. */
function shotDate(shotAt: string | undefined, english: boolean, today?: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(shotAt || '');
  if (!match) return '';
  const [, year, month, day] = match;
  const monthDay = `${Number(month)}/${Number(day)}`;
  if (today?.slice(0, 4) === year) return ` · ${monthDay}`;
  return ` · ${english ? `${monthDay}/${year}` : `${year}/${monthDay}`}`;
}

/**
 * Provenance describes the asset, never whether the depicted event is current. The labels are one closed
 * vocabulary (plan D7): 官方图 · 照片 · 年份 · 资料图 · 年份 · BAYLINK 实拍 · 日期 · AI 插图 · 3D 场景插图,
 * plus BAYLINK 信息卡 for coded covers (`typeCoverProvenance`).
 */
export function getImageProvenance(image: ProvenanceInput, english = false, today?: string): string {
  if (image.scene3d) return english ? '3D scene illustration' : '3D 场景插图';
  if (image.kind === 'illustration') return english ? 'AI illustration' : 'AI 插图';
  if (image.ownShot) return `${english ? 'BAYLINK photo' : 'BAYLINK 实拍'}${shotDate(image.shotAt, english, today)}`;
  const basis = rightsBasis(image);
  if (image.kind === 'poster' || (basis && OFFICIAL_BASES.has(basis)) || /官方|official/i.test(image.credit)) return english ? 'Official image' : '官方图';
  // The capture year comes from the caption only: credits carry usernames and licences ("Runner1928 · CC BY-SA 3.0").
  const year = image.caption.match(/(?:19|20)\d{2}/)?.[0];
  const withYear = (label: string) => `${label}${year ? ` · ${year}` : ''}`;
  if (/资料|往届|archive|historical/i.test(image.caption)) return withYear(english ? 'Archive photo' : '资料图');
  // Third-party and press photos: "实拍" would claim BAYLINK took them (VISUAL+5).
  return withYear(english ? 'Photo' : '照片');
}

/** A coded cover (`<TypeCover>`) is an information card set from the listing's own facts, not a picture. English is short
 * ("Info card") so the badge fits a 173px card beside the ♡. */
export const typeCoverProvenance = (english = false) => english ? 'Info card' : 'BAYLINK 信息卡';
