# Wave 6 · lane X · Visuals, models, animation, sound (+ Higgsfield)

Worktree `C:/Users/willy/wt/w6-x` (branch `w6-x`), dev port 5609, scratch `C:/Users/willy/opus-qa/w6/x/`, ledger
`docs/opus-bay/ledger/w6-X.md`, QA files `docs/opus-bay/qa/w6/X/`. The only Higgsfield spender of wave 6 (cap 1000,
floor 1375).

## 给主人的摘要

1. 万圣节明信片画好了 4 张（找齐南瓜灯、不给糖就捣蛋、10/31 大夜晚、教会区亡灵节），和以前的明信片同一种手工黏土小模型画风；已交给做万圣节的两条线（H、G）去放进游戏。
2. 万圣节音效做好了：敲门三下 → 门吱呀打开 → 糖果哗啦倒进桶里 → 叮！；找到南瓜灯时一声可爱的“呜～”加一串铃声；换上万圣节服装“噗”的一声魔法亮晶晶；10/31 晚上远处钟楼敲一下。全部是程序合成，不占下载，只有万圣节活动开始后才加载。
3. 到目前为止 Higgsfield 只花了 10 分（上限 1000），每一笔都记在账本里。

## Part a1 · Halloween postcards and sounds (2026-09-29 01:53–02:25 PDT)

### What was built

| task | files |
|---|---|
| **W6-X2** the Halloween postcard set (Higgsfield batch 1) | `scripts/opus-sf/assets/w6/{prompts.py,prompts.json,postcards.py}` (new), `public/opus-bay/w6/postcards/` (8 WebP, 501 KB), `src/opus-bay/data/sf/halloweenPostcards.ts` (new), `docs/opus-bay/ledger/w6-X.md` (new) |
| **W6-X3** the Halloween sounds | `src/opus-bay/audio/halloween.ts` (new, lazy chunk), `src/opus-bay/audio/audio.ts` (one `case` + a 6-line lazy loader) |
| tests | `tests/opus-bay-w6-x.test.ts` (new, 5 tests) |

**Postcards (W6-X2).** Four cards for lanes H and G, painted with the recipe of every shipped postcard (nano_banana_pro
4:3 2k, refs P5 + P13, the style contract; the contract's golden-hour light swapped for "warm glowing lantern light in a
soft blue dusk" because all four are dusk / night scenes): `halloween-pumpkin-hunt` (the hunt's end), `halloween-trick-or-treat`
(a door), `halloween-big-night` (31 Oct at Postcard Row), `muertos-mission` (a community altar under marigold arches, papel
picado with plain cut patterns). 1200 × 900 and 600 × 450 WebP q82. API:

```ts
// src/opus-bay/data/sf/halloweenPostcards.ts — pure data, import from a lazy chunk only
export const HALLOWEEN_POSTCARD_IDS = ['halloween-pumpkin-hunt', 'halloween-trick-or-treat', 'halloween-big-night', 'muertos-mission'] as const;
export interface HalloweenPostcard { id; moment: 'hunt-end' | 'treat' | 'night' | 'muertos'; title: Bilingual; alt: Bilingual; large; small }
export const HALLOWEEN_POSTCARDS: readonly HalloweenPostcard[];
export const halloweenPostcard: (id: string) => HalloweenPostcard | null;
```

**Sounds (W6-X3).** `audio/audio.ts` routes the frozen `{ type: 'halloween', what, id }` event to `audio/halloween.ts`,
fetched as its own chunk at the first such event (nothing enters the main graph, lane P's budget): `treat` → three
knuckle knocks on a panelled door, an old hinge's creak, a crinkle of wrapped candies and three plastic taps into the
bucket, a G–C–E chime (≈ 1.7 s); `pumpkin` → a breathy cartoon-ghost glide (E4 → C5 with wobble) under an A-minor
celesta run that resolves to C major; `costume` → a glitter poof (a lowpass-opening noise swell) and an E-major twinkle, or
a small pop when taken off (`id` ''); `phase` `night` → one far D3 clock-tower toll with a breath of wind, once a session.
All synthesized with the engine's primitives (no files), like every sound in `audio/`.

### Evidence

- Rendered offline with the real engine in headless Chrome (`OfflineAudioContext`, `C:/Users/willy/opus-qa/w6/x/sfx/render.mjs`)
  and measured with ffmpeg ebur128: treat −27.0 LUFS (peak −6.3 dBFS, the knocks), pumpkin −26.8, costume −26.8 / off −36.6
  (a 0.15 s pop), night toll −29.3 (meant far away) — next to the shipped postcard −25.9, goal −25.3, stamp −28.9 LUFS.
  The treat's spectrogram shows the three knocks at 0 / 0.17 / 0.34 s, the creak at 0.62–1.1 s, the candy grains at
  1.1–1.4 s, the taps and the chime after. Listening files: `docs/opus-bay/qa/w6/X/sfx-{treat,pumpkin,costume-on,costume-off,night-toll}.m4a`.
- Postcards: every draw read at full size (no letters, numbers, logos or human faces; the candy wrappers patterned only);
  one redraw (the big night's draw a showed a backdrop edge on the cream void). The test checks each WebP's header size.
- Higgsfield: 5 draws, **10.00 credits** (balance 2375 → 2365, reconciled with `transactions`: ledger batch 1).

### Decisions

- The Halloween sounds are synthesized, not generated: the Higgsfield server offers speech only for standalone audio (its
  sound-effect model is reserved for its game pipeline), and every sound in `audio/` is synthesized anyway (no downloads).
- The `treat` vignette starts with the knock so it reads right whether lane G emits the event at the knock or when the door
  answers.
- The Halloween sounds load lazily from `audio.ts` (the main graph) so they add nothing to GameRoot (lane P's target).

### Requests

- **Lanes H and G**: the file names and the API are in `C:/Users/willy/opus-qa/w6/x/delivered.md` (and above): show
  `halloweenPostcard(id)?.large / .small` with its `title` / `alt` at your moments; emit the frozen `halloween` events for
  the sounds (nothing to import). Say BAYBAY's Halloween lines as BAYBAY bubbles with the texts of your line tables and
  they will speak once lane X's voice batch lands.
