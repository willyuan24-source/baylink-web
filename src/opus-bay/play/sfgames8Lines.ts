import type { Bilingual } from '../core/types';

/**
 * Wave 8 · lane M · the second set of San Francisco mini-games: their names and BAYBAY's FIXED lines (zh + en, never
 * templated: lane X voices lines by their exact text — a count, a score or a place name goes on the panel or the card,
 * never into a bubble). One small module the zones chunk (play/sfgames8.ts) and each game's chunk import.
 *
 *   grip     working the grip on a Powell St cable car: hold the grip lever on the climb, let go before the
 *            Powell × California crossing and the corners (coast), let go into the stops, take the rope again as the
 *            car leaves, ring the bell at the cross streets — read from the running ride, never changing it
 *   busk     playing along with the street guitarist on Haight St (a tambourine) or 24th St (maracas): a synthesized
 *            loop, the taps judged on the beat
 *   foghorn  the Golden Gate's foghorns at Fort Point, under the bridge's south end: listen to the horns' call, blow it
 *            back (three real horns: the south tower's, the two at mid-span; a long blast is held)
 *
 * Facts (checked on the web 2026-09-30):
 * - the grip: the cables run under the street "at a constant 9 ½ miles an hour"; "Powell Street cars have to let go of
 *   the cable because the Powell Street cable runs beneath the California Street cable", they coast across and take
 *   the rope again; on "let-go" (drift) curves the gripman releases the cable and coasts round, on "pull curves" pulleys
 *   guide it; the bell warns people, cars and other cable cars (https://www.cablecarmuseum.org/archive/Anat/Anat.html);
 *   the gripman works the grip with one hand "clanging the bell to keep crossing automobiles from getting in his way"
 *   with the other, and a mechanism under Powell St forces the cable out of a grip held too long
 *   (https://www.streetcar.org/wheels-motion/cable-cars-work/); after California the Powell cars "coast downhill, off
 *   the cable, for three and a half blocks"; Hyde St from Chestnut to Bay is "the steepest grade in the cable car
 *   system—a harrowing 21 percent slope" (https://www.streetcar.org/wheels-motion/ride-cable-car-lines/); "Gripping a
 *   cable car requires extraordinary skills: arm, hand and upper body strength, mental and physical coordination"
 *   (https://www.sfmta.com/press-releases/sfmta-announces-third-woman-ever-serve-cable-car-grip).
 * - the busker: the Summer of Love, 1967 — "As many as 100,000 people … converged in San Francisco's Haight-Ashbury"
 *   (https://en.wikipedia.org/wiki/Summer_of_Love); the Calle 24 Latino Cultural District, recognized by the Board of
 *   Supervisors in May 2014, "the most murals in the city" (https://en.wikipedia.org/wiki/Calle_24_Latino_Cultural_District).
 * - the foghorns: two at the south (San Francisco) tower pier — "A 2-second blast, an 18-second pause"; three at
 *   mid-span that "sound as two blasts, each with a distinct tones"; switched on and off by hand by bridge workers when
 *   the fog rolls in (https://www.goldengate.org/bridge/history-research/bridge-features/foghorns-beacons/).
 */

// --- the cable-car grip -------------------------------------------------------------------------------------------------

export const GRIP_ID = 'grip';
export const GRIP_NAME: Bilingual = { zh: '叮当车 · 拉闸', en: 'Cable car · work the grip' };

export const GRIP_LINES = {
  invite: { zh: '想当一回叮当车司机吗？拉闸、松闸，还要摇铃！', en: 'Want to be the gripman? Grip, let go, and ring the bell!' },
  start: { zh: '上坡抓紧缆绳，看到红色就松开！', en: 'Grip the cable uphill, and let go at the red!' },
  cross: { zh: '前面是加州街路口，松开缆绳滑过去！', en: 'California Street ahead: drop the rope and coast!' },
  corner: { zh: '要转弯了，松开缆绳滑过去！', en: 'A corner: let go and coast round!' },
  letgoGood: { zh: '松得正好！滑过去～', en: 'A perfect let-go! Coast on through!' },
  alarm: { zh: '警报！松晚了，下次早一点～', en: 'The alarm! Let go a bit sooner next time.' },
  take: { zh: '过来了，再抓住缆绳！', en: 'Made it! Take the rope again!' },
  stopGood: { zh: '松闸、刹车，停得稳稳的！', en: 'Let go, brake, and a smooth stop!' },
  stopBad: { zh: '进站前要先松开缆绳哦！', en: 'Let go of the cable before the stop!' },
  depart: { zh: '发车啦，快拉闸！', en: 'We’re off: grip!' },
  slip: { zh: '上坡要抓紧，不然车会往下溜！', en: 'Hold tight uphill, or we’ll roll back!' },
  bellFirst: { zh: '叮叮！过路口记得摇铃！', en: 'Ding-ding! Ring at every crossing!' },
  bellSpam: { zh: '铃不用一直摇哦～', en: 'No need to ring all the time!' },
  hyde: { zh: '海德街这段坡有百分之二十一，是叮当车最陡的一段！', en: 'This bit of Hyde is a 21% grade: the steepest on the line!' },
  star: { zh: '你是真正的叮当车司机！', en: 'You’re a real cable-car grip!' },
  good: { zh: '开得不错！下次再开一趟！', en: 'Nice driving! Let’s do another run!' },
  short: { zh: '这趟太短啦，下次坐远一点再拉闸！', en: 'That ride was too short! Grip on a longer one next time.' },
  factSpeed: { zh: '街下面的缆绳一直在跑，每小时九点五英里！', en: 'The cable under the street never stops: nine and a half miles an hour!' },
  factCross: { zh: '真的鲍威尔线叮当车，过加州街都要松开缆绳滑过去。', en: 'Real Powell cars drop the rope to coast across California Street.' },
  factStrength: { zh: '拉闸要用全身的力气，叮当车司机真的很厉害！', en: 'Gripping takes real strength and coordination. Grips are amazing!' },
} satisfies Record<string, Bilingual>;

