# BAYBAY — voice sheet (Opus Bay)

Owner: content. Read this before writing or editing any line in `data/script.ts`, `data/pois.ts` barks or `data/postcards.ts`.

## Who BAYBAY is

BAYBAY is BAYLINK's cream-white sea otter: a local who has walked the Embarcadero a thousand times and still gets excited about it.
BAYBAY meets newcomers at the ferry, walks them along the water and hands them over to BAYLINK when they are ready to plan a real outing.

- **Warm and curious.** Asks, notices, points things out. Treats the player as a new friend, never as a customer.
- **Loves** the waterfront, sourdough, the sea lions at PIER 39, a good bench with a bay view, the fog.
- **Gently funny.** Small jokes, never at the player's expense. The fog is called "Karl" like locals do ("Karl 今天请假了"). Sea-lion puns are allowed once per scene.
- **Honest.** BAYBAY says "出发前查官网确认" instead of pretending to know today's hours. Wildlife is never guaranteed ("看缘分").
- **Never salesy.** No "must buy", no "best deal", no brand praise. Paid things are named as options, free things first.
- **Local, not a tour-bus mic.** Specific over generic: "周四晚上 After Dark 只限 18+", not "a great place for everyone".

## Line rules

1. One bubble = one idea. Chinese ≤ 45 characters (hard limit, tested). English ≤ ~110 characters.
2. Every stop teaches exactly **one real, specific, useful fact**, and every fact in a line has a source in `pois.ts` / `postcards.ts` (`sourceUrl`, `verifiedAt`). No invented numbers.
3. Hours/prices: always hedged ("约", "多数时候", "出发前查官网"). Never promise an event or a light show.
4. Real people are never impersonated. NPCs (vendor, fisher, streetcar operator, tourist family, jogger) are clearly fictional characters with first names only, and they never state facts that are not sourced.
5. No controller-specific hints in dialogue ("按 E"): the HUD shows the right key or button. Say "走过去看看", not "press E".
6. Chinese is written in Simplified Chinese; Traditional is derived automatically. Avoid regional slang that does not convert well.
7. English is natural, not a word-for-word translation. Same facts, same warmth, same length budget.
8. BAYLINK is mentioned only when it genuinely helps: credited tips ("BAYLINK 攻略说…") and the final handoff ("把想去的地方带去 BAYLINK 安排吧").

## Moods (`Mood` in core/types.ts)

| mood | use |
|---|---|
| `wave` | hello, goodbye, calling the player over |
| `happy` | default warm line |
| `excited` | discoveries, sea lions, postcards |
| `point` | "look at that" — landmark introductions |
| `thinking` | questions, honest caveats ("这个我也得查一下") |
| `proud` | tour milestones, recap |

## Sample lines

- 嗨！欢迎来到湾区～我是 BAYBAY。第一次来吗？ / Hi! Welcome to the Bay — I'm BAYBAY. First time here?
- Karl 今天好像请假了，天这么蓝，走起！ / Looks like Karl the Fog took the day off. Let's go!
- 海狮不收门票，但也不保证准时上班——看缘分。 / The sea lions are free, but they don't keep office hours.
- 票价我记不住最新的，出发前一定查官网哦。 / I can never remember the latest prices — check the official site before you go.
