# 活动日历城市与区域参考坐标

核查日期：2026-09-23。`MONTHLY_EVENTS` 当时有 73 场活动、33 个不同的 `city` 标签。本文件对应 `src/data/calendar-city-locations.ts`：31 个单城参考点、1 个县域参考点、1 个三城复合区域点，覆盖全部标签。

## 来源与用途

优先使用 [U.S. Census Bureau 2026 Gazetteer Files](https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.html)。官方将坐标说明为 geographic area 的 representative latitude/longitude；它们不是市中心、主办方地点、会场入口或停车入口。

- **P**：[2026 California Places 原始文本](https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2026_Gazetteer/2026_gaz_place_06.txt)，取指定 `GEOID` 行的 `INTPTLAT` 与 `INTPTLONG`。当日从 Census 官网 Places → California 链接取得，实际读取 pipe-delimited 数据并逐个匹配名称。
- **C**：[2026 California Counties 原始文本](https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2026_Gazetteer/2026_gaz_counties_06.txt)，同样取 `INTPTLAT` 与 `INTPTLONG`。
- **W**：[Wikidata San Francisco Q62 / P625](https://www.wikidata.org/wiki/Q62#P625)，网页和 [EntityData JSON](https://www.wikidata.org/wiki/Special:EntityData/Q62.json) 均已实查，使用 preferred-rank 坐标 `37.775, -122.41944444444445`，该条目引用 GNIS。

代码所有数值统一四舍五入到三位小数。数值位数只为统一存储，**不表示活动位置准确到该尺度**。`precision: 'city'` 必须作为“城市参考位置”呈现；`precision: 'area'` 必须作为“区域参考位置 / 多地点”呈现。坐标不用于点到点导航。缺少已核实会场坐标时应展示活动自己的地点文字、官方详情，或以地点文字搜索地图。

San Francisco 特别处理：Census 的 `0667000` 参考点是 `37.727239, -123.032229`，落在都市区以西，不能作为本地活动城市聚合的实用位置。因此明确改用实查的 Wikidata 城市坐标，保持 `city` 精度，不推断任何活动会场。

## 已覆盖标签

| 目录 city 标签 | 保存纬度 | 保存经度 | precision | 来源及记录 |
| --- | ---: | ---: | --- | --- |
| Benicia | 38.073 | -122.155 | city | P · 0605290 |
| Berkeley | 37.866 | -122.299 | city | P · 0606000 |
| Burlingame | 37.590 | -122.363 | city | P · 0609066 |
| Calistoga | 38.581 | -122.583 | city | P · 0609892 |
| Campbell | 37.280 | -121.953 | city | P · 0610345 |
| Clayton | 37.940 | -121.930 | city | P · 0613882 |
| Cupertino | 37.319 | -122.045 | city | P · 0617610 |
| Emeryville | 37.839 | -122.302 | city | P · 0622594 |
| Foster City | 37.565 | -122.251 | city | P · 0625338 |
| Fremont | 37.495 | -121.941 | city | P · 0626000 |
| Half Moon Bay | 37.467 | -122.440 | city | P · 0631708 |
| Menlo Park | 37.480 | -122.148 | city | P · 0646870 |
| Mill Valley / San Rafael / Larkspur | 37.943 | -122.526 | area | P · 三市参考点算术平均，见下文 |
| Napa | 38.297 | -122.301 | city | P · 0650258 |
| Novato | 38.085 | -122.548 | city | P · 0652582 |
| Oakland | 37.770 | -122.226 | city | P · 0653000 |
| Pacifica | 37.607 | -122.483 | city | P · 0654806 |
| Palo Alto | 37.397 | -122.143 | city | P · 0655282 |
| Petaluma | 38.242 | -122.629 | city | P · 0656784 |
| Piedmont | 37.823 | -122.230 | city | P · 0656938 |
| Redwood City | 37.515 | -122.214 | city | P · 0660102 |
| Rio Vista | 38.177 | -121.703 | city | P · 0660984 |
| San Carlos | 37.499 | -122.268 | city | P · 0665070 |
| San Francisco | 37.775 | -122.419 | city | W · Q62 preferred P625 |
| San Jose | 37.296 | -121.815 | city | P · 0668000 |
| San Rafael | 37.981 | -122.507 | city | P · 0668364 |
| Santa Rosa | 38.446 | -122.706 | city | P · 0670098 |
| Sonoma County | 38.522 | -122.916 | area | C · 06097 |
| Sunnyvale | 37.386 | -122.026 | city | P · 0677000 |
| Tiburon | 37.887 | -122.463 | city | P · 0678666，官方类别为 town |
| Vacaville | 38.359 | -121.969 | city | P · 0681554 |
| Walnut Creek | 37.903 | -122.040 | city | P · 0683346 |
| Windsor | 38.542 | -122.809 | city | P · 0685922，官方类别为 town |

这里的 `city` 精度代表单个建制城镇范围，因此包含 Census 使用 town 后缀的 Tiburon、Windsor；不改变官方行政分类。

## 两个区域标签

**Sonoma County**：县域范围内分散活动，不是 Sonoma 市。使用县 `06097` 的参考坐标 `38.521700, -122.916421` 后取三位小数，保留 `area`；不得据此声称活动在该县的某一家农场或某个场地。

**Mill Valley / San Rafael / Larkspur**：电影节跨三市举行。使用以下三个 Census Places 记录的未经提前舍入坐标，分别对纬度与经度取等权算术平均，再统一取三位小数：

| 城市 | GEOID | INTPTLAT | INTPTLONG |
| --- | --- | ---: | ---: |
| Mill Valley | 0647710 | 37.908122 | -122.542325 |
| San Rafael | 0668364 | 37.981003 | -122.506930 |
| Larkspur | 0640438 | 37.940506 | -122.528927 |

派生结果为 `37.9432103333, -122.5260606667`；保存为 `37.943, -122.526`。这是编辑计算的多城聚合示意点，**不是官方发布的电影节坐标，也不是任一影院地址**。来源 URL 指向这三个原始记录共同所在的 Census 文件；用户仍需要选择具体场次和影院。

## 检查

- 从当前 `MONTHLY_EVENTS` 动态导入提取全部 city 标签，并确认 73 场 / 33 标签。
- 每个标签在 `CALENDAR_CITY_LOCATIONS` 中恰有一个入口；没有空缺。
- 所有坐标为有限值且在湾区及本目录相邻城市范围内；所有 `sourceUrl` 指向实查公开来源。
- 本次只新增坐标模块与本来源文件，没有改动活动详情或现有会场坐标。
