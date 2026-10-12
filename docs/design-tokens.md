# Design tokens: palette, type scale, page frame

Owner: VISUAL-SYS (Wave 3, TOKENS-B). Source of truth: `src/tokens.css`. This page is for every lane that writes CSS or
Tailwind classes. 中文摘要在文末。

## 1. Palette

Every colour is an `R G B` channel token, and the colour token reads it:

```css
--color-brand-rgb: 9 107 84;
--color-brand: rgb(var(--color-brand-rgb));
```

| Write | For |
|---|---|
| `color: var(--color-ink-3)` | any opaque use |
| `background: rgb(var(--color-brand-rgb) / .12)` | a translucent use (instead of `#096B541F`) |
| `text-baylink-muted`, `border-baylink-border/60` | Tailwind; `baylink.*` reads the channel tokens, so `/NN` works |

Names: `bg surface surface-2 selected` · `ink ink-2 ink-3` · `brand brand-hover brand-deep brand-tint` · `on-brand-muted`
(text on brand-deep only) · `highlight` (with brand-deep text) · `line line-strong` (decorative) · `line-control` (input
borders, never text) · `warm(-tint)` · `success(-tint)` · `warning(-tint)` · `danger(-tint)` · `info(-tint)` ·
`plum(-tint)` · `scrim` (photo overlays). Overlays: `--color-badge-bg`, `--color-backdrop`, `--scrim-photo`. TypeCover
pairs: `--tc-<tone>-bg/fg`. The old `--ui-*` names are aliases until WEB-CSS-PRUNE; read `--color-*` in new code.

Rules:
- **No hex outside `src/tokens.css`.** The style ratchet counts hex (`hexOccurrences`, `hexDistinct`) and only goes down.
- Text tokens pass WCAG AA (4.5:1) on every light surface; `tests/token-contrast.test.ts` checks the matrix, every CSS
  rule that sets a text token on a background token, and every Tailwind class string pairing a `text-baylink-*` with a
  `bg-baylink-*`. A failing pair fails CI.
- Grey-green text such as `#748064`, `#8b937f` or `#69756D` is gone: use `ink-3` (6.25:1 on white).

### The codemod

`node scripts/codemods/hex-to-tokens.mjs [file.css …]` rewrites hex colours to the nearest token by role: text snaps to
an AA-safe text token (light text on dark backgrounds stays light), keyboard-focus outlines become the brand ring, and
everything else snaps to the nearest palette colour with alpha kept (`rgb(var(--color-x-rgb) / .13)`). It skips `url()`
contents, TS/TSX and the 3D worlds, and it is idempotent: after a rebase, run it again instead of resolving colour
conflicts by hand, then `npm run ratchet:update`. `--check` lists what is left; `--dry` prints the mapping table.

Files not converted yet (their lanes were in flight when TOKENS-B landed; run the codemod on them after they merge):
`src/components/about-baylink.css`, `discovery-community.css`, `home-discovery.css`, `outing-inspiration.css`,
`planner-web-library.css`, `src/components/tools/*.css`, `src/features/outings/*.css`, `src/features/posts/posts-ui.css`,
`src/features/source-monitor/source-monitor.css`, `src/styles/attractions.css`, `discovery-workflow.css`, `planner.css`,
and the `.bay-category-*` rules in `src/design.css`.

## 2. Type scale (SV-06)

One spec per heading level on every page: weight 600, `letter-spacing: 0` (no negative tracking on CJK), rem so Aa grows
them. Desktop values apply at ≥1024px.

| Token / class | Phone | Desktop | Use |
|---|---|---|---|
| `--text-display` / `.type-display` | 28/36 | 40–52 (≈44 at 1440) | home H1, events column header; one per page |
| `--text-title` / `.type-title` | 26/34 | 32/42 | every other page H1 |
| `--text-section` / `.type-section` | 22/30 | 24/32 | H2 |
| `--text-card` + `--lh-card` | 18/27 | 18/27 | card and row titles (H3) |

Line heights: `--lh-display`, `--lh-title`, `--lh-section`, `--lh-card`. The WEB-UI `PageHeader` already uses
`--text-title` / `--text-display`. Adopting: put the class on the heading (or read the tokens in the component's heading
rule) and delete the component's own `font-size`, `line-height`, `font-weight` and negative `letter-spacing` for it.

H1s still on their own spec when TOKENS-B landed (desktop, zh-Hans, base 5e288412), for the owning lanes:
home 52/700/-2.07 (WEB-HOME → display), detail pages 40/600/-1 (WEB-DETAIL → title), /plan 49/700/-2 (WEB-PLAN),
/about 46/700/-2.07, /tools 42/700/-1.5, /ai-in-the-bay 44/600/-1.1, /explore 32/700, /privacy and 404 24/700
(WEB-SECONDARY), /category/* 31/600/-1 (WEB-COMMUNITY).

## 3. Page frame (SV-09)

`--container-wide: 1216px`, `--container-content: 960px`, `--container-reading: 720px`, `--page-gutter` 16 / 24 / 32px
(phone / ≥768 / ≥1024). `.site-container` (and the WEB-UI `PageContainer`, `.ui-container`) is
`max-width: var(--container-wide); margin-inline: auto; padding-inline: var(--page-gutter)`, which puts the content edge
on the header's 112–1328 in a 1440 window. `data-size="content"` and `data-size="reading"` narrow it, centred.

## 中文摘要

- 颜色：只用 `src/tokens.css` 里的 token（`var(--color-ink-3)`；半透明写 `rgb(var(--color-brand-rgb) / .12)`；Tailwind 用
  `text-baylink-*`，`/60` 这类透明度照常生效）。其它文件不要再写 #hex，风格棘轮只降不升。
- 对比度：所有文字 token 在所有浅色底上都 ≥4.5:1，测试会检查 CSS 规则和 Tailwind 类名里的文字/底色组合。
- 旧文件的 hex：运行 `node scripts/codemods/hex-to-tokens.mjs <文件>`，再 `npm run ratchet:update`。
- 标题：H1 用 `.type-title`（手机 26/34，桌面 32/42，600，字距 0）；首页和活动栏目用 `.type-display`；H2 用 `.type-section`。
- 页面宽度：`.site-container`（1216，左右边距 16/24/32），桌面上与页头 112–1328 对齐。
