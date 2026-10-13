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
an AA-safe text token (light text on dark backgrounds stays light; a coloured accent inside a heading, such as
`.about-hero h1 em`, keeps its colour family and becomes `brand`, while grey-green labels become `ink-3`), keyboard-focus
outlines become the brand ring, and everything else snaps to the nearest palette colour with alpha kept (`rgb(var(--color-x-rgb) / .13)`). It skips `url()`
contents, TS/TSX and the 3D worlds, and it is idempotent: after a rebase, run it again instead of resolving colour
conflicts by hand, then `npm run ratchet:update`. `--check` lists what is left; `--dry` prints the mapping table.

Status rules keep their meaning. A rule whose selector names an error (`error|danger|invalid|fail|destructive`) or a
warning (`warn|notice|caution`), or that already paints `var(--color-danger…)` / `var(--color-warning…)`, takes its warm
colours (reds, browns, ambers) from that family instead of the nearest neutral:

| Old colour in a status rule | Becomes |
|---|---|
| text | `danger` / `warning` (the `-tint` when the text is light, e.g. on a dark chat bubble) |
| near-white background | `danger-tint` / `warning-tint` |
| pale border or tint | `rgb(var(--color-danger-rgb) / .2–.45)`: the status colour at the alpha that matches the old lightness on white |
| anything darker | `danger` / `warning` |

An "error" rule drawn in amber (its strongest warm colour has OKLab hue ≥ 70°, like `.member-baybay-error`) is a soft
notice and takes the warning family. White, greys, greens, blues and focus rings follow the ordinary rules, so a green
retry link inside an error box stays green.

Every stylesheet outside `tokens.css` is now converted. The Wave-4 integration (claude/w4-int) ran both codemods on
WEB-COMMUNITY's `discovery-community.css` and `src/features/outings/*.css` (its `posts-ui.css` and `community.css` and
WEB-FRESH2's `source-monitor.css` / `source-monitor-admin.css` were already token-only), after WEB-COMMUNITY deleted the
`.bay-category-*` rules from `src/design.css`. The Wave-3 integration (claude/w3-int) landed WEB-HOME, WEB-DETAIL, WEB-SECONDARY and WEB-PLAN, whose files were already
token-only, and ran the codemods on `outing-inspiration.css`, `discovery-workflow.css` (keeping `.google-maps-attribution`,
Google's own attribution colour: `--skip-selector=google-maps-attribution`) and `src/i18n/languages.css`.

Files converted here that lanes in flight may also edit. Resolve a conflict in them by taking the other lane's side and
re-running both codemods (`hex-to-tokens.mjs`, then `heading-tracking.mjs`), not by merging colour values by hand:
`src/features/baybay-conversation.css`, `src/features/baybay-actions.css`, `src/features/baybay/baybay-answer.css`
(WEB-BB-UI-2), and `src/design.css`.

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

The `.type-display` / `.type-title` / `.type-section` classes (and `.site-container` below) are the adoption API; no
component uses them yet. So far adoption goes through the tokens: PageContainer / PageHeader (`ui.css`), the /guides
library (`.gl-page`), the guide article (`.gd-article`), /me (`me-hub.css`) and /messages (`messages-hub.css`).

Two heading rules in `src/tokens.css` set the title spec on templates other lanes own. When that lane moves its H1 to
`.type-title`, delete the duplicate (keep one spec, not two):
- `.public-content-directory h1` / `h2` (WEB-SECONDARY's Archive, `PublicContentDirectory`): title / section spec. This
  is the one visible change (phone H1 32/700 → 26/600).
- `.local-discovery-detail .discovery-detail-header h1` (WEB-DETAIL): title spec. `local-discovery-detail.css` overrides
  it today, so it has no visible effect.

H1s still on their own spec when TOKENS-B landed (desktop, zh-Hans, base 5e288412), for the owning lanes:
home 52/700/-2.07 (WEB-HOME → display), detail pages 40/600/-1 (WEB-DETAIL → title), /plan 49/700/-2 (WEB-PLAN),
/about 46/700/-2.07, /tools 42/700/-1.5, /ai-in-the-bay 44/600/-1.1, /explore 32/700, /privacy and 404 24/700
(WEB-SECONDARY), /category/* 31/600/-1 (WEB-COMMUNITY).

## 3. Page frame (SV-09)

`--container-wide: 1216px`, `--container-content: 960px`, `--container-reading: 720px`, `--page-gutter` 16 / 24 / 32px
(phone / ≥768 / ≥1024). `.site-container` (and the WEB-UI `PageContainer`, `.ui-container`) is
`max-width: var(--container-wide); margin-inline: auto; padding-inline: var(--page-gutter)`, which puts the content edge
on the header's 112–1328 in a 1440 window. `data-size="content"` and `data-size="reading"` narrow it, centred.

Running text keeps the reading measure inside the wide frame. The guide article is the example: its crumbs, H1, lead,
contact cards and related guides sit on the 112 edge, while the body column beside the contents list (step cards,
prose, dividers, checklists, sources) stops at `--container-reading` at ≥1024px, so the body has one right edge.

## 中文摘要

- 颜色：只用 `src/tokens.css` 里的 token（`var(--color-ink-3)`；半透明写 `rgb(var(--color-brand-rgb) / .12)`；Tailwind 用
  `text-baylink-*`，`/60` 这类透明度照常生效）。其它文件不要再写 #hex，风格棘轮只降不升。
- 对比度：所有文字 token 在所有浅色底上都 ≥4.5:1，测试会检查 CSS 规则和 Tailwind 类名里的文字/底色组合。
- 旧文件的 hex：运行 `node scripts/codemods/hex-to-tokens.mjs <文件>`，再 `npm run ratchet:update`。标题里的强调字（如 `.about-hero h1 em` 的橄榄绿）会换成品牌绿，不会变灰；灰绿色的说明文字换成 ink-3。
- 错误和提醒框保留原来的含义：选择器里有 error / danger / invalid / fail / destructive（或规则里已经用了 danger token）的，暖色换成 danger 系列（文字 danger，浅底 danger-tint，浅边框用半透明 danger）；warn / notice 换成 warning 系列。原本画成琥珀色的“错误”框按柔和提醒处理，用 warning 系列。
- 合并冲突：本 lane 已转换、其他 lane 也在改的文件（BayBay 三个样式文件、`design.css`），冲突时取对方版本，再重跑两个 codemod，不要手工合并颜色值。
- 除 `tokens.css` 外所有样式文件都已转换：Wave 4 集成对 WEB-COMMUNITY 的 discovery-community 和 outings 跑了两个 codemod（posts-ui、community.css 和 WEB-FRESH2 的 source-monitor 本来就只用 token），`design.css` 里的 `.bay-category-*` 已由 WEB-COMMUNITY 删除；Wave 3 集成已对 outing-inspiration、discovery-workflow（保留 Google 地图署名色）和 languages.css 跑过 codemod。
- 标题：H1 用 `.type-title`（手机 26/34，桌面 32/42，600，字距 0）；首页和活动栏目用 `.type-display`；H2 用 `.type-section`。这些类目前还没有组件使用，现有页面是直接读 token。`tokens.css` 里归档页和详情页的 H1 规则是临时的，对应 lane 改用 `.type-title` 后删掉其中一份。
- 页面宽度：`.site-container`（1216，左右边距 16/24/32），桌面上与页头 112–1328 对齐。正文保持 720 的阅读宽度（指南文章正文一栏统一在 720 处结束）。
