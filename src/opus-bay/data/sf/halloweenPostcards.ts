import type { Bilingual } from '../../core/types';

/**
 * Wave 6 · lane X · W6-X2: the Halloween postcard set — four painted cards for lanes H and G to hand out (the pumpkin
 * hunt's end, a trick-or-treat door, the big night of 31 Oct, Día de los Muertos in the Mission). Not among the city's 24
 * collectable postcards: a Halloween card / the notebook's 万圣节 page shows one when its moment comes. Painted with the
 * recipe of every shipped postcard (nano_banana_pro 4:3, refs P5 + P13; scripts/opus-sf/assets/w6/prompts.py, ledger
 * docs/opus-bay/ledger/w6-X.md), exported as 1200 × 900 and 600 × 450 WebP q82 (scripts/opus-sf/assets/w6/postcards.py).
 * Scenes only: no text, no numbers, no logos, no human faces. Pure data: import it from a lazy chunk (the halloween/
 * feature), never from the main graph.
 */
export const HALLOWEEN_POSTCARD_IDS = ['halloween-pumpkin-hunt', 'halloween-trick-or-treat', 'halloween-big-night', 'muertos-mission'] as const;
export type HalloweenPostcardId = typeof HALLOWEEN_POSTCARD_IDS[number];

export interface HalloweenPostcard {
  id: HalloweenPostcardId;
  /** the moment the card belongs to (a suggestion for lanes H / G) */
  moment: 'hunt-end' | 'treat' | 'night' | 'muertos';
  title: Bilingual;
  /** what the picture shows (the image's alt text) */
  alt: Bilingual;
  /** 1200 × 900 */
  large: string;
  /** 600 × 450 */
  small: string;
}

const DIR = '/opus-bay/w6/postcards';
const card = (id: HalloweenPostcardId, moment: HalloweenPostcard['moment'], title: Bilingual, alt: Bilingual): HalloweenPostcard =>
  ({ id, moment, title, alt, large: `${DIR}/${id}-1200.webp`, small: `${DIR}/${id}-600.webp` });

export const HALLOWEEN_POSTCARDS: readonly HalloweenPostcard[] = [
  card('halloween-pumpkin-hunt', 'hunt-end', { zh: '南瓜灯全找到啦', en: 'Every pumpkin found' },
    { zh: '暮色里的公园山坡上堆满了笑眯眯的南瓜灯，小纸灯笼挂在两棵树之间，远处是维多利亚小楼和城市。', en: 'Smiling jack-o\'-lanterns heaped on a park hill at dusk, paper lanterns between two trees, Victorian houses and the city beyond.' }),
  card('halloween-trick-or-treat', 'treat', { zh: '不给糖就捣蛋', en: 'Trick or treat' },
    { zh: '维多利亚小楼的门廊亮着橙色的灯，台阶上一大碗糖果和三个南瓜灯，栏杆上挂着巫师帽和小幽灵。', en: 'A Victorian stoop under an orange porch light: a big bowl of candy, three jack-o\'-lanterns, a witch hat and a little ghost on the railing.' }),
  card('halloween-big-night', 'night', { zh: '万圣节大夜晚', en: 'The big night' },
    { zh: '万圣节夜里，“明信片排屋”每一级台阶都点着南瓜灯，大月亮挂在市中心上空，小朋友们提着南瓜桶去要糖。', en: 'Halloween night at Postcard Row: jack-o\'-lanterns on every stoop, a big moon over downtown, little trick-or-treaters with pumpkin buckets.' }),
  card('muertos-mission', 'muertos', { zh: '教会区的亡灵节', en: 'Día de los Muertos in the Mission' },
    { zh: '教会区的街上，万寿菊搭成的拱门下是一座小小的社区祭坛：蜡烛、面包、水果和糖骷髅，头顶挂满彩色剪纸旗。', en: 'A little community altar under marigold arches in the Mission: candles, bread, fruit and sugar skulls, papel picado overhead.' }),
];

const BY_ID = new Map(HALLOWEEN_POSTCARDS.map(p => [p.id, p]));
/** A Halloween postcard by id, or null. */
export const halloweenPostcard = (id: string): HalloweenPostcard | null => BY_ID.get(id as HalloweenPostcardId) ?? null;
