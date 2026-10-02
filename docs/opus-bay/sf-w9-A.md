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
6. **设置里新增**：音乐 / 音效 / BAYBAY 语音三个音量滑块、「只关语音」、文字大小（标准 100% · 大 115% · 特大 130%，对话框、卡片、
   面板的字一起变大，手机上 130% 时选项改成一行一个）；镜头距离滑块有了名字。
7. **看得更清楚**：主按钮的青绿色加深（白字对比 3.89 → 4.96:1），键盘焦点框改成不透明的 2 像素深青色，标题页的小字提示、灰色说明字、
   金色计数都达到 4.5:1 以上。

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

## Part b · W9-A4 … A5 contrast, Settings, the keyboard-only run (02:14–03:30 PDT, after the usage-limit stop)

The first lane-A agent stopped at ≈ 00:35 with part b uncommitted (opus-bay.css, ui/Dialogue.tsx, ui/Settings.tsx, new
ui/textSize.ts). Kept all of it; finished, tested and pushed it at 03:06 (W9-A4) after rebasing over 33 commits of other
lanes (no conflict). One thing in it was broken and is fixed: at 130 % the one-line text-size labels made Settings' body
scroll sideways (scrollWidth 400 > clientWidth 314 on the 420 px sheet) — they stack word / percent now (314 = 314).

### What was built

