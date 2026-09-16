# 三处具体地点的攻略照片补充

核验日期：2026-09-16。通过 Commons 源页和实时 imageinfo API 双重核对作者、拍摄日期、许可与原图地址。3 张均为真正地点资料照片；保留历史年份，不描述为 2026 现场。

| Key | 地点与作者 | 明示许可 | 源页 |
| --- | --- | --- | --- |
| `community-history-park` | San Jose History Park 的 Printing Office 建筑；HarshLight；2010-03-28 | CC BY 2.0；Commons 记载 2018-05-10 Flickr 许可复核通过 | [History Park (4526489917)](https://commons.wikimedia.org/wiki/File:History_Park_(4526489917).jpg) |
| `community-tilden-little-farm` | Tilden Little Farm；Harmonywriter；EXIF 日期 2013-09-18 | CC BY-SA 3.0 | [Tilden Regional Park little farm](https://commons.wikimedia.org/wiki/File:Tilden_Regional_Park_little_farm.jpg) |
| `community-china-camp-village` | China Camp 渔村、码头与岸边；Sanfranman59；2010-03-21 | 原作者提供多重许可，本次采用 CC BY-SA 3.0 | [China Camp, San Rafael](https://commons.wikimedia.org/wiki/File:China_Camp_247_N_San_Pedro_Rd_San_Rafael_CA_3-21-2010_4-39-54_PM.JPG) |

许可链接、原作者署名、出处链接和缩放说明均写入 `src/data/community-place-media.json`，随公共图注显示。BY-SA 图片的缩放版本沿用原 CC BY-SA 3.0 许可。无商家私有素材、媒体转载图片或来源不明图片。

原图与 Commons 原始元数据保存在 `output/community-place-originals/`：`commons-imageinfo.json` 保留 API 返回的完整作者、许可、原图尺寸与地址；`conversion-receipt.json` 记录每个输出文件的宽高、大小、SHA-256。

仅用 Pillow 进行等比例缩小、RGB 编码及 WebP 格式转换。没有裁切文件、补绘、AI 修图、场景替换、调色、抹除标志或上采样。每张输出 1280 px 主图与 480 px 小图；全部使用 Pillow verify 验证可解码，逐张用 view_image 查看原图和主 WebP。

视觉核对：History Park 图中 Printing Office 招牌、门廊和木质立面清晰，適合作南湾历史公园攻略封面；Tilden 图较旧、自然光偏灰，但农舍、风车、禽鸟和围栏可辨，适合作正文资料图；China Camp 图完整保留渔村、码头和海岸关系，适合作正文介绍。Tilden 不把图中的禽鸟描述成当前动物清单；History Park 不用于表示 Emma Prusch。

主图尺寸依次为 1280×853、1280×960、1280×916。共 6 个 WebP 文件约 1.01 MiB。英文 alt/caption/credit 与推荐攻略槽位在 `output/place-media-translations-en.json`。此任务未修改 guide-media 注册入口、攻略映射或 en.json，交由 root 合并。
