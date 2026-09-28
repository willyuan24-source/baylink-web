import type { Bilingual } from '../core/types';
import { markToday, usedToday } from './gates';
import { type EggHost, invalidate, later, momentFree, note, operator, props, reveal, say, sound } from './hosts';
import { eggById } from './registry';

/**
 * Wave 5 · lane D (W5-D3) · Chinatown and downtown: egg 4 (the old telephone exchange's phone) and egg 6 (Emperor
 * Norton's bridge decree): a prompt, a sound and paper on screen; Norton's post + scroll (140 tris) stands in the prop
 * pool since lane V published the downtown headroom (eggs/props.ts DOWNTOWN_PROPS_HELD, released 2026-09-28).
 */

// --- egg 4 · the phone at 743 Washington St ---------------------------------------------------------------------

const PHONE = 'chinatown-telephone-exchange';
/** Who the player can ask for (the operator is fictional, a first name only). */
export const OPERATOR_CHOICES: readonly Bilingual[] = [
  { zh: '找 BAYBAY', en: 'BAYBAY, please' },
  { zh: '找街坊', en: 'A neighbour, please' },
  { zh: '找草药店', en: 'The herb shop, please' },
];
/** The three calls: comic, and they claim nothing real. */
export const OPERATOR_REPLIES: readonly Bilingual[] = [
  { zh: 'BAYBAY：喂？……咦，我不就在你旁边嘛！', en: 'BAYBAY: Hello? …Wait, I’m right next to you!' },
  { zh: '街坊：你好呀！天气这么好，下次来喝茶！', en: 'Neighbour: Hello there! Lovely day — come for tea next time!' },
  { zh: '草药店：今天没什么不舒服？那就多喝热水吧！', en: 'Herb shop: Feeling fine today? Then drink some warm water!' },
];
/** the phone rings for this long (s) when you come by, once a visit, until a call goes through that Bay day */
const RING_S = 26;
const RING_EVERY = 4;

export function phoneHost(): EggHost {
  const egg = eggById(PHONE)!;
  let ringing = false;
  let ringLeft = 0;
  let nextRing = 0;
  let rangThisVisit = false;
  const stop = () => { if (ringing) { ringing = false; invalidate(); } };
  const answer = () => {
    stop();
    sound('egg:plug');
    operator({
      choices: OPERATOR_CHOICES,
      onPick: i => {
        // (review) the call is "used" for the Bay day only once it goes through: hanging up (×, Esc, walking off, the
        // operator's 20 s) used to mark the day too, and the phone never rang again that day — the find was lost
        markToday('phone');
        say(OPERATOR_REPLIES[i] ?? OPERATOR_REPLIES[0]);
        later(() => { reveal(PHONE, { cardDelay: 1.2 }); }, 3600);
      },
    });
  };
  const ring = (t: number) => {
    ringing = true;
    ringLeft = RING_S;
    nextRing = t;
    rangThisVisit = true;
    invalidate();
  };
  return {
    id: PHONE,
    range: 40,
    enter: () => { rangThisVisit = false; },
    update: ctx => {
      if (!ringing && !rangThisVisit && ctx.dist <= 14 && !usedToday('phone') && momentFree()) ring(ctx.t);
      if (!ringing) return;
      ringLeft -= ctx.dt;
      if (ringLeft <= 0 || ctx.dist > 32) { stop(); return; }
      if (ctx.t >= nextRing) { nextRing = ctx.t + RING_EVERY; sound('egg:phone', egg.at, { near: 5, far: 36 }); }
    },
    leave: stop,
    interactables: () => (ringing ? [{
      id: `egg:${PHONE}`, source: 'find', action: 'info', verb: { zh: '接电话', en: 'Answer the phone' }, name: egg.name,
      x: egg.at.x, z: egg.at.z, radius: 3.2, act: answer,
    }] : []),
    qa: () => { ring(0); answer(); },
  };
}

// --- egg 6 · Emperor Norton's decree at the Bay Bridge -------------------------------------------------------------

const NORTON = 'emperor-norton-bridge-decree';
/**
 * The proclamation in our own playful words (never a quote): his 1872 decrees asked for a bridge from Oakland by Goat
 * Island, "provided such bridge can be built without injury to the navigable waters of the Bay" (emperornortontrust.org,
 * read 2026-09-28) — hence "let the ships pass beneath". Affectionate, never mocking.
 */
export const NORTON_NOTE = {
  title: { zh: '诺顿一世 敬告全城', en: 'Norton I, to the whole city' },
  lines: [
    { zh: '朕命令：修一座大桥，从奥克兰经羊岛，一直通到旧金山！', en: 'We command: a bridge from Oakland, by way of Goat Island, all the way to San Francisco!' },
    { zh: '桥要结实，工期要快，大船还要能从桥下通过。', en: 'Build it strong, build it soon, and let the great ships pass beneath.' },
    { zh: '（BAYBAY 小声说：64 年后，它真的修好啦。）', en: '(BAYBAY whispers: 64 years later, it was built.)' },
  ],
  sign: { zh: '—— 诺顿一世 · 1872（BAYBAY 转述）', en: '— Norton I, 1872 (in BAYBAY’s words)' },
} as const;

export function nortonHost(): EggHost {
  const egg = eggById(NORTON)!;
  // the post and scroll stand 1.4 u off the stand spot (off the walk line); held downtown until V's headroom
  props.set(`egg:${NORTON}`, { kind: 'decree', x: egg.at.x + 1.4, z: egg.at.z - 0.6, heading: -0.5 });
  const read = () => {
    sound('egg:fanfare', egg.at, { near: 6, far: 40 });
    // the lines and the card once the scroll is put away
    note({ style: 'scroll', title: NORTON_NOTE.title, lines: NORTON_NOTE.lines, sign: NORTON_NOTE.sign }, () => { reveal(NORTON, { cardDelay: 1.4 }); });
  };
  return {
    id: NORTON,
    range: 30,
    interactables: () => [{
      id: `egg:${NORTON}`, source: 'find', action: 'info', verb: { zh: '读一读圣旨', en: 'Read the decree' }, name: egg.name,
      x: egg.at.x, z: egg.at.z, radius: 3, act: read,
    }],
    dispose: () => props.set(`egg:${NORTON}`, null),
    qa: read,
  };
}
