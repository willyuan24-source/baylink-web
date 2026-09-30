# Wave 7 · lane Q · iPhone & phone readiness

Worktree `C:/Users/willy/wt/w7-q` (branch `w7-q`), dev port 5702, scratch `C:/Users/willy/opus-qa/w7/q/`, QA images
`docs/opus-bay/qa/w7/Q/`. Brief: `sf-w7-lead.md` §3 row Q and the iOS scout (`C:/Users/willy/opus-qa/w7/day0/scout-ios.txt`).

## 给主人的摘要

1. iPhone 上点「开始」后第一段声音（雾笛、音乐、BAYBAY）不响的问题修好了：现在点「开始 / 继续旅程」的那一下就把声音"解锁"，不用再点第二下。Chrome 证明不了苹果的规则，所以要你在真 iPhone 上听一下（见 `iphone-checklist.md` 第 1 步）。
2. 语音缓存加了上限（最多约 32 MB / 64 段），长时间玩不会再越吃越多内存导致 iPhone 刷新页面。
3. 如果手机把游戏画面的显存收回（黑屏/卡住），现在会先存档，再弹出一张小卡「画面需要重新加载 · 重新载入」，点一下就回来。

## Part a (2026-09-29 20:25–20:45 PDT): the audio unlock inside the Start tap · the voice clip cache cap · a lost GL context

### What was built

