import type { Bilingual } from '../../core/types';

/**
 * Wave 5 · lane V · W5-V8 (plan §5 H5-2): the six 彩蛋明信片 — secret postcards found with lane D's eggs (not among the
 * city's 24 collectable postcards: an egg's card can show its postcard once the egg is found). Painted with the recipe of
 * every shipped postcard (nano_banana_pro 4:3, refs P5 + P13; scripts/opus-sf/assets/w5/prompts.py, ledger
 * docs/opus-bay/ledger/w5-V.md), exported as 1200 × 900 and 600 × 450 WebP q82 (scripts/opus-sf/assets/w5/postcards.py).
 * Scenes only: no text, no numbers, no logos, no faces. Pure data: import it from a lazy chunk (the eggs' card, the
 * notebook), never from the main graph.
 */
export interface EggPostcard {
  /** lane D's egg id (eggs/registry.ts EGG_IDS) */
  egg: string;
  title: Bilingual;
  /** what the picture shows (the image's alt text) */
  alt: Bilingual;
  /** 1200 × 900 */
  large: string;
  /** 600 × 450 */
  small: string;
}

const DIR = '/opus-bay/w5/postcards';
const card = (egg: string, title: Bilingual, alt: Bilingual): EggPostcard => ({ egg, title, alt, large: `${DIR}/${egg}-1200.webp`, small: `${DIR}/${egg}-600.webp` });

export const EGG_POSTCARDS: readonly EggPostcard[] = [
  card('china-beach-fishermen', { zh: '中国海滩的帆影', en: 'Sails off China Beach' },
    { zh: '金色傍晚，小海湾外漂着两艘老式中国帆船，远处是金门大桥。', en: 'Two old Chinese junks off a small cove at golden hour, the Golden Gate Bridge beyond.' }),
  card('telegraph-hill-parrots', { zh: '电报山的鹦鹉', en: 'Parrots of Telegraph Hill' },
    { zh: '一群红脸蛋的绿鹦鹉飞过菲尔伯特台阶旁的花园，科伊特塔在坡顶。', en: 'Red-headed green parrots over the gardens of the Filbert Steps, Coit Tower on top.' }),
  card('wave-organ-high-tide', { zh: '涨潮的海浪风琴', en: 'The Wave Organ at high tide' },
    { zh: '防波堤尽头的石阶和管口，浪花拍上来，远处是金门大桥。', en: 'Stone steps and pipes at the end of the jetty, waves splashing, the Golden Gate beyond.' }),
  card('lands-end-labyrinth', { zh: '天涯海角的石头迷宫', en: 'The Lands End labyrinth' },
    { zh: '悬崖上一圈圈小石头摆成的迷宫，海峡对面是金门大桥。', en: 'A ring labyrinth of small stones on the cliff, the Golden Gate Bridge across the strait.' }),
  // (review) the city's flower turns 100 (named on 4 Oct 1926), not the plant: say so
  card('dahlia-dell-100', { zh: '市花大丽花一百岁', en: 'The city flower turns 100' },
    { zh: '开满大丽花的花圃挂着小彩旗，后面是白色的花卉温室。', en: 'A dahlia bed in full bloom under little pennants, the white Conservatory behind.' }),
  // (review) the title was the city postcard sf-golden-gate-fog's own (雾里的金门大桥 / The Golden Gate in the Fog), so the
  // 手帐 and the Journal named two different cards alike; this one is the foghorn egg's. The towers are orange, as the en says
  card('ggb-foghorn-duet', { zh: '雾笛响起的时候', en: 'When the foghorns sound' },
    { zh: '浓雾盖住了桥面，只露出两座橙红色的桥塔和主缆。', en: 'Thick fog hides the deck; only the two orange towers and the cables show.' }),
];

const BY_EGG = new Map(EGG_POSTCARDS.map(p => [p.egg, p]));
/** The secret postcard of an egg, or null. */
export const eggPostcard = (egg: string): EggPostcard | null => BY_EGG.get(egg) ?? null;