- **Contrast** (the colour / focus tokens of `opus-bay.css`, computed WCAG ratios before → after):

  | what | before | after |
  |---|---|---|
  | white on the primary teal (`--ob-teal` #2f8f88 → #287c76; also the teal text on white) | 3.89 | 4.96 |
  | the focus ring (3 px teal at 55 % → 2 px solid `--ob-teal-d`) | ≈ 1.8 | 5.9 on white |
  | the muted 12–13 px text (`--ob-ink-3` #7e8a85 → #626f6a) on white / cream | 3.58 / 3.45 | 5.25 / 5.05 |
  | the coin / postcard counts (`--ob-gold-d` #a8741f → #8a5d14) on white (the review measured 3.87 on the HUD) | 4.05 | 5.74 |
  | the title's key hint line (ink-3 over the art → ink-2 on a cream capsule) | 2.60 | ≈ 6.4 |
  | the title's mark 「OPUS BAY · BAYLINK」 (sampled under it) / sub line / guides link | 2.34 / 4.30 / 3.83 | 5.37 / 5.04 / 5.75 |
  | the Enter / Esc keycaps on teal (`.ob-key.on-dark`) | 2.95 | 6.98 |

  `.ob-choice-sub` / `.ob-dialogue-foot` 12.5 → 13 px. The title's sound toggle keeps one name 「声音」 with its state in
  `aria-pressed` (it read "Mute sound, pressed" = muted: `ui/TitleScreen.tsx`, lane F's file, one attribute).
- **Settings** (`ui/Settings.tsx`): 文字大小 first after the language; the master switch reads **声音** (it silences
  everything: music, effects, voice — `audio/audio.ts`) with a hint; 音乐; **只关语音** (lane X's `setVoiceMuted`);
  a **音量** group with three sliders (音乐 60 % default, 音效, BAYBAY 的语音; 0–100 % in steps of 5; named 音乐音量 /
  音效音量 / BAYBAY 的语音音量, value text "60%"; dimmed while their sound is switched off) on lane X's `audio/levels.ts`;
  the camera slider has its name. The touch controls line names the joystick and the look drag.
- **Text size** (`ui/textSize.ts`, new, in Settings' chunk and the play layer — not GameRoot): 100 / 115 / 130 %, per
  device in `opus-bay:text:v1` (no save bit; `?save=off` / blocked storage: this page only). `data-ob-text` on `.ob-page`;
  the CSS `zoom`s the reading surfaces — the dialogue box, the sheets' bodies (not the map's: its pointer maths), toasts,
  bubbles, the arrival card. The HUD frame, the map and the 3D view stay. On a phone at 130 % the choices are one a row.

### The keyboard-only run (dev server 5910, 1440 × 900, `?save=off`, English browser; 390 × 844 touch for the phone shots)

Title → Tab: the sound toggle shows the ring (computed `solid 2px rgb(31, 111, 105)`), Shift+Tab → Start, Enter → the
intro (Esc skips) → the welcome's 4 ways (digit 3) → the goals card (Esc) → Esc = Settings (paused) → 文字大小 130 % →
Esc → **Q** = the menu (7 rows: next goal · 附近能玩什么 (lane G's row, kept on page 1) · 附近 · 这周 · 今天 · 更多… · 没事)
→ **Space cancels** (0 rows after) → **M** = the map → Esc → M → **the browser's back** (CDP navigateToHistoryEntry) closes
the map, the game keeps playing (`phase: playing`, the URL unchanged, the guard's entry gone).

Accessibility tree (scratch `C:/Users/willy/opus-qa/w9/a/ax/`), before (`ax-chat.txt`, origin f1460b0c) → after
(`ax-b-ask.txt`, `ax-b-settings.txt`):
- the menu: `dialog "BAYBAY" [live=polite, modal=false]` with 12 rows **and** the HUD's `navigation "Game menu"` (6
  buttons) beside it → `dialog "BAYBAY" [modal=true]`, 7 rows, the faded HUD out of the tree (inert).
- Settings: `switch "音效"`, `switch "音乐"`, `slider ""` (the review's `tech/ax-settings.txt`) → radio 标准 100% / 大 115% /
  特大 130%, switch "Sound …", "Music", "Mute voice only …", slider "Music volume" / "Sound effects volume" /
  "BAYBAY’s voice volume" / "Camera distance".

QA images (`docs/opus-bay/qa/w9/A/`): `a01-before-esc-q.jpg` (origin: Settings and the 13-row menu open together),
`a02-after-ask.jpg` (the menu now), `a03-after-settings.jpg` (Settings at 100 %), `a04-phone-settings-130.jpg` and
`a05-phone-ask-130.jpg` (390 × 844 at 130 %).

### Evidence

- `tests/opus-bay-w9-a-settings.test.ts` (8): the four contrast tests compute the ratios from opus-bay.css's tokens and
  fail on f1460b0c's values (they also assert the old values fail); Settings in jsdom (the four sliders' names, a
  change reaches `audio/levels.ts`, 只关语音 on / off, the master switch 声音); 文字大小 (radio group, the attribute, kept /
  read back, nonsense → 100, `?save=off` writes nothing); the title's sound toggle name.
- Checks before each push: tsc 0 · `npx eslint .` 0 errors (50 warnings, none new) · the opus-bay suite 2068 tests, fail 0
  (the 255 KB GameRoot target stays a todo; the 258.5 KB guard and the no-new-module test pass: textSize rides in the
  play layer and Settings' chunk).

### Decisions

- **`zoom` on the reading surfaces**, not a root font size: the game's CSS sizes text in px, so a root size would change
  nothing; zooming the HUD frame and the map would break the pointer maths and the layout guards. Chrome / Safari /
  Firefox ≥ 126 support `zoom`; an older Firefox ignores it (the setting does nothing there — no breakage).
- **Darkened the tokens** (`--ob-teal`, `--ob-ink-3`, `--ob-gold-d`) instead of patching each use: every surface that uses
  them gets the fix; the 3D world's own teal (#2f8f88 in meshes / canvases) is not UI text and stays.
- **The master switch is 声音** (it was labelled 音效 but mutes everything); 音效 is now the effects slider.

### Not done / known gaps

- 130 % on a phone: the menu box covers about half of the 844 px screen and rows 6–7 scroll (Esc / Space / back still
  cancel); a reviewer may prefer 115 % as the phone maximum.
- New BAYBAY lines: none (the menu's 更多… / 返回 are choice labels, the storage notice is a toast) — nothing for lane X.
- Not tested with a real screen reader (NVDA / VoiceOver): the AX tree is the evidence.
