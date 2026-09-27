# 五区生活快讯与福利核验 · 2026-09-27

本批新增 11 场活动、6 条新店／重开资讯、6 项福利、5 条生活快讯；另更新 Marufuku Burlingame 当前开业预告。按旧金山、半岛、南湾、东湾、北湾覆盖，中文与英文同步。区域活动、新店及北湾福利的证据见同日 `late-september-{sf-east,peninsula-south,north}-sources` 文档。

## 生活快讯

| 地区 | 官方来源 | 核验与编辑边界 |
| --- | --- | --- |
| 旧金山 | [SFMTA 37 Corbett](https://www.sfmta.com/travel-updates/37-corbett-resumes-30-foot-bus-service-monday-september-28-2026) | 9/28 恢复30英尺公交与经过Buena Vista的原进城站点；不虚构逐站时刻。 |
| 半岛 | [SMCL 9/3公告](https://smcl.org/blogs/post/homework-help-and-learning-resources/)、[资源入口](https://smcl.org/learning-tools/courses-tutorials/) | 新增Tutor.com免费辅导、写作、求职服务。博客正文由官方索引核对；资源页进一步确认。不同城市图书馆凭证不能默认为通用。 |
| 南湾 | [VTA Wolfe Road上匝道](https://www.vta.org/projects/notices/upcoming-long-term-wolfe-road-northbound-i-280-ramp-closure-beginning-october-2) | 10/2 20:00起，近Marriott的北向I-280上匝道预计关闭约一年。官方页对Wolfe Road来车方向有南／北矛盾，内容不猜来车方向，要求按现场标志和项目绕行图走现有loop ramp。 |
| 东湾 | [BART 黄线施工](https://www.bart.gov/news/articles/2025/news20250326-1) | URL含2025，但正文09.21.26更新列9/29、9/30、10/1午夜至次晨开行前单线运行，20–30分钟延误；没有虚构接驳巴士。 |
| 北湾 | [Rohnert Park–Cotati图书馆](https://sonomalibrary.org/visit/locations/rohnertparkcotati) | 9/1馆舍关闭、9/8启用6135 State Farm Drive临时点；取书／小馆藏／还书可用，打印复印及BiblioBox不可用；不声称重开日期。 |

`expiresAt` 是快讯展示截止日，不表示长期工程结束或服务福利终止。BART快讯10/1后退出当前推荐，其余本期快讯10/31后退出；条目逐项显示核验日期，月刊总标记仅称「最近更新」。

## 福利

| 地区 | 官方来源 | 条件 |
| --- | --- | --- |
| 旧金山 | [Museo Italo Americano](https://sfmuseo.org/) | 普通入馆周四及每月首个周日免费，18岁以下免费；课程和特别节目不自动包含。10/4是按每月规则换算。 |
| 半岛 | [SMCHA Free First Fridays](https://historysmc.org/free-first-fridays/) | 官方已明确公布2026-10-02免费，10:00–16:00；不再引用三月旧活动页或只说按规则推算。 |
| 南湾 | [SJPL Booktacular](https://www.sjpl.org/news/halloween-booktacular-giveaway-2026/)、[现行营业时间表](https://www.sjpl.org/locations-table/) | 10/24–31，0–18岁本人领取，每人一本、送完为止；无需卡、报名、变装，照护者不能代领。旧locations-hours入口404，已更正。 |
| 东湾 | [Oakland Zoo Tickets](https://www.oaklandzoo.org/tickets/)、[居民购票入口](https://ticket.oaklandzoo.org/oakland-resident) | Oakland居民折扣需姓名及本市住址证明；非居民同行普通票；不包含会员费／特别活动，停车与动态价格另查。不是EBT/WIC计划。 |

新卡片使用现有主题插图时保留明确的插图标记，不伪装成活动或餐厅现场照片。全部新优惠保留地区与逐项核验日期。

## 地图补充

9/27 直接读取 Census [2026 California Places](https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2026_Gazetteer/2026_gaz_place_06.txt)：American Canyon（GEOID 0601640）38.179033/-122.259602，Rohnert Park（0662546）38.347617/-122.700896；按既有目录规则四舍五入三位小数，只作为城市范围参考，不声称会场入口。San José 使用既有 San Jose 同一城市点37.296/-121.815（0668000），保留重音拼写。活动明确展示真实场地文字，论坛次日集合点仍待主办方公布，不用城市参考点代替导航地址。

## 发布范围

同时发布此前新增的10篇景点攻略与6篇日常办事指南。使用独立工作树准备发布；仅纳入对应内容、媒体、翻译、索引、路由和检查，保留远端现有功能和用户本地未完成工作。

已发布活动的目录保留9/23起的记录，让旧分享链接继续可用；当前列表按湾区日期隐藏已结束活动和福利。Napa两次讲座使用明确occurrenceDates，导出日历及活动目录不把中间空档误作活动日。

## 发布验证

- 独立工作树基于远端主分支 `8114d47`；保留其线上既有功能，没有混入源工作区尚未完成的3D改动。
- `npm run check` 全套通过：1,007项测试、类型检查与生产构建、302个公开HTML页面、277张分享卡片的尺寸与二维码逐张校验；lint为0 errors、39项既有warnings。
- `npm audit --audit-level=high`：0 vulnerabilities。
- 浏览器实查快讯中英文与赠书福利详情；本地开发服务器没有运行其默认API，信息流出现连接错误，不将其归因于新静态内容；线上API和实际生产页面需部署后验收。
- 最后调整优惠攻略的更新日期及核验范围说明后，27项优惠与本地化检查再次通过，并重新生成生产内容。
