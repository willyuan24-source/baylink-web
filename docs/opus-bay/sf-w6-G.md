# Wave 6 · lane G · Halloween games & costumes

## 给主人的摘要

1. BAYBAY 的万圣节台词表已先推送（`halloween/lines.ts`，22 句中英文），X 线可以直接录她的声音。
2. 正在做：不给糖就捣蛋——在旧金山真实的万圣节讨糖街（Belvedere、Chenery、Fair Oaks、Jordan、Sea Cliff、Hearst）的房子门口挂上装饰，走过去一点「敲门」就开门给糖、给金币。
3. 之后：小铺里的万圣节服装（女巫帽、南瓜头、幽灵披风、猫耳朵），目标卡里的万圣节目标和手帐的万圣节页。

## Part a0 · the line table (W6-G1, pushed early for lane X)

- `src/opus-bay/halloween/lines.ts`: `HALLOWEEN_LINES` (22 lines, ids `w6g-*`, zh + en, `when` notes) and `hLine(id)`.
  The game says them as BAYBAY bubbles with exactly these texts (lane X matches by text, the W5-V7 rule).
- Street facts (hedged "往年" / "usually"): https://www.rebeccarealtor.com/blog/best-neighborhoods-for-trick-or-treating-in-san-francisco-2025/
  (checked 2026-09-29: Belvedere St 17th → Parnassus, Chenery St Elk → Diamond, Fair Oaks St 21st → 26th, Jordan Ave
  Geary → California, Hearst Ave Edna → Congo closed for Halloween in 2025; Sea Cliff Ave / El Camino del Mar popular, no
  closure) and https://mommypoppins.com/san-francisco-bay-area-kids/best-places-to-trick-or-treat-on-halloween-in-san-francisco
  (checked 2026-09-29: Belvedere "One of the most well-known Halloween party spots"; Sea Cliff "several hundred
  trick-or-treaters each year").
- Test: `tests/opus-bay-w6-g-lines.test.ts` (unique ids / texts, zh ≤ 45, en ≤ 110, no controls named).
- Requests to lane X: `C:/Users/willy/opus-qa/w6/x/requests-G.md` (record the 22 lines; optional knock / creak / candy SFX).
