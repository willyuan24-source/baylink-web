import type { Bilingual } from '../core/types';

/**
 * Wave 6 · lane G (W6-G1) · BAYBAY's Halloween lines for the games (trick-or-treat, the costumes, the season's goal):
 * ONE table with fixed Simplified Chinese + English texts (繁體 comes from the site's conversion). Lane X records her
 * voice from this table and matches the bubbles by their exact text (game/voiceW5.ts rule): a text that changes here
 * is simply no longer voiced, so change a line only together with its recording.
 *
 * Rules (data/VOICE.md): one idea per bubble, zh ≤ 45 characters, en ≤ ~110; street facts hedged ("往年" / "usually":
 * never a promise of a closure); no controls in a line. The street lines' facts come from
 * https://www.rebeccarealtor.com/blog/best-neighborhoods-for-trick-or-treating-in-san-francisco-2025/ (checked
 * 2026-09-29): the blocks and the Halloween street closures of each street; Belvedere St as "One of the most
 * well-known Halloween party spots" and Sea Cliff's "several hundred trick-or-treaters each year" from
 * https://mommypoppins.com/san-francisco-bay-area-kids/best-places-to-trick-or-treat-on-halloween-in-san-francisco
 * (checked 2026-09-29). Where the doors stand: halloween/treatDoors.ts.
 *
 * `when` says where the game uses the line (for the recording notes; the code picks lines by id).
 */
export interface HalloweenLine extends Bilingual {
  /** stable id (the recording's file name: `<zh|en>-<id>`) */
  id: string;
  /** where it is said */
  when: string;
}

export const HALLOWEEN_LINES: readonly HalloweenLine[] = [
  // --- trick-or-treat ----------------------------------------------------------------------------------------------
  { id: 'w6g-knock', when: 'every knock on a decorated door', zh: '不给糖就捣蛋！', en: 'Trick or treat!' },
  { id: 'w6g-thanks', when: 'the door opened with a treat', zh: '谢谢您！万圣节快乐！', en: 'Thank you! Happy Halloween!' },
  { id: 'w6g-again', when: 'a door already knocked today', zh: '这家我们来过啦，去下一家吧！', en: 'We’ve been here already — on to the next house!' },
  { id: 'w6g-nobody', when: 'a door that does not answer today (not on the big night)', zh: '没人在家……门上贴着「出去讨糖啦」！', en: 'Nobody’s home… the note says “Out trick-or-treating!”' },
  { id: 'w6g-treat-hour', when: 'the first time in the treat hours (16–22) near a door street', zh: '门廊的灯都亮起来了，正是讨糖的好时候！', en: 'The porch lights are on — perfect time for trick-or-treating!' },
  { id: 'w6g-big-night', when: 'the first door street visit on 31 October', zh: '今晚是万圣节！每家都开门，糖果还加倍！', en: 'It’s Halloween night! Every door’s open, and the treats are doubled!' },
  { id: 'w6g-bag-heavy', when: 'the fifth treat in the candy bag', zh: '糖果袋越来越沉啦！', en: 'Our candy bag’s getting heavy!' },
  { id: 'w6g-not-too-much', when: 'the tenth treat', zh: '糖果留着慢慢吃，一次别吃太多哦！', en: 'Let’s save some candy — not too much at once!' },
  { id: 'w6g-all-doors', when: 'every door of the season knocked', zh: '哇，我们敲遍了所有的门！', en: 'Wow — we’ve knocked on every single door!' },
  { id: 'w6g-season-over', when: 'at a door on 1–2 November', zh: '万圣节过去啦，明年再来讨糖吧！', en: 'Halloween’s over — let’s come trick-or-treating again next year!' },
  // --- the streets (said once a session, the first time near one; facts: halloween/treatDoors.ts TREAT_STREETS) -----
  { id: 'w6g-street-belvedere', when: 'first time near Belvedere St (Cole Valley)', zh: '贝尔维德街是城里最有名的万圣节讨糖街之一，往年还会封街！', en: 'Belvedere Street is one of the city’s best-known Halloween streets — it usually closes to cars, too!' },
  { id: 'w6g-street-chenery', when: 'first time near Chenery St (Glen Park)', zh: '格伦公园的 Chenery 街，往年万圣节傍晚会封街讨糖。', en: 'In Glen Park, Chenery Street usually closes to cars on Halloween evening for trick-or-treaters.' },
  { id: 'w6g-street-fair-oaks', when: 'first time near Fair Oaks St (Noe Valley)', zh: 'Fair Oaks 街是诺伊谷的万圣节老地方，往年会封街！', en: 'Fair Oaks Street is Noe Valley’s Halloween classic — it usually closes to cars!' },
  { id: 'w6g-street-jordan', when: 'first time near Jordan Ave (Jordan Park)', zh: '乔丹公园这边，往年万圣节 Jordan 大道会封街讨糖。', en: 'Here in Jordan Park, Jordan Avenue usually closes to cars for Halloween.' },
  { id: 'w6g-street-sea-cliff', when: 'first time near Sea Cliff Ave (Sea Cliff)', zh: '海崖区的大房子万圣节都装饰得好隆重，每年有好几百人来讨糖！', en: 'Sea Cliff’s big houses go all out for Halloween — hundreds of trick-or-treaters come every year!' },
  { id: 'w6g-street-hearst', when: 'first time near Hearst Ave (Sunnyside)', zh: '阳光谷的 Hearst 大道，往年万圣节傍晚也会封街讨糖。', en: 'In Sunnyside, Hearst Avenue usually closes to cars on Halloween evening too.' },
  // --- costumes (the 小铺; BAYBAY reacts the first time a costume is worn) -------------------------------------------
  { id: 'w6g-costume-witch', when: 'BAYBAY wears the witch hat', zh: '我像不像一个小女巫？', en: 'Do I look like a little witch?' },
  { id: 'w6g-costume-pumpkin', when: 'BAYBAY wears the pumpkin head', zh: '嘿嘿，今天我是一颗南瓜！', en: 'Hee hee — today I’m a pumpkin!' },
  { id: 'w6g-costume-ghost', when: 'the player wears the ghost sheet', zh: '哇！小幽灵，吓我一跳！', en: 'Whoa! A little ghost — you made me jump!' },
  { id: 'w6g-costume-cat', when: 'the player wears the cat ears', zh: '喵～你的猫耳朵好可爱！', en: 'Meow~ I love your cat ears!' },
  { id: 'w6g-costume-first', when: 'the first costume of the save (with the reward)', zh: '穿上服装，我们就能去讨糖啦！', en: 'Now we’re in costume, we can go trick-or-treating!' },
  // --- the season's goal ------------------------------------------------------------------------------------------
  { id: 'w6g-goal-done', when: 'the Halloween goal done (five doors)', zh: '敲开了五户人家的门，糖果袋满满的！', en: 'Five doors knocked — our candy bag is full!' },
];

const BY_ID = new Map(HALLOWEEN_LINES.map(l => [l.id, l]));

/** A line by id as a bubble text ({ zh, en }); throws on an unknown id (a typo would be a silent bubble). */
export function hLine(id: string): Bilingual {
  const l = BY_ID.get(id);
  if (!l) throw new Error(`[opus-bay halloween] no line ${id}`);
  return { zh: l.zh, en: l.en };
}
