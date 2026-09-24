# 景点地图锚点核查

核查日：2026-09-23。对应 src/data/attractions.ts 的 18 个现有 placeId。坐标文件为 src/data/place-locations.json。

地图点是此行程的一个场馆或公园锚点，不是整条线路；venue 也不代表入口和无障碍到达路线。area 表示来源精度较粗或覆盖广场、码头/公园入口区域。没有推算用户位置，没有批量调用 Nominatim。

Wikidata 点通过公开 wbgetentities 的 P625 数值读取，遵循源精度，未人为增加精度；数据页链接可复查。Wikidata 结构化数据为 CC0。政府网页点来自公开地图链接、JSON-LD 或明确列出的经纬度。

| placeId | 锚点 | 纬度、经度 | 精度 | 来源 |
| --- | --- | --- | --- | --- |
| golden-gate | Golden Gate Bridge Welcome Center | 37.80779, -122.47484 | venue | [来源](https://presidio.gov/explore/attractions/golden-gate-bridge-welcome-center) |
| pier39 | PIER 39 | 37.809992, -122.410357 | venue | [来源](https://www.wikidata.org/wiki/Q1856083) |
| alcatraz | Pier 33 · Alcatraz Landing area | 37.80767, -122.404663 | area | [来源](https://www.wikidata.org/wiki/Q66079565) |
| chinatown | Dragon Gate | 37.790685, -122.405585 | venue | [来源](https://www.wikidata.org/wiki/Q40729318) |
| palace | Palace of Fine Arts | 37.802778, -122.448333 | venue | [来源](https://www.wikidata.org/wiki/Q966263) |
| golden-gate-park | Conservatory of Flowers area | 37.772, -122.46 | area | [来源](https://www.wikidata.org/wiki/Q5163145) |
| presidio | Presidio Tunnel Tops | 37.80277777777778, -122.45611111111111 | area | [来源](https://www.wikidata.org/wiki/Q121870410) |
| berkeley | Sather Gate | 37.870218, -122.259481 | venue | [来源](https://www.wikidata.org/wiki/Q2226051) |
| lake-merritt | Oakland Museum of California | 37.798641, -122.263611 | venue | [来源](https://www.wikidata.org/wiki/Q877714) |
| redwood | Reinhardt Redwood · park access area | 37.80692, -122.14813 | area | [来源](https://www.ebparks.org/sites/default/files/2021-Trails-Challenge-Guidebook--2020-12-07.pdf) |
| stanford | Cantor Arts Center | 37.432982, -122.170844 | venue | [来源](https://www.wikidata.org/wiki/Q1672708) |
| filoli | Filoli | 37.470389, -122.310694 | venue | [来源](https://www.wikidata.org/wiki/Q478408) |
| half-moon-bay | Half Moon Bay State Beach · park access area | 37.4665, -122.445 | area | [来源](https://www.parks.ca.gov/?page_id=531) |
| baylands | Lucy Evans Baylands Nature Interpretive Center | 37.4574977, -122.107554 | venue | [来源](https://www.paloalto.gov/Departments/Public-Works/Engineering-Services/Engineering-Projects/Baylands) |
| san-jose | The Tech Interactive | 37.3316, -121.89 | venue | [来源](https://www.wikidata.org/wiki/Q7768226) |
| hakone | Hakone Gardens | 37.2524, -122.041 | venue | [来源](https://www.wikidata.org/wiki/Q890625) |
| muir-woods | Muir Woods · entry area | 37.892835, -122.572559 | area | [来源](https://www.nps.gov/planyourvisit/event-details.htm?id=D6FD5106-D812-D8ED-F4B055B57E1D4B35) |
| sausalito | Sausalito Ferry Terminal area | 37.856, -122.479 | area | [来源](https://www.wikidata.org/wiki/Q30642905) |

## 需要保留的语义

- golden-gate：采用 Presidio 官方 Welcome Center JSON-LD geo；不是桥中央。
- alcatraz：Pier 33 码头区域，位于旧金山出发端，不是恶魔岛中央。地图不能承诺精确检票入口。
- golden-gate-park：Conservatory of Flowers 周边；Wikidata 精度只有 0.001 度，故 area。
- berkeley：校园 Sather Gate，不是山上的 Botanical Garden。
- lake-merritt：OMCA 主馆，不能误称湖边全程路线。
- redwood：采用 EBRPD 2021 Trails Challenge 的 GPS（PDF 第 70 页附近）；来源围绕 Canyon Meadow 行程，点为南部公园进入区域，标 area，没有声称精确停车位。2015 书册坐标较旧且与后续版本不同，未使用。
- half-moon-bay：California State Parks 主页 “Get directions” 自带 37.4665,-122.445；标公园到达区域，不声称这就是 Francis Beach 的准确入口。
- baylands：Palo Alto 官方工程页面公开地图坐标、2500 Embarcadero Rd；仅取位置，不据该旧工程页面断言当前开放时间。
- muir-woods：NPS Ranger Station 活动页明确 Muir Woods Entry Area 并提供经纬度；标入口区域，不是树林腹地，也不表示活动可免公园门票。
- sausalito：渡轮码头区域，源数值精度较低，标 area。

