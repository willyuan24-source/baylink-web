# Wave 6 · lane X · Visuals, models, animation, sound (+ Higgsfield)

Worktree `C:/Users/willy/wt/w6-x` (branch `w6-x`), dev port 5609, scratch `C:/Users/willy/opus-qa/w6/x/`, ledger
`docs/opus-bay/ledger/w6-X.md`, QA files `docs/opus-bay/qa/w6/X/`. The only Higgsfield spender of wave 6 (cap 1000,
floor 1375).

## 给主人的摘要

1. 万圣节明信片画好了 4 张（找齐南瓜灯、不给糖就捣蛋、10/31 大夜晚、教会区亡灵节），和以前的明信片同一种手工黏土小模型画风；已交给做万圣节的两条线（H、G）去放进游戏。
2. 万圣节音效做好了：敲门三下 → 门吱呀打开 → 糖果哗啦倒进桶里 → 叮！；找到南瓜灯时一声可爱的“呜～”加一串铃声；换上万圣节服装“噗”的一声魔法亮晶晶；10/31 晚上远处钟楼敲一下。全部是程序合成，不占下载，只有万圣节活动开始后才加载。
3. 城市里的路人变可爱了：以前是没有脸、肤色发色都一样的小人，现在有眼睛（带高光）、腮红、短袖子和小手，每个人的肤色和发色都不一样，和 BAYBAY、主角同一种圆滚滚的玩具风格（只改城市模式，街区模式不变）。
4. 到目前为止 Higgsfield 只花了 10 分（上限 1000），每一笔都记在账本里。

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

## Part a2 · the owner's "直接优化": the city's people (2026-09-29 02:40–03:05 PDT)

### What I shot and what was weakest

Desktop 1440 × 900 (quality high) and phone 390 × 844 dpr 3 (quality mid) at the title, the Ferry Building start, the
Painted Ladies, the Golden Gate (Presidio arrival), the Dragon Gate and Coit Tower (golden hour), BAYBAY and the player
up close (`C:/Users/willy/opus-qa/w6/x/shots/`). Ranked, the weakest things a player sees most:

1. **The people.** The city crowd and the promenade walkers (in almost every shot, often within a few metres of the
   camera) were the district promenade's faceless figure: a capsule, a ball head with a hair cap, stick legs, floating
   shirt-coloured hands, and one skin and one hair colour for everybody — next to the polished BAYBAY, the player and
   the residents (faces, cheeks, nub arms) they looked unfinished. → **fixed in this part (W6-X5)**.
2. The downtown / Chinatown blocks: grey-blue boxes with large flat windows right beside the Dragon Gate.
3. The day sky: a flat pale beige at street level (the golden-hour and night skies look good).
4. The gulls on the water read as grey blobs from the Ferry plaza.

### What was built (W6-X5)

| file | change |
|---|---|
| `src/opus-bay/world/sf/crowd.ts` (surgical, named) | new `cityPersonGeometry()` — the crowd's near figure; the far figure's head joins the tone channel; `cityPeopleFigure.make` registered at import |
| `src/opus-bay/world/life.ts` (surgical, named) | `peopleMaterial`: the shirt tint only for `aInfo.x` 9, new channel 10 = skin / hair picked per walker from its phase (7 skin tones, 8 hair colours; a dark vertex colour is hair, a light one skin); `cityPeopleFigure` + `Life.pickPeopleFigure`: the promenade's walkers wear the city figure in city mode, the district figure otherwise |
| `tests/opus-bay-w6-x.test.ts` | +2 tests |

The new figure (the residents' shape language, `actors/models.ts buildNpc`): stubby capsule legs up into the body and
bean shoes (swinging as before), a soft capsule body in the walker's shirt tint, nub sleeves tilted out, mitten hands in
the walker's skin (the x > 0 hand still waves back, W5-T1), a round head with two dark bean eyes with a white glint and
rosy cheeks, a hair cap over the crown and the back. **664 triangles** (the old one 324; the crowd draws at most
`CROWD.nearMax` = 18 near figures a frame: ≤ 12k, + ≈ 6k over wave 5 worst case; the far figure stays 92). **No new draw
call, material or program** (the same `ob-people` program, the same instanced attributes).

### Evidence

- `docs/opus-bay/qa/w6/X/x5-crowd-alamo-before-after.jpg` and `x5-crowd-ferry-before-after.jpg` (desktop, same spots):
  faces, cheeks, sleeves and hands; skin tones from light to dark brown and hair from black to blond / grey in one crowd.
  Phone 390 × 844 at the Painted Ladies (`shots/ph-painted-after.jpg`, read): the near walkers show their faces; the one
  inside the lens shrink (≤ 3.6 u) shows a faceted head (it shrinks away as before).
- The district: `personGeometry()` (324 triangles, no channel 10) is what the district's walkers wear; the test checks it
  carries no tone channel and that `pickPeopleFigure(false)` restores it.
- Checks: tsc 0 · eslint 0 errors · suite (below, before the push).

### Decisions

- Faces and tones in code, not a generated GLB: a Higgsfield character would be a new draw call and a skinned model per
  walker (the crowd is one instanced mesh of up to 64); the procedural figure matches the residents exactly.
- Tones from the walker's phase in the shader (no new attribute): the phase is a per-walker constant, so a walker keeps
  its skin and hair across LOD switches (the far figure uses the same hash).
