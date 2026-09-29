# Wave 6 · lane K1 · feel & play fixes

Worktree `C:/Users/willy/wt/w6-k1` (branch `w6-k1`), dev port 5601, scratch `C:/Users/willy/opus-qa/w6/k1/`, QA images
`docs/opus-bay/qa/w6/K1/`. Owns `actors/**`, `play/**` (except lane W's new files), `eggs/**`.

## 给主人的摘要

1. 手机摇杆修好了：以前手指按住时如果页面尺寸变了一下（比如 iPhone 的工具栏出现/消失），摇杆底座会跟着跑，人物会突然掉头往回走；现在摇杆只看手指本身的位置，页面怎么变都不会反向（390×844 和 375×667 都实测过）。
2. 街区模式（?world=district）恢复成和第五波之前完全一样：跳上台阶不再"手扒边缘爬上去"，攀爬只在整座旧金山模式里有。

## Part a (2026-09-29, 01:53–02:10 PDT): the floating stick, the mantle in the district

### What was built

- **W6-K1a `a4d41742`… (the stick, NEXT P0 #2, W5-Z §7.2)** `actors/pointer.ts`: the floating stick's base is kept in
  **client coordinates** (`export const stickBase = { x, y }`), like the thumb; the reading is thumb − base, so the canvas
  rect never enters it. Before, the base was stored relative to the rect and the reading was `thumb − rect − base`: a
  rect that moved for one move event (W5-Z: a CDP screenshot; on an iPhone a toolbar resize could) looked like a 60 px
  thumb jump, dragged the floating base past the rim and flipped the reading (moveY +1 → −0.99). The rect is now read
  only to paint `stickView.baseX / baseY` (what `TouchControls` draws, unchanged API), and a `resize` of the window or
  the visual viewport (`visualViewport` `resize` / `scroll`) repaints the base while a thumb is down; all listeners are
  removed on detach.
- **W6-K1b (the mantle, the lead's decision §6)** `actors/controller.ts`: W5-F10's mantle (a hop against a 0.45–1.6 u
  ledge climbs it hands first) and the "higher than 1.6 u is a wall even in a jump" rule both run only with city terrain
  (`cityTerrain()`); in the district the hop lands on the ledge as before wave 5.
- Tests: `tests/opus-bay-w6-k1-stick.test.ts` (2: a rect that jumps 60 px mid-touch keeps the reading up, then reverse
  is still instant; the drawn base follows the rect and a visual viewport resize repaints it, listeners removed) —
  **red on the old `pointer.ts`** (the reading flipped to −0.13 while the rect was off); `tests/opus-bay-w6-k1-feel.test.ts`
  (1: the district's only 1 u ledge, the plaza at the top of the stairs at (−55, 57.5), y 19.0 → 20.0: a hop from
  x −56.5 lands on the plaza with **no mantle** — **red on the old controller**: 1 mantle). The ledge was found with a
  node probe over the whole district (a 0.5 u scan for 0.5–1.5 u rises, then a run-and-hop sweep over 12 248 starts: this
  is the one place the district mantled).

### Evidence

- Checks on `fd357793`: `npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors (43 old warnings) ·
  `npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts` **1384 / 1384**, fail 0 (W5-F10's city mantle
  test unchanged and green; the hero regression green).
- Live, dev server 5601, headless Chrome (one at a time, PERF-LOCK absent), `?world=city&start=free&quality=mid`, touch,
  dpr 3 (`C:/Users/willy/opus-qa/w6/k1/stick.mjs`): thumb down at (110, 0.76 H), pushed 70 px up, held 0.8 s, then the
  viewport shrinks by 70 px mid-touch (`Emulation.setDeviceMetricsOverride`, an iOS-like toolbar coming in: `innerHeight`
  and `visualViewport.height` 844 → 774), a screenshot taken mid-touch, the viewport restored, then the thumb pulled down.
  - **390 × 844**: stick y = **1.000** at every reading while pushed (pushed · held · toolbar in · after the mid-touch
    screenshot · toolbar out), then −1.000 on the pull (instant reverse), 0 on release; the drawn base
    (`translate3d(110px, 617px)`) equals `stickBase` minus the rect, under the thumb's path.
  - **375 × 667** (→ 597 with the toolbar): the same, y = 1.000 at all five up readings, −1 on the pull.
  - Shot `docs/opus-bay/qa/w6/K1/a-stick-toolbar-phone.jpg` (read): taken with the toolbar in (390 × 774), the stick's
    base and knob drawn under the thumb, knob at the top of the ring, the HUD intact.
- (Chrome's viewport resize moves the bottom edge, so the rect's origin stays put there; the rect-jump case itself is
  the node test's, which reproduces W5-Z's flip on the old code.)

### Decisions

- Kept `stickView`'s shape (canvas-relative, for `TouchControls`) and added `stickBase` (client px) beside it rather than
  changing the paint contract; no "skip a move whose rect changed" filter is needed once the rect is out of the reading.
- The mantle gate is the whole block (mantle + the city's "too high is a wall" rule), keyed on `cityTerrain()` like the
  rest of the controller's city-only guards.

### Known gaps

- No real iPhone (as in W5-Z): a Safari top-bar collapse that moves the layout viewport's origin under a still thumb
  would still read as a thumb move (as it always did); with the game's `touch-action: none` page nothing scrolls, so
  this should not happen.

### Not done (this part)

- Nothing from part a's list.

### Requests

- None.
