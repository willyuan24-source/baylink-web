# Wave 9 · lane A · input, accessibility, robustness

Lane A of wave 9 (worktree `C:/Users/willy/wt/w9-a`, branch `w9-a`, dev port 5910, scratch `C:/Users/willy/opus-qa/w9/a/`).
Brief: `docs/opus-bay/sf-w9-lead.md` §3 A; the first-use review `docs/opus-bay/review-2026-10-01-first-use.md` §6 界面与交互
/ 技术 rows and `C:/Users/willy/opus-qa/review-1001/tech/notes.md`, `verify-tech/notes.md` (keyboard / AX / contrast).

## 给主人的摘要

1. **菜单听键盘的话了**：BAYBAY 的菜单按 Esc 或空格就是“没事，继续逛”，空格再也不会误选第一项“做个动作”；菜单最多 6 行 + 「更多…」，最常用的排在前面（下一个目标、附近、这周、今天），每一行都有数字键。
2. **不会再叠两层**：打开设置（暂停）时按 Q，设置会先关上再出 BAYBAY 的菜单，小游戏不会在暂停中开始；E 键先给小游戏和明信片，再给地点卡，最后才是 BAYBAY 和长椅；刚关掉对话的那一下 E 不会再触发别的。
3. **手机返回键 / 浏览器后退**：先关掉打开的菜单、面板或小游戏，什么都没开时才离开游戏，不会被困住。
4. **存储被浏览器禁止时**会提示一次「这次的进度无法保存（浏览器禁止了存储）」，游戏照常能玩。
5. 读屏软件不会再一个字一个字地念打字机效果；Tab 键不会跑到看不见的按钮上，也不会跑出对话卡片。

## Part a · W9-A1 … A3 menus, one modal at a time, E priority, focus, back button, the storage hook (21:35–23:55 PDT)

### Before (measured on origin `f1460b0c`, dev server 5910, 1440 × 900, `?save=off`, keyboard only)

Scratch `C:/Users/willy/opus-qa/w9/a/shots/before/` and `ax/`:

