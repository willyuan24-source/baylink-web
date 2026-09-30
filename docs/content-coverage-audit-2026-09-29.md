# 湾区活动查漏：2026-09-29

本轮由用户指出缺少 San Francisco Water Lantern Festival 后启动。核对范围为 2026-09-29 至 10 月底仍可参加的活动，并与现有事件 ID、名称和主办方网址去重。此次补录不构成“湾区所有活动已收齐”的保证。

## 补录清单

| 活动 | 日期 | 真实地点 | 核验来源 |
| --- | --- | --- | --- |
| San Francisco Water Lantern Festival | 10/3、10/4 | Foster City，Leo J. Ryan Park | [主办方](https://www.waterlanternfestival.com/events/san-francisco)、[市府](https://www.fostercity.org/Calendar.aspx?EID=1142) |
| Foodwise Latine Makers | 10/3 | SF Ferry Terminal Plaza / Ferry Plaza | [Foodwise](https://foodwise.org/events/pop-ups-on-the-plaza-celebrating-latine-makers/) |
| Top of the Hill Festival | 10/17 | Daly City | [市府](https://www.dalycity.org/1221/Daly-Citys-Top-of-the-Hill-Festival) |
| FOG Diwali Mela | 10/24 | Fremont，Washington High School | [主办方](https://fogsv.com/event/fog-diwali/) |
| The Hellflowers / Knights of Molino | 10/2 | San Jose，Lake Cunningham Skate Park | [主办方售票页](https://www.eventbrite.com/e/the-hellflowers-and-knights-of-molino-free-concert-tickets-1996056752479) |
| Djerassi 免费艺术徒步 | 10/5 | Woodside，须预约 | [Djerassi](https://djerassi.org/events/fall-art-hikes/) |
| Sunday Streets Excelsior | 10/18 | SF，Mission Street | [SF Rec & Park](https://sfrecpark.org/Calendar.aspx?EID=10817) |
| A Toast to Sausalito | 10/17 | Sausalito，Caledonia Street | [市府](https://www.sausalito.gov/departments/parks-and-recreation/events/a-toast-to-sausalito-beer-wine-spirits-festival) |
| NEXUS Party | 10/1 | SF，YBCA | [MoAD](https://www.moadsf.org/event/moad-ybca-present-the-nexus-party-the-official-party-of-sf-bay-area-black-art-week) |
| San Francisco Fall Show | 10/15–18 | SF，Fort Mason | [主办方](https://sffallshow.org/about/) |
| Inner Sunset Flea | 10/11 | SF，Irving Street | [Sunset Mercantile](https://sunsetmercantilesf.com/innersunsetflea/) |
| Potrero Hill Festival | 10/17 | SF，20th Street | [官网首页](https://potrerofestival.com/)、[官方 FAQ](https://potrerofestival.com/sponsorship-faqq/) |

## 内容边界

- 同时修复明确活动名被误当作地理限制的搜索问题：SF 水灯节、简繁中文及 San Francisco Water Lantern Festival 识别为同一条活动，仍显示 Foster City。用户另外指定的城市、日期、费用、年龄或排除条件继续生效；普通 SF 活动查询不扩大到半岛。前后端受控别名表须同步维护。
- 水灯节的品牌名称带 San Francisco，实际归属半岛 Foster City。市府明确免费入场，放灯体验另购票；不把整套体验算作 $0，也不把页面同时显示的早鸟价当实时成交价。两天独立日期，计划保留 19:30 制作与 20:00–21:00 放灯。
- FOG Diwali 的免费登记不等于免费门票。Sausalito 的免费街区入场不包含付费品饮。会员价、酒类资格和可选消费不套用于所有用户。
- Potrero 日期和 10:00 开始可确认，但首页写 17:00 结束、FAQ 写 16:00；保留活动展示，结束时间和精确计划标待确认，不抄混有旧年份的演出阵容。
- 水灯图来自主办方活动页的官方宣传素材，原始 AVIF 2010×2712、70,104 字节；标注为主题宣传资料，不声称是尚未举行的 2026 本场实拍。其余条目使用已标明用途的情境插图。
- Daly City、Woodside 与 Sausalito 仅补充 Census 城市参考点。GEOID 分别为 0617918、0686440、0670364；不是活动入口，也不构成精确交通导航。

## 其他线索

已排除站内已有的 Chowder Fest、FilBookFest、African Arts Festival、Bay Area Science Festival 等重复项。其他已找到但仍需补齐的信息见 [区域核查记录](coverage-audit-regional-2026-09-29.md) 与 [SF/北湾核查记录](coverage-audit-sf-north-2026-09-29.md)。

另外复核了 [California’s Great America 官方加开日](https://www.sixflags.com/blog/california-s-great-america-has-officially-extended-its-season)：10/3、10/10–11、10/17–18、10/31–11/1。它是营业日延长，不据此编造万圣节特场、每日时间或折扣。

[UMe Tea 商家公告](https://umetea.com/en/events) 与 [Pinot’s Palette Alameda](https://www.pinotspalette.com/alameda) 的开业优惠另有先前核查；没有把其他已结束的开业庆典重新标为有效优惠。本轮补录清单为活动，未新增优惠或新店记录。

## 后续查漏方法

每次先按地区查看市府、主办方和主要场馆日历，再与站内 ID、名称、别名、网址及日期对账。多日期活动保留独立 occurrenceDates；品牌名中的城市与实际举办城市分别核验。无法确认的费用、结束时间或售罄状态明确保留未知，不用搜索摘要补齐。发布时同步前端与后端目录，并检查详情路由、搜索、日期筛选和图片。
