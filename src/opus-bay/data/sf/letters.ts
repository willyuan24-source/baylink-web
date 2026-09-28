import type { Bilingual } from '../../core/types';
import type { LineSource } from './lines';
import type { ResidentKey } from './residents';

/**
 * Wave 5 · lane C · W5-C7 (plan sf-w5-plan.md §3.5 "Resident letters"): a letter from each resident, a little while
 * after their second favour (game/residentTasks.ts delivers it: `letter:<key>` in goalsDone, a toast and BAYBAY's line;
 * ui/Letter.tsx shows it from the Journal's 目标 tab). Data only, in the letter's own chunk.
 *
 * Voice: the resident's own (data/VOICE.md "Transit crews and residents"), warm and short: a greeting, two or three
 * short sentences, the first name. Any real fact carries its source (checked on the web on `verifiedAt`); the rest is
 * the residents' own story (fictional people, no business names).
 */

export interface LetterDef {
  key: ResidentKey;
  /** the lines of the body (each a short paragraph), in the resident's words */
  body: readonly Bilingual[];
  /** the signature line ("叮叮！—— Ray") */
  sign: Bilingual;
  /** where the real fact in it comes from (none when it holds no fact) */
  source?: LineSource;
}

const bi = (zh: string, en: string): Bilingual => ({ zh, en });
const V5 = '2026-09-28';

export const LETTER_GREETING: Bilingual = bi('亲爱的朋友：', 'Dear friend,');

export const LETTERS: Readonly<Record<ResidentKey, LetterDef>> = {
  gripman: {
    key: 'gripman',
    body: [
      bi('你教我的那段铃声，我练了一整晚，乘客都说好听！', 'I practised your riff all night — the passengers love it!'),
      bi('联合广场的摇铃比赛已经比了五十多届。下次开赛，我就摇这一段。', 'The bell ringing contest in Union Square has run more than fifty times. Next time, that riff is mine.'),
    ],
    sign: bi('叮叮！—— Ray', 'Ding ding! — Ray'),
    source: { url: 'https://www.sfmta.com/press-releases/sfmta-announces-winners-55th-cable-car-bell-ringing-contest', verifiedAt: V5 },
  },
  baker: {
    key: 'baker',
    body: [
      bi('招牌挂上啦，好多人说钟楼拍得真漂亮。', 'The sign is up, and everyone says the clock tower looks lovely.'),
      bi('市集周六早上 8 点开，来找我吧，给你留一块刚出炉的酸面包。', 'The market opens at 8 on Saturday mornings — come by, I’ll keep a warm sourdough for you.'),
    ],
    sign: bi('—— Rosa', '— Rosa'),
    source: { url: 'https://foodwise.org/markets/ferry-plaza-farmers-market/', verifiedAt: V5 },
  },
  muralist: {
    key: 'muralist',
    body: [
      bi('谢谢你帮我收集颜色！三处的颜色，我都调进了新画里。', 'Thank you for collecting colours! All three places went into my new painting.'),
      bi('那只小水獭画在 Balmy 巷的围栏上，路过时跟它打个招呼吧。', 'The little otter is on the fence in Balmy Alley — say hi when you pass.'),
    ],
    sign: bi('—— Luz', '— Luz'),
  },
  gardener: {
    key: 'gardener',
    body: [
      bi('风车那张照片，我钉在工具棚的墙上了。', 'Your windmill photo is pinned up in my tool shed.'),
      bi('花园十月重新种球根，郁金香一般三月开得最旺。到时候再来拍一张吧！', 'The garden replants in October, and the tulips are usually best in March. Come back for another photo!'),
    ],
    sign: bi('—— Hank', '— Hank'),
    source: { url: 'https://sfrecpark.org/908/Golden-Gate-Park---Queen-Wilhelmina-Gard', verifiedAt: V5 },
  },
  ranger: {
    key: 'ranger',
    body: [
      bi('那天你坐在海滩上看大桥，像个真正的巡护员。', 'Sitting on the beach watching the bridge, you looked like a real ranger.'),
      bi('这片湿地 1999 年重新通了潮水。下次来，我带你看湿地里的水鸟。', 'The tide came back into this marsh in 1999. Next time, I’ll show you the water birds in it.'),
    ],
    sign: bi('—— Dana', '— Dana'),
    source: { url: 'https://home.nps.gov/articles/crissy-field-restoration.htm', verifiedAt: V5 },
  },
  'record-store': {
    key: 'record-store',
    body: [
      bi('海报印好啦，就贴在店门口，大家都问这是哪儿。', 'The poster is printed and up by the shop door — everyone asks where it is.'),
      bi('周末嬉皮山上常有人围成圈打鼓，谁都能加入。说不定会碰到我哦！', 'On weekends there’s often a drum circle on Hippie Hill that anyone can join. You might find me there!'),
    ],
    sign: bi('—— Marcus', '— Marcus'),
    source: { url: 'https://en.wikipedia.org/wiki/Hippie_Hill', verifiedAt: V5 },
  },
};
