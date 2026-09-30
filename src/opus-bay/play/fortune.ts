import type { Bilingual } from '../core/types';
import { closeOverlay, openOverlay } from '../ui/slots';
import { bestOf, saveNumber, startActivity, type ActivityRun } from './kit';
import { freeOnFoot } from './partc';
import { FORTUNE_NAME } from './sfgamesLines';
import { ensureSfSounds } from './sfgamesSounds';

/**
 * Wave 7 · lane M · the fortune-teller automaton beside the claw machine in the Musée Mécanique: 算一卦 → the glass booth
 * whirs, her hand passes over the crystal ball, and a card slides out: a playful fortune and a real San Francisco fact
 * (each with its page, checked on the web). The next card each time (the count is kept in `play.b['fortune-n']`), no
 * medal, no coins: a keepsake. The panel is FortunePanel.tsx (overlay 'play-fortune', its own chunk).
 */

export interface Fortune { luck: Bilingual; fact: Bilingual; source: string }

export const FORTUNES: readonly Fortune[] = [
  {
    luck: { zh: '你会在一个意想不到的地方找到宝藏。', en: 'You will find treasure where you least expect it.' },
    fact: { zh: '这座老游戏机博物馆有 300 多台投币机器，进门免费，玩一台放一两枚 25 美分硬币。', en: 'This arcade museum has over 300 coin-operated machines. Walking in is free; a game is a quarter or two.' },
    source: 'https://www.sanfranciscobay.com/museums/musee-mecanique/',
  },
  {
    luck: { zh: '老东西会给你带来新的快乐。', en: 'Something old will bring you something new.' },
    fact: { zh: '这里最老的一台是 1884 年的“活动视镜”，转起来画就会动。', en: 'The oldest machine here is a praxinoscope from 1884: spin it and the pictures move.' },
    source: 'https://en.wikipedia.org/wiki/Mus%C3%A9e_M%C3%A9canique',
  },
  {
    luck: { zh: '好运会像海狮一样，一群一群地来。', en: 'Your luck will arrive like sea lions: in crowds.' },
    fact: { zh: '1989 年大地震之后，海狮开始爬上 39 号码头的 K 码头，1990 年起就在这儿安家了。', en: 'After the 1989 earthquake, sea lions began hauling out on PIER 39’s K-Dock, and they have lived there since 1990.' },
    source: 'https://www.pier39.com/sea-lions/',
  },
  {
    luck: { zh: '起雾的日子，你会听见大桥在唱歌。', en: 'On a foggy day, you will hear the bridge sing.' },
    fact: { zh: '起雾时金门大桥会响雾笛：南塔是一长声，桥中间是两短声。', en: 'In fog the Golden Gate Bridge sounds its horns: one long blast at the south tower, a double one at mid-span.' },
    source: 'https://www.goldengate.org/bridge/history-research/bridge-features/foghorns-beacons/',
  },
  {
    luck: { zh: '你会走上一条弯弯曲曲的好路。', en: 'Your road will be crooked, and lovely.' },
    fact: { zh: '九曲花街最弯的这一段有 8 个急弯，而且只能往下开。', en: 'Lombard Street’s crooked block has eight hairpin turns, and it is one way, downhill.' },
    source: 'https://en.wikipedia.org/wiki/Lombard_Street_(San_Francisco)',
  },
  {
    luck: { zh: '你的日子会像酸面包，越放越有味道。', en: 'Your days will be like sourdough: better with time.' },
    fact: { zh: '1849 年淘金热的时候，酸面包就成了旧金山的日常面包。', en: 'Since the Gold Rush of 1849, sourdough has been San Francisco’s everyday bread.' },
    source: 'https://en.wikipedia.org/wiki/History_of_bread_in_California',
  },
  {
    luck: { zh: '耐心等一等，好东西会自己爬进你的网。', en: 'Be patient: good things will crawl into your net.' },
    fact: { zh: '7 号码头长 840 英尺，是公共钓鱼码头：在这里钓鱼捞蟹不用执照。', en: 'Pier 7 is an 840-foot public fishing pier: no fishing licence needed there.' },
    source: 'https://www.pierfishing.com/pier-7-san-francisco/',
  },
  {
    luck: { zh: '有人会为你笑得停不下来。', en: 'Someone will laugh with you until they cannot stop.' },
    fact: { zh: '笑婆婆 Sal 以前在海边的 Playland 游乐场笑个不停，那座游乐场 1972 年关了门。', en: 'Laffing Sal used to laugh at Playland-at-the-Beach, which closed in 1972.' },
    source: 'https://en.wikipedia.org/wiki/Mus%C3%A9e_M%C3%A9canique',
  },
];

export const FORTUNE_OVERLAY = 'play-fortune';
export const FORTUNE_KEY = 'fortune-n';
/** How long the booth works before the card slides out (ms). */
export const FORTUNE_WORK_MS = 1600;

/** The fortune the n-th visit gets (in order, then round again). */
export const fortuneFor = (n: number): Fortune => FORTUNES[((n % FORTUNES.length) + FORTUNES.length) % FORTUNES.length];

export const FORTUNE_ID = 'fortune';
let run: ActivityRun | null = null;

/** 算一卦: the booth and the next card. Returns the card (null when a card cannot show now). */
export function tellFortune(): Fortune | null {
  if (run?.active || !freeOnFoot()) return null;
  const r = startActivity({ id: FORTUNE_ID, name: FORTUNE_NAME }, { lock: true, cancelOnMove: true, onStop: () => { run = null; closeOverlay(FORTUNE_OVERLAY); } });
  if (!r) return null;
  run = r;
  ensureSfSounds();
  const n = Math.max(0, Math.floor(bestOf(FORTUNE_KEY) ?? 0));
  const f = fortuneFor(n);
  saveNumber(FORTUNE_KEY, n + 1);
  openOverlay(FORTUNE_OVERLAY, { fortune: f, n: n + 1 });
  return f;
}
/** The card closed (好的, ✕, Esc, the overlay going away): the activity ends, no medal, no card. */
export function fortuneDone() { run?.end({ tier: 0, card: false }); }
export const closeFortune = () => closeOverlay(FORTUNE_OVERLAY);