- Q menu: **12–13 rows** (`b04-ask.jpg`; 13 with the flight ticket), keys 1–9 only (rows 10–13 had none: tech/ax-chat.txt).
- **Esc** on the menu: nothing (12 rows still open). **Space**: picked row 1 「做个动作」 and opened the emote wheel
  (`b05-space.jpg`, the review's verify-tech `t08-space.jpg`).
- **Esc → Settings, then Q**: Settings (paused) **and** the 13-row menu open together (`b06-esc-q.jpg`, the review's
  gamer `025-ask.jpg`).
- The goals card (`section.ob-gstep`, `aria-modal="true"`): Tab ×1 → the HUD's objective pill, ×2 → 问 BAYBAY, ×3 → 地图
  (outside the modal).
- **Back** with the map open: left the game (`about:blank` in the harness; `/` on the site, tech/notes.md).

### What was built

- **BAYBAY's menus** (`ui/askMenu.ts` new, pure; `ui/Dialogue.tsx`):
  - The call menu (`flow.call`) shows **5 rows chosen by context + 「更多…」 + 没事，继续逛** (6 rows + 更多); the rest
    sit on page 2 (≤ 9 rows a page, the last one 「返回」). The order: carry on with what is under way (the tour's next
    stop, a paused trip `n-take-me`), the next goal, a game you stand at (kite / ball / frisbee), the flight ticket and
    **any ask row this table does not know (another lane's new item, e.g. G's 附近能玩什么) — page 1 while there is
    room**, 附近有什么 / 这周有什么, 今天旧金山有什么, the tours, then 那是什么 / 捉迷藏 / 做个动作 / 摸摸 / 打开地图. The node's
    choices are untouched (flow, QA hooks and `chooseDialogue(index)` work as before); a call menu of ≤ 7 rows stays on
    one page. Any other menu pages only past 9 rows, in its own order, with its cancel row on page 1 (the station menus).
  - **Every row of every page has a digit key** 1–9 (the key shown is the key that works).
  - **Esc and Space cancel** a menu through its cancel row (the last choice that only ends the dialogue: 没事，继续逛 ·
    先不用 · 先不坐了 · 下次吧). A menu without one (the welcome's four ways, the week questions) ignores both — **Space
    never picks row 1**. Space still presses a row the player moved to themselves (Tab / arrows), like any button; a
    Space turned into "cancel" is also swallowed on keyup (Firefox clicks on keyup). Arrow keys move between rows (wrap).
  - The box is no longer an `aria-live` region (the typewriter was re-announced step by step): the typed text is
    `aria-hidden`, an `.ob-sr` copy holds the whole line, and flow's `announce(node.text)` (ui/Floating LiveRegion) still
    says each line once. A menu is `aria-modal="true"`; `data-ob-cancel` tells the back button whether Escape can close it.
- **One modal at a time** (`game/flow.ts`, surgical, lane F's file): Q (and the HUD's BAYBAY button) closes the open
  panel first — Settings' pause too, so a game picked from the menu never starts paused; `openCallMenu` never opens over
  a panel (a call answered late after the player opened the map). E does nothing while Settings pauses the game.
- **E priority** (`ui/interactPriority.ts` new, pure; `game/interactables.ts` `focusWeight` / `setFocusWeight`;
  `game/brain.ts` one line, surgical, lane F's file): in the city an activity / pickup / the tour's stop (tier 0) beats a
  place card, a resident, a station (1), which beats BAYBAY, a bench, a parked ride and the follow-you 坐下 (2): `tier × 3`
  is added to the distance score, so inside a tier the old weights decide. The rule is installed by the play layer (its
  code stays out of GameRoot); **the district's weights never change** (brain applies it in the city only).
- **E after a close** (`game/interactables.ts` `noteDialogClosed` / `justClosedDialog`; flow's `closeDialogue`,
  `closePanel`, `closePostcardReward` note it): `requestInteract` ignores the world for 400 ms after a line / card closed.
- **Focus** (`ui/focusTrap.ts` new): Tab / Shift+Tab wrap inside the topmost shown `[aria-modal="true"]` dialog (the goals
  step, the postcard card, the recaps, the album, BAYBAY's menus); a focus outside comes back in. A dialog that took the
  focus from a **keyboard-focused** control gives it back when it closes (the map → its HUD button); after a mouse click the
  focus stays where the game had it (a focused button would take Space, the jump, from a mouse player).
- **The HUD inert while faded** (`ui/Hud.tsx`, surgical, lane Q's file): the round buttons are `inert` while a line or the
  fishing strip fades them (opus-bay.css `.is-talking`): out of Tab and the accessibility tree.
- **The back button / gesture** (`ui/backGuard.ts` new): while something closable is open (a panel, an overlay, photo
  mode, the postcard card, fishing, a cancellable line / menu, any shown `[role="dialog"]` of the game, a game in
  progress), one same-URL history entry (`state.obBack`) sits on top; back pops it and the game gets an **Escape — the
  key's own close**. A close from inside the game takes the entry off again (a swallowed `history.back()`), so with nothing
  open back leaves as it always did. **Never strands**: the entry is put back only while something is still open after
  the close, and a back whose Escape closed nothing (a dialog that ignores Escape) is let through next time. The router
  sees a same-URL pop (the state keeps its `idx` / `key`). The welcome, cinematics and the title are never caught.
- **Storage refused → one notice** (`data/save.ts`: the one hook `onWriteFailure` + `noteWriteFailure` +
  `storageBlocked`; `data/wishlist.ts` surgical): a blocked storage getter (Chrome with site data blocked: "The operation
  is insecure") or a throwing `setItem` (full / private mode) is told **once a visit**; `?save=off` never. The play layer
  says 「这次的进度无法保存（浏览器禁止了存储）」 / "Your progress can’t be saved this time (the browser blocks storage)." as
  a 7 s toast once the game is playing (a failure before Start waits for it). Not a BAYBAY line (no voice).
- The play layer installs the trap, the back guard, the E weight and the notice once (`usePlayA11y` in `ui/Dialogue.tsx`,
  always mounted after the title): the new modules ride in the play-layer chunk, not GameRoot.

### Evidence

- Tests (red on the old code where they fix a bug — checked by running them against origin's `flow.ts` / `brain.ts` /
  `interactables.ts`: all three W9-A2 tests failed, "Settings closed", "the place card, not BAYBAY", "E 300 ms after the
  close: ignored"):
  - `tests/opus-bay-w9-a.test.ts` (8): the menu pages (the review's 13-row menu → page 1 = next goal · flight ticket ·
    附近 · 这周 · 今天 · 更多 · 没事), ranking, the live call menu with six extra ask rows, Esc→Q, the E tiers (claw vs 坐下,
    card vs BAYBAY, district unchanged), E after a close / while paused, what the back button closes, the aria change.
  - `tests/opus-bay-w9-a-dom.test.ts` (6, jsdom + the real `Dialogue`): Space / Esc cancel (7 rows, not 12), arrows +
    Space on a navigated row, 更多 / 返回 / digits on page 2 / a page-2 action, the welcome ignores Esc / Space, aria-modal
    + no aria-live + the `.ob-sr` line + the Tab trap, the back button closing the menu and leaving no entry behind.
  - `tests/opus-bay-w9-a-save.test.ts` (2): the hook (save=off silent; first refused write; once; late listener; wishlist).
- GameRoot (the W8-P9 static estimate, the budget test's method): origin `f1460b0c` **258.318 KB** → this part
  **258.454 KB** (+0.136: the few lines in flow / brain / interactables; the guard is 258.5). The tier rule first sat in
  `interactables.ts` (258.563, over the guard) and moved to the play layer.

### Decisions

- **Space = cancel only when the menu chose the focus.** The brief says Esc and Space cancel; a row the player moved to
  with Tab / arrows still takes Space like any button (WCAG keyboard convention) — the review's case (Space on the
  auto-focused row 1) cancels.
- **Q closes the open panel and opens the menu** (rather than being ignored while a panel is open): one modal at a time,
  the newest wins; Settings' pause ends with it.
- **The back button = Escape** for whatever is open (no second notion of "close" to keep in sync); the guard decides only
  *whether* something closable is open (stores + the game's shown `[role="dialog"]`s).
- **Installed from the play layer**, not `OpusBayPage.tsx` (the history part was A's): its lifetime is the game's, its
  bytes ride in the play-layer chunk, and the page chunk (the title's first paint) does not grow.

### Not done (yet) / Known gaps

- Settings (volumes, 只关语音, text size, the slider's name), the contrast / focus-ring tokens and the keyboard-only run
  with the accessibility tree after: part b.
