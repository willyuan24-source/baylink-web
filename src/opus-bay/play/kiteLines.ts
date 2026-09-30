import type { Bilingual } from '../core/types';

/**
 * Wave 7 · lane W2 · 放风筝's words (a tiny module: the entry and the activity both read it). Every BAYBAY line here is a
 * FIXED bubble (zh + en, no numbers in it) so lane X's voice binder can match it by its text (sf-w7-lead §4 "Voice").
 * The chip's hints and status words are not spoken.
 */

export const KITE_ID = 'kite';
export const KITE_NAME: Bilingual = { zh: '放风筝', en: 'Kite flying' };

export const KITE_LINES = {
  // BAYBAY's bubbles (voiced)
  start: { zh: '放风筝咯！起风的时候按住放线，一松手它就往上爬！', en: 'Kite time! Hold to let the line out in a gust, let go and it climbs!' },
  up: { zh: '飞起来啦！', en: 'It’s flying!' },
  dive: { zh: '放太久啦，它在往下栽！快松手！', en: 'Too much line — it’s diving! Let go!' },
  crash: { zh: '哎呀，掉下来了！再放一次～', en: 'Oops, it came down! Up it goes again!' },
  top: { zh: '线全放完啦，飞得好高！', en: 'All the line out — look how high!' },
  done: { zh: '码头绿地的海风最适合放风筝了！', en: 'The sea breeze on Marina Green is made for kites!' },
  notHere: { zh: '去码头绿地或者克里西场的大草坪上放风筝吧！', en: 'Let’s fly kites on the big lawn at Marina Green or Crissy Field!' },
  // the chip (not spoken)
  hintTouch: { zh: '起风时按住「放线」，松手爬高', en: 'Hold “Let out” in a gust, let go to climb' },
  hintKeys: { zh: '起风时按住空格放线，松手爬高', en: 'Hold Space in a gust, let go to climb' },
  gust: { zh: '起风了！放线！', en: 'Gust! Let it out!' },
  lull: { zh: '风小了，松手让它爬', en: 'Lull: let it climb' },
  diving: { zh: '在往下栽！松手！', en: 'Diving! Let go!' },
} satisfies Record<string, Bilingual>;
