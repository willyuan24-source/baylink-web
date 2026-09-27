# Opus Bay wave 2 (lean) — summary and hand-off (2026-09-27, cloud session)

## 给主人的摘要

- 第二波因云端额度（$80）改为精简版：Day-0 接口 + 7 段中的 6 段已上 `opus-bay`，第 7 段（Karl 海雾 + 夜景）做完但有一个测试没过，存成补丁没上主线。
- 已上线分支：旧金山式平顶和粉彩、减雾、双子峰绿草坡、地面与行走高度一致、高空预算、全城代码按需加载；三条缆车线和转盘；全城地图、社区名/街名、发现、快速旅行、存档 v2、继续上次位置；24 张地标卡、12 张城市明信片、城市任务、城市开场文案、全城不再播街区台词；艺术宫圆顶/唐人街牌楼/温室花房换上 AI 模型；长距离点击走路、点击开车、"弹回码头"修复。
- 检查：tsc 0 错误，eslint 0，测试 299/299 通过；街区模式英雄回归测试通过。
- 没做（留给本地）：马林/东湾小板、房屋套件、8 个新地标模型、三条精做路线、镜头和鹈鹕、F 线到卡斯特罗、渡轮、行人车流、城市音效、居民和 BAYBAY 事件台词、手绘地图/语音/壁画；显卡性能表和手机实测。
- Higgsfield 第二波共 21.2 分（C2 画面参考 8 分 + 13.2 分未登记的试听语音），余额 498.28。

## What shipped (branch `opus-bay`, Vercel preview builds every push)

| lane | what | key commits | report |
|---|---|---|---|
| Day 0 | every cross-lane hook and stub; final file ownership | `03f274a`…`d30e89c` | `sf-w2-contracts.md` |
| E2 part a | long click-to-walk on the city walking graph, BAYBAY's long lead, tap-to-drive (edge-filtered drive routes + pure-pursuit autopilot), save v2 fleet hooks, CS-4 fix (non-resident ground is "unknown", not a wall) | `63d5485` `80542d3` `c78f1c3` | none (this table) |
| C2 parts a+b | SF look remap (flat roofs norm, pastel/white walls, grey tops, L0/L1/L2 consistent), green hills, lighter city haze `cityFogK`, drawn ground = walked ground, seam walls gone, budget breakdown tool; high-view budget; lazy city chunk (HC-2) | `4e7c32a` `ba42cf3` `d98cbe0` `a9c1d84` `c20886c` | `sf-w2-C2.md` |
| F part a | 3 cable-car lines (constant cable, blocks, dispatch), 3 turntables with the push moment, rails, rides with hop-off brake and counted stop-to-stop segments, far LOD car, bell/grip/creak audio | `7fc1553` `4b10691` `042eb5f` `be80147` `8241516` `943f8a4` `d0f4fc5` `fa4387d` | `sf-w2-F.md` |
| G1 | places index, CS-8 area names, save v2, discovery, fast travel, HUD street names, city `?at=`, canvas city map, place actions, travel veil, title resume | `c24f02f` `496d351` `480418e` `a999572` | `sf-w2-G1.md` |
| G2 | mode-resolved content (no district barks/goals in the city), 24 SF landmark cards, 12 SF postcards, city goals + detectors, city onboarding copy + city barks, active-world postcard counts | `c9e8650` `221b76b` `64be6ac` | `sf-w2-G2.md` |
| D2 part a | Draco GLB loader, TOY model material with warm-up, AI Palace rotunda + Dragon Gate + Conservatory shipped (Painted Ladies stay procedural), `?ai=0` A/B | `3a0fc74` `ca44dad` `1255ee5` `4681017` | `sf-w2-D2.md` |

Checks on the final head: `tsc` 0, `eslint` 0, **299/299** opus-bay tests, hero regression green. GameRoot is 291.6 KB gzip (target 250 KB; C2's report lists the two E2 requests that bring it to ≈ 247 KB).

## Not merged: C2 part d (Karl the Fog + night light field)

Built (fog.ts, cloudBank.ts, lights.ts, patchFog, `?karl=0|1`) but it breaks `tests/opus-bay-sf-stream.test.ts` "L0 / L1 on the densest chunks stay within budget" (`1.5 !== 1`). Saved as patches:
`docs/opus-bay/wip/c2-fog-night-1-commit.patch` (commit b4aebb3, `git am`) then `docs/opus-bay/wip/c2-fog-night-2-uncommitted.patch` (`git apply`). Fix the budget regression, run the suite, then commit.

## Deferred (the rest of the wave-2 plan; task ids in `sf-w1-checkpoint.md` §5)

- C2: C2-7a/b Marin + East Bay boards and softer world edges, C2-10 tier cross-fade, C2-13 Bay Bridge east span, CS-7; apply the fog/night patch.
- D2: D2-15 the 8 raw SAM landmark meshes (Legion, Ghirardelli, Fort Point, Mission Dolores, Castro, windmill body, Grace, City Hall — job ids in ASSETS-LEDGER "Part 2a, resumed run"), D2-08 house-kit swap, D2-09 landmark settings, D2-10 tall structures, D2-11 three finished routes, D2-12 placeIds, D2-14 routes QA, HC-4 hero GLB compression, CS-13 Palace lagoon.
- E2: E2-5..E2-7 city camera + view field + glide world (CS-10, DR-5), E2-8 flying pelican, E2-9 touch hop, E2-10 transit hop-off brake, E2-11 gamepad, E2-12 city bike racks, E2-13 pant, DR-1 chip; C2's GameRoot requests.
- F: F7 F-line to the Castro, F8 ferry, F11 crowd, F12 toy traffic, F13 hero-life pause, F10 city audio.
- G1: Footprints tab, debug line extras, HUD crowding (DR-3/DR-4) if not covered.
- G2: G2-4 BAYBAY event + neighbourhood lines, G2-6/7 six residents with tasks.
- H2b: painted whole-SF map, BAYBAY voice barks, Mission murals.
- Cross-lane "Requests" sections in each `sf-w2-*.md` report (frozen files the lead must change).
- Owner machine: the perf table (`sf-w1-checkpoint.md` §4), phone test, then flip `DEFAULT_WORLD_MODE` to `'city'` once the gates pass.
