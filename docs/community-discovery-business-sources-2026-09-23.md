# 本地新店与优惠核验 · 2026-09-23

核验日按 America/Los_Angeles：2026-09-23。以现有 11 店、50 条优惠为去重基线，本文件对应新增 **3 家已营业新店、5 条优惠／体验**。未修改聚合、旧数据、部署或 Git 提交。三家店分别覆盖 Peninsula、East Bay、South Bay；新店标题区分庆典、试营业与六月已营业，不把发现日期写成开业日期。

## 新店证据

| 新增 ID | 一手证据 | 判定与日期边界 |
| --- | --- | --- |
| hey-yogurt-san-mateo | [品牌首页](https://www.heyyogurtus.com/)目前显示 San Mateo September 1 grand opening；[官方门店目录](https://www.heyyogurtus.com/contact-us)列 310 S San Mateo Dr；[商家提交的 DSMA 试营业公告](https://dsma.org/event/hey-yogurt-san-mateo-soft-opening-free-yogurt-giveaway/)为 8/25–30。 | `open`，`opening-celebration`。9/1 不是首次服务日，故不填 `openedOn`。[DSMA 九月跨月日历](https://dsma.org/events/category/events/2026-08/)列 9/1–3 BOGO，已过期，不列优惠。 |
| chicha-san-chen-pleasanton | [北加州门店目录](https://chichasanchennorcal.com/locations)列 2709 Stoneridge Dr #102 并提供下单入口；[官方近期营业帖](https://www.instagram.com/chichasanchen.norcal/reel/Ddcx6bThuPB/)在浏览器可见，确认新店及六店常规营业时间；[品牌公司公告](https://tw.linkedin.com/company/chi-cha-san-chen)列 9/5–6 庆典和 8/29 起试营业。 | `open`，`opening-celebration`。常规时段周日至周四 11:30–21:30、周五周六至 22:00。开业限量徽章礼已经结束。不填首次服务日。 |
| asia-live-valley-fair | [品牌现行网站](https://asialivesv.com/)有各区域菜单与订位入口；[官方新闻索引](https://asialivesv.com/press-page/)收录 2026/6/23、6/25 已开业报道；[官方联系页](https://asialivesv.com/contact/)确认 2855 Stevens Creek Blvd；[商场首页](https://www.westfield.com/en/united-states/valleyfair)当前标注 Asia Live NOW OPEN。 | `open`，六月已营业、九月复核；没有精确首日就不填 `openedOn`。不声称九月新开，十月各餐饮区域需自行选实际订位时段。 |

## 优惠与体验证据

| 新增 ID | 一手证据与访问方式 | 条件、日期与范围 |
| --- | --- | --- |
| chicha-berkeley-bogo-sep25 | [品牌官方原帖](https://www.instagram.com/p/DddgD1VqMy2/)通过 Chrome 浏览器实读完整商家正文与海报可访问文本。 | 2026/9/25 周五 17–21 点，只在 Berkeley，指定款；须关注商家 IG 并向取饮柜台出示。帖子同时有 9/24 23 点截止的独立抽奖，该截止时间不套给 9/25 BOGO，也不把抽奖奖品当人人可领。没有执行关注、抽奖、评论或发送信息。 |
| onigilly-valley-fair-anniversary-sep26-27 | [Westfield 官方周年活动](https://www.westfield.com/en/united-states/valleyfair/events/onigilly-valley-fair-or-4th-anniversary-celebration/138770)直接读取；[商场首页](https://www.westfield.com/en/united-states/valleyfair)明确列出 2026/9/26–27。 | $10 便当＝2 枚预选饭团＋Karaage＋Edamame；商场二楼。转盘赠品和会员抽奖独立，不承诺所有顾客中奖。只使用两天周年证据，没有把转载里的 9/19–27 美食周套餐时长套给周年条目。 |
| chicha-norcal-birthday-bogo | [官方置顶生日规则](https://www.instagram.com/chichasanchen.norcal/p/DVUxImmkci8/)通过 Chrome 实读，正文注明 2026/3/1 起，当前编辑版本明确列出全部六家店。 | 本人生日当天、有效实体 ID、店内前台、不能预订；每笔最多 10 杯，多笔交易不设次数上限。需购买；没有宣称加料免费或全菜单无例外。没有官方截止日，使用 `ongoing` 而非杜撰 10/31。 |
| chicha-cupertino-free-tea-tasting | [品牌首页](https://chichasanchennorcal.com/)明确 complimentary tasting；[Cupertino 下午预约页](https://chichasanchennorcal.com/reservation/ola/services/lishan-oolong-tea-tasting)浏览器实际显示 15 mins / Free、English、一预约一座、提前 10 分钟签到。 | 地址由[官方店铺目录](https://chichasanchennorcal.com/locations)核实。官网介绍五种焙火，不把付费茶席／mocktail 当免费。当前默认日历没有当天可用时段；未确认十月具体余位，因此用 `check-local`，明确先查放位，不写固定日期，不声称十月已有可预订席位。未选择座位或提交预约。 |
| amc-stubs-tuesday-wednesday-base-ticket | [AMC 官方规则页](https://www.amctheatres.com/50pct-off-tuesdays-and-wednesdays?rel=discount-tuesdays_loy_alert_alert)搜索索引可读完整现行条款；[官方 FAQ](https://www.amctheatres.com/faqs/amc-stubs)交叉确认；[NewPark 12 官方门店](https://www.amctheatres.com/movie-theatres/san-francisco/amc-newpark-12)索引明确列 Discount Tuesdays and Wednesdays。 | 免费 Insider 可用；成人晚场基础票价减半，而非整笔总价。税、在线费、premium／特别活动附加费除外；每放映日限 10 张。按周二／三规则推算十月 6/7、13/14、20/21、27/28；非逐场票库确认，checkout 为准。没有官方截止日，使用 `ongoing`。直接打开 AMC 页面可能进入排队页；本次条款证据来自官方站索引，不声称已完成任何实际票单。 |

## 原三店复核：提供 root 的精确替换文案

只提供建议，不编辑原 `september-openings.ts`。下列中文已加到 `community-discovery-openings-en.json`；保留旧 ID、地址、图片、`announced` 状态，不填 `openedOn`。

### Florecita · 3349 23rd Street

- 直接证据：[官方迁址公告](https://www.instagram.com/p/DbB-57dgXmF/)和[官方最新检查进度](https://www.instagram.com/florecitapanaderia/reel/DdcQmQ4SWlc/)，均 Chrome 实读。后者显示 5 days ago：检查已过，但试营业细节仍在整理，只提示留意下个周末。不能把相对周末线索推成确定开门日。
- `dateLabel`: `已通过检查 · 迁址试营业日期待公布`
- `summary`: `Florecita 将从 Bryant Street 微型烘焙坊迁到 Mission 区前 Shuggie’s 空间。品牌最近的 Instagram 公告确认已通过检查，仍在敲定试营业安排。`
- `editorTip`: `旧微型店已在 8/29 结束营业。新店虽已通过检查，9/23 核验时仍未发布最终试营业日期与时段；等品牌公布后再前往 3349 23rd Street。`
- `sourceUrl`: `https://www.instagram.com/florecitapanaderia/reel/DdcQmQ4SWlc/`
- `sourceLabel`: `Florecita 官方 Instagram 迁址检查进度`
- `verifiedAt`: `2026-09-23`

### Handroll Hawker · 2360 Polk Street

- 直接证据：[官网](https://www.handrollhawker.com/)列地址和官方 IG 帐号；[官方开业公告](https://www.instagram.com/handrollhawker/reel/Ddjx_AHPqa2/)在品牌主页公开帖子摘要实读，具体为 9/29 周二 11:30。不能把未来计划写成已开。
- `dateLabel`: `官宣 9/29 11:30 开业 · 目前仍为预告`
- `summary`: `Handroll Hawker 在 Polk Street 带来澳洲风格的外带寿司手卷。品牌最新 Instagram 已公布 9/29 周二 11:30 开门，主打简洁口味和方便带走的手卷。`
- `editorTip`: `9/23 核验时尚未到官宣开业日，当前仍列预告。出发前复查品牌当天动态；2360 Polk Street 地址已确认，后续常规营业时间待公布。`
- `sourceUrl`: `https://www.instagram.com/handrollhawker/reel/Ddjx_AHPqa2/`
- `sourceLabel`: `Handroll Hawker 官方 9/29 开业公告`
- `verifiedAt`: `2026-09-23`

### Woods Wharf · 2847 Taylor Street

[Woods 官方首页](https://www.woodsbeer.com/)现行地址列表未确认该 Wharf 新点的营业时间；不能把别处快闪或 Alioto Plaza 临时摊位当作 2847 Taylor 已开证据。本轮不建议改变原 `announced`。

## 排除线索及访问边界

- **Foodie Week 的多商家细项**：商场[官方 Foodie Week 页面](https://www.westfield.com/en/united-states/valleyfair/foodieweek)可确认 9/19–27，但正文抽取仅含标题；旧官方活动 URL `/events/foodie-week-returns-to-westfield-valley-fair/138424` 返回 404。[转载聚合页](https://www.findglocal.com/US/Santa-Clara/155794016908/Westfield-Valley-Fair)有 Tong Sui、Stick & Wok、Eataly、Asia Live 套餐，但本轮没有逐条取得商家原始优惠条款，不写入。Onigilly 另有独立完整官方周年页，才采用。
- **Siam Station Milpitas**：[商家官网](https://www.siam-station.com/)能确认 210 Barber Ct 当前营业，但只有早期 2026 新店／许可线索，不宜为了数量包装成九月新开；本轮未新增。
- **Chengdu Memory Fremont**：[官方店页](https://www.chengdumemorybayarea.com/)确认 2090 Warm Springs Ct Suite 100、现行营业时间；[商家 Linktree](https://linktr.ee/chengdumemoryhotpot)连到 IG 与小红书。尚无本轮新开日期和完整优惠证据，本轮未新增。IG web 抓取 throttled，小红书短链跳转被 web 工具拒绝；没有借此声称已读商家促销。
- **Instagram**：web 抓取部分商家页限流。随后通过 Chrome 实际读取 CHICHA San Chen 的公开商家资料、指定优惠原帖、Florecita 迁址原帖和 Handroll Hawker 主页公开开业公告；没有登录操作、发消息、评论、关注或提交任何表单。公开网站以一手证据为准，未把第三方网红合作帖当最终依据。
- **小红书**：root 本轮已用浏览器实际尝试，搜索结果要求登录后查看；没有登录或绕过。小红书只能作为发现线索，不能据访问受限的结果宣称促销或开门已确认。
- **日期已过／明确更晚的线索**：Hey Yogurt 赠饮和 BOGO、Pleasanton 开业徽章不新增为可领优惠。CHAGEE Valley Fair 的十一月及 Izumi 十二月预告超出十月底范围；Kajiken 春季原计划延后，不能按过期预告判定开业；Chubby Tan 十月或十一月未确定，不承诺十月可吃。
- 配图仅复用现有 `neighborhood-table` 与 `cinema-night` 主题插图，不用不相关店铺实景冒充这些新店或优惠。
