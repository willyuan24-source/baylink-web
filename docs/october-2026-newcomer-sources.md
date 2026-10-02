# October 2026 newcomer guide source review

Checked: **2026-10-02**, using the user's America/Los_Angeles date. Research and prose are for the BAYLINK first-visit / recently-arrived expansion.

## Deliverables and scope

- `src/data/guides-october-2026-newcomer.ts`: four guides exported as `october2026NewcomerGuides`.
- `src/data/october-2026-newcomer-en.json`: full Chinese-string-to-English dictionary, including titles, metadata, sources, route stops, blocks, templates and link labels.
- This source record. No aggregate, locale loader, media, or generated public catalog was edited by this research agent.

## Existing content reviewed

Read the existing airport article in `guides-practical.ts`, newcomer first-month, region and commute overviews in `guides.ts`, utilities / DMV preparation in `guides-settling-in.ts`, the library guide in `guides-local-life.ts`, and the September Muni update in `guides-autumn-refresh.ts`.

The new material adds decision sequences and operational detail: a geographically grouped three-day route; airport-to-door chains with late-arrival fallbacks; dependencies and completion evidence for the first month; and address-level commuting tests with a worked cost/time calculation. It does not reproduce the old high-level checklists as new articles.

## Source-to-claim record

| Official source | Used for | Verification |
| --- | --- | --- |
| [SFMTA：MuniMobile 当前票种](https://www.sfmta.com/getting-around/muni/fares/munimobile) | 核对 9 月 1 日停售单程票与继续销售的日票、缆车票和 Visitor Passport。 | Opened official page and read relevant content. |
| [SFMTA：Visitor Passport 覆盖范围](https://www.sfmta.com/fares/1-day-visitor-passport) | 含缆车的 Muni 通票不含 BART、机场交通或其他运营方。 | Opened official page and read relevant content. |
| [Presidio：接驳车与高峰限制](https://presidio.gov/visit/getting-to-and-around-the-park/presidio-go-shuttle) | 免费 Downtown Route 的部分工作日通勤班次有乘客资格限制。 | Opened official page and read relevant content. |
| [SF Rec & Parks：金门公园交通](https://sfrecpark.org/1159/Getting-to-Golden-Gate-Park) | 公园地图、无障碍路径、公共交通和临时封路入口。 | Opened official page and read relevant content. |
| [NPS：恶魔岛参观基础信息](https://www.nps.gov/alca/planyourvisit/basicinfo.htm) | 从官方入口购买登岛船票；监狱语音导览包含普通话。 | Opened official page and read relevant content. |
| [Exploratorium：参观与开放时间](https://www.exploratorium.edu/visit) | Pier 15 场馆、普通开放时间、特别关闭与成人晚场限制。 | Opened official page and read relevant content. |
| [California Academy of Sciences：参观准备](https://www.calacademy.org/plan-your-visit) | 入场预约建议、天文馆年龄及场次要求，另查当日访问提醒。 | Opened official page and read relevant content. |
| [SF Travel：唐人街街区信息](https://www.sftravel.com/neighborhoods/visit-chinatown) | 官方旅游机构的街区介绍，供唐人街与 North Beach 步行组合参考。 | Opened official page and read relevant content. |
| [SFO：地面交通总入口](https://www.flysfo.com/passengers/ground-transportation) | BART 所在航站楼、AirTrain 衔接、网约车与酒店接驳入口。 | Opened official page and read relevant content. |
| [BART：OAK 机场接驳](https://www.bart.gov/guide/airport/oak) | OAK 接驳到 Coliseum 后换乘主线，以及机场旅客付款与行李安排。 | Opened official page and read relevant content. |
| [SJC：公共交通衔接](https://www.flysanjose.com/public-transit) | Route 60 分别接 Caltrain、BART 和轻轨；从机场上车两个方向均免费。 | Opened official page and read relevant content. |
| [VTA：Terminal A 临时站公告](https://www.vta.org/go/service-alerts/60/route-60-vta-terminal-stop-relocation) | 2026-03-24 起施工迁站：原站以北约 1000 英尺、Delta 柜台附近。 | Opened official page and read relevant content. |
| [VTA：60 路现行线路与服务提醒](https://www.vta.org/go/routes/60) | 出发前核对方向、适用时刻表和仍生效的临时调整。 | Opened official page and read relevant content. |
| [BART：行程规划](https://www.bart.gov/planner) | 用工作日、周末与晚归时间分别查完整行程。 | Opened official planner entry; dynamic journey result requires a user's dates and addresses. No invented journey result. |
| [Caltrain：当前时刻与停站](https://www.caltrain.com/schedules) | 同一站不同车次停站不同，需同时核对回程。 | Opened official page and read relevant content. |
| [511：深夜公共交通](https://511.org/travel/transit/all-nighter) | 为晚归测试寻找可用的夜间替代路线。 | Opened official page and read relevant content. |
| [PG&E：开始、停止与转移服务](https://www.pge.com/en/account/service-requests/start-stop-transfer-service.html) | 仅在实际地址由 PG&E 服务且租约要求自己开户时使用。 | Opened official page and read relevant content. |
| [USPS：转寄与地址变更](https://www.usps.com/manage/forward.htm) | 身份核验、临时或永久转寄，以及需另行通知的政府与商业账户。 | Opened official page and read relevant content. |
| [California DMV：REAL ID 材料清单](https://www.dmv.ca.gov/portal/driver-licenses-identification-cards/real-id/real-id-checklist/) | 按自己的材料生成清单；REAL ID 住址文件要求不可套用到所有业务。 | Opened official page and read relevant content. |
| [SFPL：免费图书馆卡](https://sfpl.org/free) | 加州居民办卡资格、线下身份核验与公共资源入口。 | Opened official page and read relevant content. |
| [SF.gov：311 非紧急市政咨询](https://www.sf.gov/get-information-311) | 旧金山市政问题的全天、多语言咨询入口；市外拨打号码另列。 | Opened official page and read relevant content. |
| [211 Bay Area：服务范围与转介](https://211bayarea.org/about-211-bay-area/) | 食物、住处及其他社区支持的转介；按居住县确认负责服务。 | Read current official-page search extraction; direct fetch returned an internal error. No eligibility guarantees or text-service number copied. |
| [ReadySF：家庭应急联络计划](https://media.api.sf.gov/documents/ReadySF_-_Make_a_plan.pdf) | 安排家中与工作时段集合点、外地联系人和 AlertSF。 | Read official PDF text surfaced by search; used only the contact-plan structure, no emergency prediction. |
| [BART：当前系统图与站点](https://www.bart.gov/system-map) | 区分正在运营的车站与未来扩建，不把 Berryessa 当作 Diridon。 | Opened official page and read relevant content. |
| [AC Transit：跨湾巴士](https://www.actransit.org/transbay) | 跨湾线路、Salesforce Transit Center 与工作日／周末服务差异。 | Opened official page and read relevant content. |
| [SF Bay Ferry：线路与时刻表](https://www.sfbayferry.com/routes-schedules/) | 区分 Oakland／Alameda、Richmond 等日常线路与工作日限定线路。 | Read current official-page search extraction, including daily vs weekday-only routes; direct fetch returned an internal error. |
| [Golden Gate Ferry：北湾渡轮](https://www.goldengate.org/ferry/schedules-maps/) | Larkspur、Sausalito 和 Tiburon 往返旧金山的线路与节假日入口。 | Opened official page and read relevant content. |
| [VTA：南湾系统图](https://www.vta.org/go/maps) | 确认轻轨与巴士最后一程，不把城市名当成站点范围。 | Opened official page and read relevant content. |

## Time-sensitive facts deliberately retained

- SFMTA MuniMobile: new single-ride ticket sales ended September 1, 2026; day passes, cable car products and Visitor Passports remain available in 2026. A Muni-only Day Pass excludes cable cars; a Visitor Passport includes cable cars but excludes BART and other systems. No 2027 proposal is described as already effective.
- Presidio GO: the Downtown Route has restricted weekday commute departures. The guide directs visitors to the actual marked departure rather than promising universal free access.
- SJC Route 60: the airport page confirms free boarding in both directions from SJC. Winchester direction connects to Santa Clara Transit Center / Caltrain; Milpitas direction connects to BART. Onward rail is not free merely because the airport bus is.
- VTA's separate Terminal A construction notice is active on the Route 60 page. Effective March 24, 2026, the temporary stop is about 1,000 feet north near the Delta ticket counters. The article explicitly warns that the airport's generic page still lists the usual stop number. No assertion about an end date is made.
- OAK rail travel requires the airport connector to Coliseum and then a main-line connection. BART's official airport text says arrivals pay on reaching the Coliseum connector platform. The guide avoids a fixed last-train time and requires checking the full journey.
- Exploratorium's ordinary Monday closure, Sunday public opening at noon, and 18+ After Dark are supported by its visit page. Exceptions are explicitly to be checked. Academy planetarium admission excludes under-four children and requires a show reservation; this is separated from general museum admission.
- SF Bay Ferry's current search-indexed official routes page is at `https://www.sfbayferry.com/routes-schedules/`. It distinguishes daily Oakland/Main Street Alameda and Richmond service from weekday-only Harbor Bay and Alameda Seaplane. Golden Gate Ferry is a separate operator.
- USPS forwarding does not update agencies and businesses. The guide does not instruct overseas newcomers without an old US address to create an unnecessary forwarding order.
- DMV REAL ID's two acceptable printed address documents are specific to that transaction; no immigration, driving authorization, eligibility or legal deadline is inferred for an unknown reader.
- SFPL card availability for California residents is distinguished from a visitor or incomplete-document situation. No universal immediate museum-pass access is promised.
- 311 is for SF nonemergency city services. 211 Bay Area's six direct-service counties are distinguished from East Bay county providers.

## Editorial estimates and boundaries

The 72-hour itinerary, 2–6 km walking ranges, half-day activity allocations, and $45–80 daily food/transit envelope are clearly labeled editorial estimates. That envelope excludes lodging, airports, paid attractions, shopping and expensive meals; it is not a sourced current-price claim. The commute example uses hypothetical $300 rent savings minus $120 added transport and 16 additional hours over four weeks. It is arithmetic to aid comparison, not rent-market or fare data.

First-7/30-day milestones are explicitly editorial planning dates, not legal deadlines. No application, booking, payment, email, enrollment or public posting was performed.

The 72-hour guide links to `/this-month#monthly-news` for the root agent's separately verified current event and transit notices; it avoids hardcoding a festival reroute into an evergreen route paragraph.

## Queries/paths rejected or narrowed

- Several broad searches returned old airport PDFs, unofficial airport domains, Reddit anecdotes, and old Caltrain maps. These were not used as sources for current rules.
- FAMSF/de Young direct visit pages returned access errors. The itinerary therefore uses the Academy's successfully opened visitor page as its main park museum option, rather than asserting unverified de Young hours.
- The old SF Bay Ferry `sanfranciscobayferry.com/routes-and-schedules` route failed. The current official domain and routes path are recorded above.
- A generic SFPL `/services/borrowing-and-circulation/library-cards` path was not accessible; the verified `/free` page is used instead.
- Guessed AlertSF article paths failed. The guide uses the accessible official ReadySF contact-plan PDF reference, and does not print an unverified registration path.

## Suggested existing media keys

| Guide | Cover / secondary candidates |
| --- | --- |
| `sf-first-72-hours-car-free-october-2026` | `sf-chinatown`, `presidio` |
| `bay-area-airport-first-night-decision-october-2026` | `sfo`, `bart` |
| `bay-area-first-7-30-days-action-plan-october-2026` | `settling`, `utilities-setup` |
| `bay-area-cross-bay-commute-home-base-october-2026` | `train`, `bay` |

These are existing keys read from `guide-media.ts`; reuse their original credit and caption metadata. The root agent owns media integration and aggregation.

## Validation completed

- `npx tsc --noEmit -p tsconfig.app.json` passed.
- Runtime import and `loadLocale('en')` / `translateText(value, 'en')` traversal passed for all **234 unique Chinese strings** across the four guides, with **zero untranslated Chinese strings**.
- Dictionary keys use the same `normalizeText` operation as the application (`trim`, then collapse whitespace). English template values retain their actual line breaks.
- Final article block counts: **20, 20, 25, 23** (88 total), with 31 source references / 28 distinct official URLs.
- Root owns full-catalog tests, UI verification and build after aggregation.