| # | what | files | API |
|---|---|---|---|
| 1 | **The audio unlock inside the Start tap.** WebKit (Safari and every iOS browser, WeChat included) starts an `AudioContext` only from inside a gesture's handler. The game's `start` event reaches `audio.ts` seconds after the Start tap (the page waits for the first frame and the play layer's parts), and `onGesture` returned while `phase === 'title'`, so on an iPhone the arrival foghorn, the music and BAYBAY's first line stayed silent until a second tap. Now a tiny, dependency-free page-chunk module is called **synchronously inside the click**: `OpusBayPage.start` (Start, 继续旅程, 从头开始 · 渡轮大厦, Enter) primes with `starting: true` (the context stays running for the arrival), the title's sound button primes when it turns sound on, and `audio.ts onGesture` primes on any other title tap (then the context is suspended again after 400 ms: the title stays quiet, and WebKit lets a context it once saw start inside a gesture resume later without one). If the audio chunk has not made its context yet, the tap makes it and `createContext` **adopts** it (one context per page); if it has, `createContext` **shares** it and the tap primes that one. `createContext` no longer suspends a context the Start tap left running. Chrome / Edge / Firefox / Android: nothing changes (`gestureUnlockNeeded` is false: sticky activation already works there, and opening an audio device inside a tap costs 110–370 ms on Windows — why `audio.ts` opens it at idle). `?unlock=1` forces the WebKit path in any browser (QA), `?unlock=0` turns it off. | new `audio/unlock.ts`; `audio/audio.ts` (`createContext`, `unlock` → `silentSample`, `activate` sets `audioProbe.activated`, `onGesture`, dispose `releaseAudioContext`, DEV `__opusAudio.stats().unlock`); `OpusBayPage.tsx` (`start`); `ui/TitleScreen.tsx` (`toggleSound`); `tests/opus-bay-w5-lang.test.ts` (the title-chunk guard allows exactly `audio/unlock.ts` and asserts it imports nothing) | `primeAudio({ starting? })`, `gestureUnlockNeeded(win?)`, `adoptAudioContext()`, `shareAudioContext(c)`, `releaseAudioContext(c)`, `silentSample(c)`, `audioProbe` |
| 2 | **An LRU cap on decoded voice clips.** `VoicePlayer.clips` kept every decoded `AudioBuffer` for the page's life (771 clips ship; a decoded 4 s line is 0.73 MB of native PCM: 100–300 MB in a long iPhone session, invisible to the Chrome perf gate). Now a Map in use order with two caps, **`CLIP_CACHE_BYTES` 32 MB** and **`CLIP_CACHE_MAX` 64 clips**; a use (a bark, a line, a cache hit in `load`) moves a clip to the end; past a cap the least recently used goes (fetched again from the HTTP cache and decoded when wanted). Never evicted: the six barks in both languages, the current stop's tour clips (`loadStop`, which `audio.ts preloadStopVoices` now calls — the next stop's list replaces the pins), and the null markers (absent / muted ids). `dispose()` drops the buffers. The numbers go to `audioProbe` for the ?debug line. | `audio/voice.ts` (`use`, `keep`, `trim`, `cacheStats`, `loadStop`); `audio/audio.ts` `preloadStopVoices` (one line) | `CLIP_CACHE_BYTES`, `CLIP_CACHE_MAX`, `clipBytes(b)`, `VoicePlayer#loadStop(ids)`, `VoicePlayer#cacheStats()` |
| 3 | **A lost WebGL context.** `webglcontextlost` → `preventDefault`, `flushSave()` at once, one small card **画面需要重新加载 · 重新载入** (zh-Hans / zh-Hant / en; the button reloads the page, 44 px tall), counted for ?debug. A back / forward-cache return (`pageshow` with `persisted`) and a tab made visible again check `getContext().isContextLost()`. No in-place restore (the scout: batched pools, canvas textures and merged cells do not rebuild cleanly). R3F forces a context loss ≈ 500 ms after the Canvas unmounts: by then the canvas has left the page, so that loss is ignored and the watch removes itself. GameRoot (lane P's) got one line in `onCreated`: `import('../ui/glHealth').then(m => m.watchGl(gl))` — the module is its own small chunk. | new `ui/glHealth.ts`; `game/GameRoot.tsx` (onCreated, surgical); `opus-bay.css` (`.ob-gl-lost*`) | `watchGl(gl, win?, doc?)`, `markLost(doc?)`, `glHealth` |

### Evidence

- `npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors (43 old warnings) · suite **1501 tests, 1499 pass**: the
  two failures were the title-chunk guard (fixed as above, then 8 / 8) and `W5-bus 20+ simulated minutes` (forced blockers
  29 vs ≥ 30 — the day-0 flake lane B is hardening; it failed alone at 29 too, as at day 0; nothing in this part touches transit).
- New tests (all green):
  - `tests/opus-bay-w7-q-unlock.test.ts` (6) — a WebKit stand-in whose context starts only inside a gesture:
    **the bug** with `?unlock=0` (the Start tap on the title, then `start` outside the gesture: the context stays
    `suspended`); the Start tap primes the idle-made context (running, no second context, not suspended again at the
    arrival); a tap before the audio chunk (the page makes it, `audio.ts` adopts it: one context; released on dispose);
    a title tap (not Start) unlocks, goes quiet after 400 ms, and the later `start` resumes without a gesture; Chrome /
    Android: nothing made; the UA table (iPhone Safari, CriOS, WeChat MicroMessenger, macOS Safari, iPadOS desktop mode vs
    Chrome, Edge, Android Chrome, Firefox).
  - `tests/opus-bay-w7-q-voice-cache.test.ts` (2) — 100 clips of 4 s loaded after the barks: 43 held (the byte cap binds
    first), ≤ 32 MB, the barks all kept, the newest kept and the oldest gone, `audioProbe` in step; least recently *used*
    goes first (a clip reused every step survives 80 loads), the stop's clips and the `zh-yay` null marker survive, an
    evicted clip is fetched and decoded again, the next stop's list unpins the previous one, `dispose` drops the buffers.
  - `tests/opus-bay-w7-q-glhealth.test.ts` (4) — the loss: `preventDefault`, the save written at once (it was waiting for
    1 s of quiet), one card in `.ob-page`, a second loss adds no second card and counts 2; `pageshow` persisted with a lost
    context shows it (a live context or a fresh load does not); a tab made visible again with a lost context shows it;
    R3F's forced loss after an unmount is ignored and the listeners are gone.
- Played (dev 5702, 390 × 844 dpr 3 touch, city, `?unlock=1&save=off`): on the title the audio chunk had made its context
  at idle (`ctxMs` 485, `suspended`, `shared: true`, 0 primes); the Start click → `primes 1, startPrimed true` in the same
  call; after the arrival `running`, `activated`, `unlocked: true`, the page's one context (`shared: true`, adopted false).
  Then `?start=free`, `WEBGL_lose_context.loseContext()` → the card over the frozen canvas with the HUD behind:
  `qa/w7/Q/a-phone-context-lost-card.jpg`.

### Decisions

- The unlock runs only where WebKit's rule applies (iOS / iPadOS browsers, desktop Safari): Chrome keeps the wave-6 path
  exactly (no audio device opened inside the tap, no context running on the title).
- A Start prime leaves the context running (the arrival is seconds away); any other title prime suspends it again after
  400 ms. The silent sample is played in every prime (the classic iOS unlock) and again at activation.
- Caps 32 MB / 64 clips: the 38 recorded city lines (≤ 2 s each) + 6 barks ≈ 12–15 MB warm at boot, leaving room for
  ≈ 20–25 tour / W5 / W6 clips. Evicted clips come back from the HTTP cache (decode only).
- No in-place GL restore; the card reloads. The card is plain DOM (no React), inside `.ob-page` so it gets the theme.

### Known gaps

- Chrome cannot prove WebKit's rule: the node stand-in models it (from WebKit's `AudioContext::willBeginPlayback`, which
  lifts the gesture restriction for a context once a gesture has started it). **The owner's device check**:
  `docs/opus-bay/iphone-checklist.md` step 1 (part c) — sound on, tap 开始 once, and the foghorn must be heard during the
  ferry shot without touching the screen again.
- The context-loss card was shot in Chrome with `WEBGL_lose_context`; iOS's own losses (memory pressure, background) can
  only be seen on a device (the ?debug line will count them, part b).

### Not done (part a)

- Everything from item (4) on: parts b / c.

### Requests

- None.