// --- play along with the busker ---------------------------------------------------------------------------------------------

export const BUSK_ID = 'busk';
export const BUSK_NAME: Bilingual = { zh: '和街头艺人合奏', en: 'Jam with the busker' };

export const BUSK_LINES = {
  inviteHaight: { zh: '海特街的街头艺人！拿个铃鼓一起合奏？', en: 'A Haight Street busker! Grab a tambourine and jam?' },
  inviteMission: { zh: '24 街的吉他手！拿对沙锤一起合奏？', en: 'A 24th Street guitarist! Grab some maracas and jam?' },
  closed: { zh: '街头艺人下午才来，我们先练练他的曲子吧！', en: 'The busker comes in the afternoon. Let’s practise his tune!' },
  start: { zh: '跟着节拍，圆点碰到圈就拍！', en: 'Follow the beat: tap as each dot meets the ring!' },
  combo: { zh: '节奏感真好！路人都在点头！', en: 'Great groove! People are nodding along!' },
  miss: { zh: '别急，听着鼓点再拍～', en: 'Easy now, listen for the beat.' },
  chorus: { zh: '副歌来啦，加点花样！', en: 'Here comes the chorus: add some flair!' },
  end: { zh: '一曲结束！大家都在鼓掌！', en: 'That’s the song! Everyone’s clapping!' },
  star: { zh: '你们简直就是一支乐队！', en: 'You two sound like a real band!' },
  factHaight: { zh: '1967 年的“爱之夏”，十万年轻人涌进了海特街一带。', en: 'In the 1967 Summer of Love, up to 100,000 young people came to the Haight.' },
  factMission: { zh: '24 街是拉丁文化区，旧金山壁画最多的地方！', en: '24th Street is the Latino Cultural District, with the most murals in the city!' },
} satisfies Record<string, Bilingual>;

// --- the foghorns' call and answer ------------------------------------------------------------------------------------------

export const FOG_ID = 'foghorn';
export const FOG_NAME: Bilingual = { zh: '金门大桥 · 雾笛对答', en: 'Golden Gate · foghorn call and answer' };

export const FOG_LINES = {
  invite: { zh: '南塔的雾笛就在旁边！来玩雾笛对答？', en: 'The south tower’s foghorns are right here! Call and answer?' },
  start: { zh: '先听雾笛，再照着吹一遍！长音要按住！', en: 'Listen to the horns, then blow them back! Hold for a long one!' },
  ship: { zh: '大船从雾里开出来了！', en: 'A big ship is coming out of the fog!' },
  good: { zh: '对上了！船都听见啦！', en: 'Spot on! The ships heard you!' },
  wrong: { zh: '哎呀，吹错啦，再听一遍～', en: 'Oops, wrong horn. Listen again.' },
  hold: { zh: '南塔的长音要按住哦～', en: 'Hold the south horn for its long blast!' },
  anchor: { zh: '这艘船先抛锚等一等，下一艘！', en: 'This one drops anchor to wait. Next ship!' },
  longer: { zh: '雾更浓了，雾笛也更长了！', en: 'The fog’s thicker, and the calls get longer!' },
  star: { zh: '你是金门大桥的雾笛手！', en: 'You’re the Golden Gate’s foghorn keeper!' },
  end: { zh: '雾散了，船都平安进港！', en: 'The fog lifts, and every ship is safely in!' },
  factSouth: { zh: '南塔的雾笛吹两秒，再停十八秒。', en: 'The south tower horn: a two-second blast, then eighteen seconds of quiet.' },
  factMid: { zh: '桥中间的雾笛一次吹两声，两声音调不一样！', en: 'The mid-span horns blow twice, each in its own tone!' },
  factWorkers: { zh: '起雾的时候，是桥上的工作人员手动打开雾笛的。', en: 'When the fog rolls in, bridge workers switch the horns on by hand.' },
} satisfies Record<string, Bilingual>;
