# Official event images: sources and rights (2026-10-08)

Lane CNT-MEDIA. The owner decided on 2026-10-08 that BAYLINK may show an event organiser's own image (poster, key art or event photo from the official event page) next to coverage of **that same event**, labelled 官方图 with a link to the official page, with a takedown contact on the About page. On 2026-10-08 09:45 PT he approved all 54 items marked 建议批准 in the CNT-MEDIA-LIST candidate list (`opus-qa/overhaul/media/official-image-candidates.md` / `.json`, outside the repository). The 18 待判断 and 18 不建议 items were not approved and were not downloaded.

Result: **43 images ship**, 1 approved image was downloaded but not used, and 10 approved URLs refused the download. No other image was substituted for a refused one. No AI images were created or used, and no image was edited beyond resizing.

## How it is wired

- `src/data/official-event-media.json` holds one record per image: `key` (`official-<event id>`), `eventId`, `src`/`width`/`height` (no `srcSet` since WEB-IMAGES: the image ladder builds every srcset, see [images.md](images.md) before adding or reusing an image), `kind` (`"photo"` for photos, `"poster"` for posters, key art, collages and graphics, so no surface calls artwork a photo), `artwork` (photo, poster, key-art, collage or graphic), `fullFrame: true` for everything that is not a photo (never cropped, D25) or a `focal` point `[x%, y%]` for photos, zh `alt`/`caption`/`credit`, `creditUrl` (the official event page), `rights` `{basis, evidenceUrl, scope: "same-event coverage only"}`, `originalUrl`, `retrievedAt` and the `sha256` of the downloaded original.
- `src/data/guide-media.ts` registers the records into `GUIDE_IMAGES` after the federal public-domain photo. Pages receive only what they render plus `focal` and `rights`; the download fields stay in the JSON.
- `src/data/verified-place-media-updates.ts` exports `OFFICIAL_EVENT_IMAGE_UPDATES` (event id → image key, built from the JSON) and merges it into `VERIFIED_EVENT_PLACE_MEDIA_UPDATES`. `monthly-edition.ts` applies `OCTNOV_EVENT_MEDIA_UPDATES` and `octnov-2026-extra-image-updates.json` after that map, so the affected events were removed from them; `tests/official-event-media.test.ts` fails if one comes back.
- The events were also removed from the venue-photo approvals they used before (Main Library, Ferry Building, Yerba Buena Gardens, OMCA, Presidio, Filoli, Petaluma River, Mountain View CPA). Captions that named those events were shortened in zh and en. The B Street alias had no other event and was removed.
- `src/data/official-event-media-en.json` (registered in `scripts/english-sources.json`) has the English alt, caption and credit; Traditional Chinese uses the runtime OpenCC conversion.
- Labels: every credit says 官方 (en: official), so `getImageProvenance` returns 官方图 / Official image / 官方圖.
- Takedown: About → 来源与核验方法 now says 图片权利人如需更正或下架，请发邮件至 Baylink.us@gmail.com，我们会尽快处理。 (en: "Image rights holders who want a picture corrected or removed can email Baylink.us@gmail.com. We will respond as soon as we can.") No response deadline is promised; the owner has not approved one.

## Rights

No organiser in this batch publishes an open licence for these images. Every shipped record uses `rights.basis: "promo-editorial"`: the organiser published the image on its own event page to promote that event, and BAYLINK shows it only beside coverage of the same event, credited and linked, under the owner's 2026-10-08 decision. `evidenceUrl` is the official event page. The candidate list recorded these site notes (quoted where the site has terms):

- Foodwise press page: offers "high-quality photos of our farmers markets" to press on request.
- Filoli press page: "download press releases and media images".
- SFPL press room: offers "Photos, logos and other Library graphics".
- Half Moon Bay press kit (not shipped): "Use of festival branding is only approved for editorial use unless permission is first acquired".
- Others: site footers such as "All Rights Reserved" or no statement; see each item.

Use is limited to editorial event surfaces (event page, listing cards, calendar, planner, home weekend cards, Little Bay). Do not use these images in ads, share-card promotion, tester recruiting or fundraising. Recognisable people appear in several photos (including children in the Goblin Jamboree, Sunnydale and BORP photos); they are shown as the organiser published them and are not cropped into close-ups.

## Processing

Downloads went into a new, empty directory outside the repository (`opus-qa/overhaul/media/downloads-1008/`), treated as untrusted data. Scripts live in the lane directory (`opus-qa/overhaul/lanes/CNT-MEDIA/work/`: `download.py`, `inspect_images.py`, `process.py`, run with `python -E -P` and paths as arguments; Pillow 12.3.0).

- One GET per listed URL. Seven CDNs answered the first request with a WebP/AVIF conversion because the request offered those types; they were fetched again from the same URL asking for the listed type (`image/png` or `image/jpeg`), and the listed bytes came back. Three files differ in size from the candidate list's HEAD request but match its dimensions and type (Sunday Streets, Harding Carnival, Halloween Hoopla); they were viewed and are the listed images.
- Every file was checked by magic bytes and Pillow, and every one matched its listed dimensions.
- Proportional resize only (LANCZOS): main = 1280 px wide, or the original width when smaller (never upscaled); small = 480 px wide. WebP quality 82, method 6. Each output is a fresh image built from pixel data, so no EXIF, XMP or ICC data is written.
- No crop, retouch, colour edit or AI step. Two photos embedded a Display P3 profile (BORP, Livermore) and one a compact sRGB profile (Thrive City); they were converted to sRGB with LittleCMS so they look the same once the profile is dropped. sRGB profiles were simply dropped. Transparency is kept only where it is used (Danville banner, SFPL Western Addition illustration).
- Every original and every rendition was opened and looked at before alt text and captions were written.

## Shipped images

### 1. `berkeley-borp-adaptive-sports-expo-oct17-2026`

- Event: BORP Adaptive Sports Expo and Community Celebration (Berkeley, 2026-10-17)
- Official page (`creditUrl`, `rights.evidenceUrl`): <https://www.borp.org/expo/>
- Image URL (`originalUrl`): <https://www.borp.org/wp-content/uploads/2026/07/78B_2994b_25j18_cScotGoodman.jpg>
- Type: photo, focal 50% / 45%
- Rights: `promo-editorial`, scope "same-event coverage only". Site note: Site footer "All Rights Reserved"; photographer credit in filename (Scot Goodman). Credit BORP / Scot Goodman.
- Retrieved: 2026-10-08T10:03:13-07:00. Original: 2048 × 1362 JPEG, 4,150,826 bytes, SHA-256 `dea4b46fea38982658c9dccefc761705943c1e76f6ec9809192fcfcb5023766f`
- Renditions: `/guides/official-events/berkeley-borp-adaptive-sports-expo-oct17-2026.webp` 1280 × 851, 155,924 bytes, SHA-256 `3331916ba8f9cf0e67fe118be498b9a195e516875cd325f29ab9e0b9686644cb`; `-small` 480 × 319, 33,206 bytes, SHA-256 `25343305487fd917ed0b3f1fda0bd7e236c67303e3b80342da997ecad641c3ad`. converted embedded Display P3 profile to sRGB (appearance-preserving)
- Replaces: no listing image (text card; the event's `weekend` key is an AI illustration that listings hide)
- Caption: 2025 年 BORP Adaptive Sports Expo 的活动官方照片（图上印有“BORP Adaptive Sports Expo 2025”）；不是 2026 年活动现场，体验项目与场地安排以官方页面为准。

### 2. `sf-bay-area-science-festival-2026`

- Event: Bay Area Science Festival: hands-on science at UCSF (San Francisco, 2026-10-17)
- Official page (`creditUrl`, `rights.evidenceUrl`): <https://bayareasciencefestival.org/>
- Image URL (`originalUrl`): <https://bayareasciencefestival.org/wp-content/uploads/2021/09/i-4rz9ZzW-X3.jpg>
- Type: photo, focal 60% / 45%
- Rights: `promo-editorial`, scope "same-event coverage only". Site note: Footer "All Rights Reserved"; no press terms found.
- Retrieved: 2026-10-08T10:03:14-07:00. Original: 1600 × 1068 JPEG, 526,460 bytes, SHA-256 `f3ebcd9eb26c3d90650a3ae4fe81dfa9d07e9cdba7fbe5eb950d03b070d94ed4`
- Renditions: `/guides/official-events/sf-bay-area-science-festival-2026.webp` 1280 × 854, 156,664 bytes, SHA-256 `090838855d9eddb0f7c54b47066851c301c2a399e2721a393915c7281b190170`; `-small` 480 × 320, 47,002 bytes, SHA-256 `54ad7949577a4f3fc731ea27fff0757ef69c179b99b2cee98e13a3329210aa33`. dropped embedded sRGB IEC61966-2.1 profile
- Replaces: no listing image (text card; the event's `family-workshop` key is an AI illustration that listings hide)
- Caption: 往届湾区科学节在球场举办时的活动官方照片（主办方网站 2021 年发布）；2026 年活动在 UCSF Mission Bay，不是图中场地，摊位与项目以官方安排为准。

### 3. `sf-sunnydale-pumpkin-fest-2026`

- Event: Sunnydale Pumpkin Fest at The Hub (San Francisco, 2026-10-17)
- Official page (`creditUrl`, `rights.evidenceUrl`): <https://thehubinsf.org/event/sunnydale-pumpkin-fest-2/>
- Image URL (`originalUrl`): <https://thehubinsf.org/wp-content/uploads/2024/08/MH_Sunnydale_HerzPlayground_1stAnnualPumpkinPatch-20.jpg>
- Type: photo, focal 50% / 45%
- Rights: `promo-editorial`, scope "same-event coverage only". Site note: No licence stated.
- Retrieved: 2026-10-08T10:03:15-07:00. Original: 1920 × 1280 JPEG, 279,191 bytes, SHA-256 `3c0d6a8c8fd7eb980762a40d97ed34bd5332745640bbae4a81535ccbc43c6a3a`
- Renditions: `/guides/official-events/sf-sunnydale-pumpkin-fest-2026.webp` 1280 × 853, 159,226 bytes, SHA-256 `18a2bb09e526b4b2e482e6e9a6cebf4bf8cda187d8e658e7d63d7f61ad3ecaba`; `-small` 480 × 320, 35,440 bytes, SHA-256 `1ac20719b8d8914a5d84c9cb98bf5f287f41bee7af10efa8bc866a37fdf04b2f`
- Replaces: no listing image (text card; the event's `autumn-neighbors` key is an AI illustration that listings hide)
- Caption: 往届 Sunnydale 社区南瓜活动的活动官方照片（主办方网站 2024 年发布）；不是 2026 年南瓜节现场，活动内容以官方页面为准。

### 4. `r2-santarosa-soco-halloween-2026`

- Event: Santa Rosa SoCo Halloween Makers Market (Santa Rosa, 2026-10-17)
- Official page (`creditUrl`, `rights.evidenceUrl`): <https://www.thesocomarket.com/events-2/the-soco-market-bhn72-zkhxy-ps7pr-345ml-r8333-xtzck>
- Image URL (`originalUrl`): <https://static1.squarespace.com/static/6216df3c6c509b11681a6a25/6216e3ba7b20600a9e95806b/698bb630c47d2a7603cba10a/1770764111769/9.png?format=1500w> (served from <https://images.squarespace-cdn.com/content/6216df3c6c509b11681a6a25/1770763949313-499P06IJAHVPGLBWESWW/9.png?format=1500w&content-type=image%2Fpng>)
- Type: key-art, `fullFrame` (never cropped)
- Rights: `promo-editorial`, scope "same-event coverage only". Site note: Press page exists (thesocomarket.com/press-1), no image terms.
- Retrieved: 2026-10-08T10:05:26-07:00. Original: 1500 × 938 PNG, 674,720 bytes, SHA-256 `9d738f252d6e1f498fe5ec6d47ad20f3af812675bc98fa399804789551e0a1fa`
- Renditions: `/guides/official-events/r2-santarosa-soco-halloween-2026.webp` 1280 × 800, 181,348 bytes, SHA-256 `de59b7f75a8350c62df8730f004a85cb2b2d0d54c13c9cc829c3d1a3a9424d51`; `-small` 480 × 300, 37,402 bytes, SHA-256 `1afa8761a673cf4784dc9ca4900826f9786ca071066d41fb2827adf63fa25053`
- Replaces: no listing image (text card; the event's `weekend` key is an AI illustration that listings hide)
- Caption: The SoCo Market 官方宣传图：往届市集南瓜拱门布景的照片，叠加市集标志；不是 2026 年万圣节市集现场。

### 5. `berkeley-bird-festival-2026`

- Event: Berkeley Bird Festival: a community day for birds and nature (Berkeley, 2026-10-18)
- Official page (`creditUrl`, `rights.evidenceUrl`): <https://berkeleybirdfestival.org/>
- Image URL (`originalUrl`): <https://berkeleybirdfestival.org/wp-content/uploads/2025/09/DSC_0635-1024x683.jpg>
- Type: photo, focal 45% / 50%
- Rights: `promo-editorial`, scope "same-event coverage only". Site note: Footer "All Rights Reserved".
- Retrieved: 2026-10-08T10:03:18-07:00. Original: 1024 × 683 JPEG, 135,662 bytes, SHA-256 `84f09ca3e9876f7af26c68bb91794bf1a3309e6e9dad8d33ead24504fd106aa9`
- Renditions: `/guides/official-events/berkeley-bird-festival-2026.webp` 1024 × 683, 96,840 bytes, SHA-256 `140b8cfc5991458660049696c68be163a42549a2319995ac06fbd1181429b030`; `-small` 480 × 320, 22,736 bytes, SHA-256 `db3065d20416ab2c5a403f2ac34a536733d515e65052a12334c8b597f6d7724d`
- Replaces: no listing image (text card; the event's `weekend` key is an AI illustration that listings hide)
- Caption: 主办方网站 2025 年发布的活动官方照片：往届节日人行道上的粉笔字与粉笔鸟画；不是 2026 年活动现场，观鸟行程以官方安排为准。

### 6. `sf-sunday-streets-excelsior-oct18-2026`

- Event: Sunday Streets Excelsior: Mission Street Opens to People (San Francisco, 2026-10-18)
- Official page (`creditUrl`, `rights.evidenceUrl`): <https://sundaystreetssf.com/sunday-streets-excelsior-2026/>
- Image URL (`originalUrl`): <https://sundaystreetssf.com/wp-content/uploads/2026/09/DSC00295-1-scaled.jpg>
- Type: photo, focal 45% / 55%
- Rights: `promo-editorial`, scope "same-event coverage only". Site note: © Livable City; no licence stated.
- Retrieved: 2026-10-08T10:05:38-07:00. Original: 2560 × 1707 JPEG, 910,532 bytes, SHA-256 `9c1d732d505dbd68cbc48c042859f956d86015628753d6cd68736cbaa84c2f61`
- Renditions: `/guides/official-events/sf-sunday-streets-excelsior-oct18-2026.webp` 1280 × 854, 233,614 bytes, SHA-256 `937c554f28b8ccadf65eaf6f13fba041df926d3186a7da7b70b61ee5e1431f4c`; `-small` 480 × 320, 41,444 bytes, SHA-256 `713ef66ffc3e966d65df90beae7c054f0135c766269d9a893ca1df7aee93d332`
- Replaces: no listing image (text card; the event's `autumn-neighbors` key is an AI illustration that listings hide)
- Caption: 往届 Sunday Streets 在 Excelsior 的 Mission Street 封街现场，活动官方照片（主办方 2026 年 9 月发布）；不是 2026 年 10 月 18 日现场，封街路段与时间以官方页面为准。

### 7. `sf-halloween-broadside-printing-oct17-2026`

- Event: Halloween Broadside Printing on a 1909 Handpress (San Francisco, 2026-10-17)
- Official page (`creditUrl`, `rights.evidenceUrl`): <https://sfpl.org/events/2026/10/17/activity-halloween-broadside-printing-event>
- Image URL (`originalUrl`): <https://sfpl.org/sites/default/files/2026-08/31306.png>
- Type: collage, `fullFrame` (never cropped)
- Rights: `promo-editorial`, scope "same-event coverage only". Site note: SFPL press room offers "Photos, logos and other Library graphics"; © SFPL.
- Retrieved: 2026-10-08T10:03:20-07:00. Original: 951 × 469 PNG, 1,095,501 bytes, SHA-256 `df8bf05a411e55163bab5b9d472d2d700ca688881fb843709fc7df09686af322`
- Renditions: `/guides/official-events/sf-halloween-broadside-printing-oct17-2026.webp` 951 × 469, 64,606 bytes, SHA-256 `fdbd241144b3353a532cd2a99955cd1342735912018a0e0e1fc4bb4139192ac0`; `-small` 480 × 237, 22,692 bytes, SHA-256 `a1eac964633fc67c86820a6a9baaed748c161a07bf3f395d27f69d3e28763284`
- Replaces: `verified-sf-main-library`, 资料图 · 2013 (SparkFun Electronics · CC BY 2.0)
- Caption: SFPL 活动页的官方宣传图：活字字盘与南瓜图案拼贴；不是活动现场照片，也不代表当天使用的印刷机。

### 8. `atherton-train-station-museum-opening-2026`

- Event: Historic train station museum opens October 18 (Atherton, 2026-10-18)
- Official page (`creditUrl`, `rights.evidenceUrl`): <https://www.athertonca.gov/Calendar.aspx?EID=4034&calType=0&day=30&month=9&year=2026>
- Image URL (`originalUrl`): <https://www.athertonca.gov/ImageRepository/Document?documentID=12815>
- Type: photo, focal 40% / 50%
- Rights: `promo-editorial`, scope "same-event coverage only". Site note: Town of Atherton page; no licence stated.
- Retrieved: 2026-10-08T10:03:20-07:00. Original: 2100 × 1486 JPEG, 406,257 bytes, SHA-256 `389db587a2f5b8add9741f4244ac51eb088d384aeaf3c96e75b43d30c5341c92`
- Renditions: `/guides/official-events/atherton-train-station-museum-opening-2026.webp` 1280 × 906, 128,108 bytes, SHA-256 `ac4dbd1db9873d52a68585bf01f9e71db184c168a2c3ef7e19a70840a72aed0e`; `-small` 480 × 340, 32,536 bytes, SHA-256 `a1a891305ce00f3ccd6e2431451aa8b4530246335436f9eb5875c5c8689debe5`
- Replaces: no listing image (text card; the event's `everyday` key is an AI illustration that listings hide)
- Caption: Atherton 镇活动页的官方宣传图：Atherton 车站微缩模型与蒸汽机车模型的照片；拍的是模型，不是真实车站，也不是揭幕当天现场。

### 9. `sf-fall-show-oct15-18-2026`

- Event: San Francisco Fall Show: art, antiques and design (San Francisco, 2026-10-15 to 2026-10-18)
- Official page (`creditUrl`, `rights.evidenceUrl`): <https://sffallshow.org/about/>
- Image URL (`originalUrl`): <https://sffallshow.org/wp-content/uploads/2024/10/about-1.jpg>
- Type: photo, focal 50% / 45%
- Rights: `promo-editorial`, scope "same-event coverage only". Site note: © SF Fall Show; press page has no image terms.
- Retrieved: 2026-10-08T10:03:21-07:00. Original: 800 × 533 JPEG, 174,065 bytes, SHA-256 `ee4c8a2ba29949039126f778a5d716dc00d6ab27bc02b52567bcaa3013910a60`
- Renditions: `/guides/official-events/sf-fall-show-oct15-18-2026.webp` 800 × 533, 72,420 bytes, SHA-256 `cfbda005f1f7f9391693219c55d6b79a1bcb03bc70aa95fcb1b2ff97e8e71da6`; `-small` 480 × 320, 33,162 bytes, SHA-256 `9ceb0d521f4cc02a8b9b61d5c3b5f31bd09718f95f451ee40cafbba7509c259a`. dropped embedded sRGB IEC61966-2.1 profile
- Replaces: no listing image (text card; the event's `culture-visit` key is an AI illustration that listings hide)
- Caption: 往届 San Francisco Fall Show 展位的活动官方照片（主办方网站 2024 年发布）；不是 2026 年展会现场，参展商与展品以官方公布为准。

### 10. `oakland-vintage-fashion-faire-2026`

- Event: Vintage Fashion Faire: vintage clothing market at the Bridge Yard (Oakland, 2026-10-17)
- Official page (`creditUrl`, `rights.evidenceUrl`): <https://www.vintagefashionfaire.com/>
- Image URL (`originalUrl`): <https://www.vintagefashionfaire.com/VintageFashionFaire2026.JPG>
- Type: photo, focal 50% / 55%
- Rights: `promo-editorial`, scope "same-event coverage only". Site note: No licence stated.
- Retrieved: 2026-10-08T10:03:22-07:00. Original: 4010 × 2675 JPEG, 4,196,571 bytes, SHA-256 `af086f9cf1d37ec3c72793f32c6fae3de5b7044466157ba920ca340e93da016b`
- Renditions: `/guides/official-events/oakland-vintage-fashion-faire-2026.webp` 1280 × 854, 298,122 bytes, SHA-256 `6b570d8bebd07f073fdf0b3cad23967e005e09af5f287c2b1da8ab5313ee4828`; `-small` 480 × 320, 61,200 bytes, SHA-256 `4265bed783da393fc94d45e8ac9b1f77642a41691ec277d521d377544d386b08`
- Replaces: no listing image (text card; the event's `weekend` key is an AI illustration that listings hide)
- Caption: Vintage Fashion Faire 官网首页的活动官方照片（往届市集，拍摄年份未注明）；不是 2026 年 10 月 17 日现场，摊位与入场安排以售票页为准。

### 11. `daly-city-top-of-the-hill-festival-2026`

- Event: Daly City Top of the Hill: a free street music and culture festival (Daly City, 2026-10-17)
- Official page (`creditUrl`, `rights.evidenceUrl`): <https://www.dalycity.org/1221/Daly-Citys-Top-of-the-Hill-Festival>
- Image URL (`originalUrl`): <https://www.dalycity.org/ImageRepository/Document?documentId=13723>
- Type: poster, `fullFrame` (never cropped)
- Rights: `promo-editorial`, scope "same-event coverage only". Site note: City of Daly City flyer.
- Retrieved: 2026-10-08T10:03:23-07:00. Original: 1200 × 1800 PNG, 2,156,673 bytes, SHA-256 `3e7bb96e4b12f4307bebc7d470e7010943b1ee3f124795b3e7927b09a6d837cb`
- Renditions: `/guides/official-events/daly-city-top-of-the-hill-festival-2026.webp` 1200 × 1800, 330,242 bytes, SHA-256 `b702129c6d31756ce848385bf9e675d43376ff0b722edf63e66e6b931088a094`; `-small` 480 × 720, 93,374 bytes, SHA-256 `b299503d45405ecbc3b5a9b324751f71d5f0cd182179f33867b5c25d2121cde5`
- Replaces: no listing image (text card; the event's `autumn-neighbors` key is an AI illustration that listings hide)
- Caption: 2026 年 Top of the Hill Festival 官方宣传图（海报）；演出阵容、时间与活动项目以市府官方页面最新公告为准。

### 12. `san-bruno-dia-de-los-muertos-2026`

- Event: 免费 Día de los Muertos 家庭庆典 (San Bruno, 2026-10-17)
- Official page (`creditUrl`, `rights.evidenceUrl`): <https://sanbruno.ca.gov/Calendar.aspx?EID=5584&calType=0&day=17&month=10&year=2026>
- Image URL (`originalUrl`): <https://sanbruno.ca.gov/ImageRepository/Document?documentID=9369>
- Type: poster, `fullFrame` (never cropped)
- Rights: `promo-editorial`, scope "same-event coverage only". Site note: City of San Bruno flyer.
- Retrieved: 2026-10-08T10:03:24-07:00. Original: 1999 × 1545 PNG, 787,288 bytes, SHA-256 `056e0f00e2b777cc7d971cd5d8543741d54e2fefeff592466cc0f8be65a21699`
- Renditions: `/guides/official-events/san-bruno-dia-de-los-muertos-2026.webp` 1280 × 989, 191,506 bytes, SHA-256 `fa857df5877f95a335473ce2d76000a9ad632c769c403177885e2d99dcfdea76`; `-small` 480 × 371, 47,044 bytes, SHA-256 `58e12a092daa4e47f0ef26b7fc6d810ed41ba73227ab24c89d68ce8c03c4c5cb`
- Replaces: no listing image (text card; the event's `everyday` key is an AI illustration that listings hide)
- Caption: 2026 年 San Bruno 亡灵节家庭庆典的官方宣传图（双语海报）；节目与雨天安排以市府活动页为准。

### 13. `sf-filbookfest-2026`

- Event: Filipino American International Book Festival in San Francisco (San Francisco, 2026-10-17 to 2026-10-18)
- Official page (`creditUrl`, `rights.evidenceUrl`): <https://sfpl.org/events/2026/10/17/celebration-filipino-american-international-book-festival>
- Image URL (`originalUrl`): <https://sfpl.org/sites/default/files/2026-08/31733.png>
- Type: key-art, `fullFrame` (never cropped)
- Rights: `promo-editorial`, scope "same-event coverage only". Site note: SFPL press room offers library graphics; © SFPL / festival.
- Retrieved: 2026-10-08T10:03:26-07:00. Original: 1440 × 720 PNG, 558,698 bytes, SHA-256 `60a42fdccd3fad51dac94f67f02512fa277e9125e98205caffaecd1767d94313`
- Renditions: `/guides/official-events/sf-filbookfest-2026.webp` 1280 × 640, 55,444 bytes, SHA-256 `2e79f36f95e49a9339b103dafb2f2586d8a5426e0c47d5ab37ec21a4b14ecd50`; `-small` 480 × 240, 14,640 bytes, SHA-256 `7e3249eb1960668f95d8bd67576da516ce7d09616173d2524bfc69b0be6a0edb`
- Replaces: `verified-sf-main-library`, 资料图 · 2013 (SparkFun Electronics · CC BY 2.0)
- Caption: 第 8 届菲律宾裔国际书展的官方宣传图（主视觉，来自旧金山公共图书馆活动页）；不是书展现场照片，讲座与签书安排以官方日程为准。

### 14. `el-cerrito-harding-carnival-2026`

- Event: El Cerrito Harding community carnival (El Cerrito, 2026-10-18)
- Official page (`creditUrl`, `rights.evidenceUrl`): <https://www.hardingpta.org/carnival/>
- Image URL (`originalUrl`): <https://www.hardingpta.org/wp-content/uploads/2026/08/SAVE-THE-DATE-AND-VOLUNTEERS-1.jpg>
- Type: poster, `fullFrame` (never cropped)
- Rights: `promo-editorial`, scope "same-event coverage only". Site note: © Harding Elementary PTA.
- Retrieved: 2026-10-08T10:05:38-07:00. Original: 1728 × 2304 JPEG, 460,186 bytes, SHA-256 `8557145f4e5c058df74a5e400b03cff59bc592c14a366c998de05b16b5d33b1d`
- Renditions: `/guides/official-events/el-cerrito-harding-carnival-2026.webp` 1280 × 1707, 181,948 bytes, SHA-256 `6f2a9eb0e4a486720f68bc84b2751b13a860c6af17cab03f6465f28c8e06f335`; `-small` 480 × 640, 57,484 bytes, SHA-256 `74fef483c74bf5c4f0bb58b8e4fa3a14458574f8e6b97fa8103b020cd25e2289`
- Replaces: no listing image (text card; the event's `weekend` key is an AI illustration that listings hide)
- Caption: Harding Carnival 的官方宣传图（“Save the Date”海报）；收费、游戏与南瓜园等项目以 PTA 官方页面为准。

### 15. `mcm-food-sense-20261017`

- Event: Copperfield's Food Sense: Free Author Reading (Larkspur, 2026-10-17)
- Official page (`creditUrl`, `rights.evidenceUrl`): <https://marincountrymart.com/events/read-it-amp-eat-it-food-sense-with-dr-christopher-gardner>
- Image URL (`originalUrl`): <http://static1.squarespace.com/static/5cf7fa4ee0c75a0001f65816/5cf801e9f414a70001ce78f5/6ab694f08bf43f71e42e0b24/1790350776399/Gardner+tile.png?format=1500w> (served from <https://images.squarespace-cdn.com/content/5cf7fa4ee0c75a0001f65816/1790350766156-1ZYM7RCKX1QRDPYDMX9X/Gardner+tile.png?content-type=image%2Fpng>)
- Type: poster, `fullFrame` (never cropped)
- Rights: `promo-editorial`, scope "same-event coverage only". Site note: Copperfield’s/Marin Country Mart promo tile; author photo inside.
- Retrieved: 2026-10-08T10:03:27-07:00. Original: 1254 × 1254 WebP, 1,315,802 bytes, SHA-256 `76e1c990e54c911ba66d1b108d493942deaa21620db1062ee34a6bea12178793`
- Renditions: `/guides/official-events/mcm-food-sense-20261017.webp` 1254 × 1254, 124,514 bytes, SHA-256 `0021648339ea0fad33f15f790ee8cd18de8572dcbc9b97c3f61712cab5710867`; `-small` 480 × 480, 35,152 bytes, SHA-256 `472f0549abdcc34edddf3251f188c110c384786f3afe62e06581eeaeb48bcdab`
- Replaces: no listing image (text card; the event's `weekend` key is an AI illustration that listings hide)
- Caption: Copperfield’s Books 作者活动的官方宣传图（Marin Country Mart 活动页）；登记与名额以官方页面为准。

### 16. `lafayette-res-run-2026`

- Event: Lafayette Res Run Fall Community Run (Lafayette, 2026-10-18)
- Official page (`creditUrl`, `rights.evidenceUrl`): <https://lafayettechamber.org/resrun/>
- Image URL (`originalUrl`): <https://lafayettechamber.org/wp-content/uploads/Res-Run-Poster-2026.png>
- Type: poster, `fullFrame` (never cropped)
- Rights: `promo-editorial`, scope "same-event coverage only". Site note: Lafayette Chamber.
- Retrieved: 2026-10-08T10:05:27-07:00. Original: 800 × 1200 PNG, 397,284 bytes, SHA-256 `168769271f9c606365a527951009b7369b508c0ca347b0b87c953f8ad42a1a43`
- Renditions: `/guides/official-events/lafayette-res-run-2026.webp` 800 × 1200, 101,626 bytes, SHA-256 `391ef8a3418e5ba59e3aa620adb11e825e5e8a06979c459b87d1f0775c501784`; `-small` 480 × 720, 51,580 bytes, SHA-256 `e77cc4f1e1e8736f5251afce5e9ea51c446d8f34a58fdf2a9bae77fea84c533f`
- Replaces: no listing image (text card; the event's `weekend` key is an AI illustration that listings hide)
- Caption: 2026 年 Lafayette Res Run 的官方宣传图（海报）；各组别时间与报名费用以商会官方页面为准。

### 17. `sausalito-goblin-jamboree-2026`

- Event: Sausalito Goblin Jamboree: Halloween Play at the Discovery Museum (Sausalito, 2026-10-03 to 2026-10-31)
- Official page (`creditUrl`, `rights.evidenceUrl`): <https://bayareadiscoverymuseum.org/events/goblin-jamboree/>
- Image URL (`originalUrl`): <https://bayareadiscoverymuseum.org/wp-content/uploads/2026/07/GoblinSpooktacular2.webp>
- Type: photo, focal 50% / 45%
- Rights: `promo-editorial`, scope "same-event coverage only". Site note: Footer "All Rights Reserved".
- Retrieved: 2026-10-08T10:03:29-07:00. Original: 2560 × 1709 WebP, 1,753,880 bytes, SHA-256 `1c84a018c0f7e70d71663c433d6c6b2bf2e96c3b4d048cc41dbdb1707f7542cc`
- Renditions: `/guides/official-events/sausalito-goblin-jamboree-2026.webp` 1280 × 854, 188,062 bytes, SHA-256 `a6e08a5d247822113459abb7603335c1a97d0716da65935784e997f0078079b4`; `-small` 480 × 320, 31,778 bytes, SHA-256 `1e18ffc08c374b402d32e62913cf3a89be7015845cbd37406389f3d9832a3976`. dropped embedded sRGB IEC61966-2.1 profile
- Replaces: no listing image (text card; the event's `family-workshop` key is an AI illustration that listings hide)
- Caption: Bay Area Discovery Museum 往届万圣节活动的活动官方照片（2026 年 7 月发布于活动页）；不是 2026 年 Goblin Jamboree 现场，开放日期与票务以官方页面为准。

### 18. `danville-scarecrow-stroll-2026`

- Event: Danville Scarecrow Stroll (Danville, 2026-10-01 to 2026-11-01)
- Official page (`creditUrl`, `rights.evidenceUrl`): <https://danville.ca.gov/851/Scarecrow-Stroll>
- Image URL (`originalUrl`): <https://danville.ca.gov/ImageRepository/Document?documentId=13395>
- Type: graphic, `fullFrame` (never cropped)
- Rights: `promo-editorial`, scope "same-event coverage only". Site note: Town of Danville.
- Retrieved: 2026-10-08T10:03:29-07:00. Original: 1605 × 804 PNG, 1,955,160 bytes, SHA-256 `ee63b9513367bf818c7f459cea30b67d3319c7c8d1d26a6b4a77abe92ae1024c`
- Renditions: `/guides/official-events/danville-scarecrow-stroll-2026.webp` 1280 × 641, 124,900 bytes, SHA-256 `55322c34618759619e13fb719ed26be389ade93d26082f87771c37b5eb902589`; `-small` 480 × 240, 28,860 bytes, SHA-256 `e6ecfbc6a51d7ed79cc23d41b2a1d04d37e4f673eaea0fbcd70789a6f6647d3c`. dropped embedded sRGB IEC61966-2.1 profile
- Replaces: no listing image (text card; the event's `weekend` key is an AI illustration that listings hide)
- Caption: Danville 镇 Scarecrow Stroll 的官方宣传图（横幅）；图中稻草人只是宣传照片，不代表街区实际展出的作品。

### 19. `livermore-great-elephant-migration-2026`

- Event: Livermore Great Elephant Migration Public Art Exhibition (Livermore, 2026-10-10 to 2026-12-06)
- Official page (`creditUrl`, `rights.evidenceUrl`): <https://www.333arts.org/gem>
- Image URL (`originalUrl`): <https://images.squarespace-cdn.com/content/v1/5fb804341935362b3f7ec9da/cb1f3878-9d4c-40d6-83ef-be5a212c6f1c/Side+Profile+Elephant.JPG?format=2500w>
- Type: photo, focal 55% / 40%
- Rights: `promo-editorial`, scope "same-event coverage only". Site note: © Three Thirty Three Arts; page says "courtesy of".
- Retrieved: 2026-10-08T10:03:31-07:00. Original: 2500 × 1667 WebP, 526,702 bytes, SHA-256 `b2dcf41d06169ad7c677d6604526167842b8643d24300eccee55c816995e6c26`
- Renditions: `/guides/official-events/livermore-great-elephant-migration-2026.webp` 1280 × 854, 155,690 bytes, SHA-256 `fb3e66ddb259fbe05d517453a2322ace04715b35c8a867c5d8b215ad2e0efdf2`; `-small` 480 × 320, 25,384 bytes, SHA-256 `ea51468dcd4882a5a3d419e6a3cfef2efa891b175513f3469ad4a2f0486c8d59`. converted embedded Display P3 profile to sRGB (appearance-preserving)
- Replaces: no listing image (text card; the event's `weekend` key is an AI illustration that listings hide)
- Caption: 大象迁徙（The Great Elephant Migration）巡展中一头编织大象的官方宣传图（照片）；拍摄地点与年份未注明，背景不是 Livermore 展场，也不代表本地展出的布置。

### 20. `ferry-plaza-farmers-market-2026-autumn`

- Event: Ferry Plaza Farmers Market: A Waterfront Stroll (San Francisco, 2026-09-26 to 2026-10-31)
- Official page (`creditUrl`, `rights.evidenceUrl`): <https://foodwise.org/markets/ferry-plaza-farmers-market/>
- Image URL (`originalUrl`): <https://foodwise.org/wp-content/uploads/2009/05/Acme_fpfm_2022.jpg>
- Type: photo, focal 50% / 40%
- Rights: `promo-editorial`, scope "same-event coverage only". Site note: Foodwise press page: offers "high-quality photos of our farmers markets" to press on request.
- Retrieved: 2026-10-08T10:03:31-07:00. Original: 1500 × 1001 JPEG, 1,086,377 bytes, SHA-256 `80cd485504458038e90f24f6c81098892f055c8b3b286abd4ac17d9c82e20518`
- Renditions: `/guides/official-events/ferry-plaza-farmers-market-2026-autumn.webp` 1280 × 854, 172,564 bytes, SHA-256 `e0a8b52847a4ff237eb28bb3fb24000f73adc07aadbbffd348c6f2ecd709b72e`; `-small` 480 × 320, 34,710 bytes, SHA-256 `2e7f6d23670f8c42e6aab2ac8c9a61b601ac5e758ec5b0a78a2fe6b41dcfcffe`
- Replaces: `verified-ferry-building`, 资料图 · 2022 (Suiren2022 · CC BY-SA 4.0)
- Caption: 2022 年 Ferry Plaza 农夫市集 Acme Bread 摊位的活动官方照片（Foodwise 市集页面）；不是 2026 年秋季市集现场，摊位与营业时间以官方页面为准。

### 21. `san-mateo-boos-brews-2026`

- Event: Boos and Brews on B Street in San Mateo (San Mateo, 2026-10-24)
- Official page (`creditUrl`, `rights.evidenceUrl`): <https://www.cityofsanmateo.org/4740/Boos-and-Brews-on-B-Street>
- Image URL (`originalUrl`): <https://www.cityofsanmateo.org/ImageRepository/Document?documentID=98771>
- Type: photo, focal 50% / 70%
- Rights: `promo-editorial`, scope "same-event coverage only". Site note: City of San Mateo.
- Retrieved: 2026-10-08T10:03:32-07:00. Original: 1950 × 1950 JPEG, 642,617 bytes, SHA-256 `1790978bc7b883b37ae9c5aae02047e357f54e1916591f48b22e2aefc77fc273`
- Renditions: `/guides/official-events/san-mateo-boos-brews-2026.webp` 1280 × 1280, 268,860 bytes, SHA-256 `8b8823f1f3a24cd8f93d35d60dd85b7482033e9fb068777aeb16fdcf8e91beff`; `-small` 480 × 480, 47,024 bytes, SHA-256 `9a819ffe7dc05f487727c218dc6f587fd725e1ac0ae1a08201a04bff02d3e4ae`
- Replaces: `verified-san-mateo-b-street`, 资料图 · 2023 (FASTILY · CC BY-SA 4.0)
- Caption: 往届 B Street 万圣节活动的活动官方照片（市府活动页，拍摄年份未注明）；不是 2026 年现场，封街范围、摊位与时间以官方页面为准。

### 22. `sf-thrive-thrill-o-ween-2026`

- Event: Thrive City's free family Halloween celebration (San Francisco, 2026-10-24)
- Official page (`creditUrl`, `rights.evidenceUrl`): <https://www.chasecenter.com/events/thrill-o-ween-20261024/>
- Image URL (`originalUrl`): <https://cdn.nba.com/teams/uploads/sites/1610612744/2026/08/TC_BM_20261024_Thrill_O_Ween_DIGITAL_Generic_1005x600.jpg>
- Type: key-art, `fullFrame` (never cropped)
- Rights: `promo-editorial`, scope "same-event coverage only". Site note: Chase Center / Warriors asset.
- Retrieved: 2026-10-08T10:05:28-07:00. Original: 1005 × 600 JPEG, 176,018 bytes, SHA-256 `3cb1372b6846feaf697ddf9cb10cebe29566a2ad4f811d45eb7ef3971fe40274`
- Renditions: `/guides/official-events/sf-thrive-thrill-o-ween-2026.webp` 1005 × 600, 70,406 bytes, SHA-256 `fbe305e42cbbec52c8187e5b4260a40a9b1fdca6fb331af2892188ad74594ba2`; `-small` 480 × 287, 23,380 bytes, SHA-256 `c3a0c5cd8f971a639c633986c3165b0dc4e642746231b127c84dd233264b2f29`. converted embedded c2 profile to sRGB (appearance-preserving)
- Replaces: no listing image (text card; the event's `weekend` key is an AI illustration that listings hide)
- Caption: Thrive City Thrill-O-Ween 的官方宣传图（Chase Center 活动页）；图中装扮人物是宣传照，不代表当天的表演或活动内容。

### 23. `oakland-omca-dia-muertos-2026`

- Event: OMCA 亡灵节社区庆典：祭坛、音乐与创作 (Oakland, 2026-10-25)
- Official page (`creditUrl`, `rights.evidenceUrl`): <https://museumca.org/press/omca-announces-public-programs-and-events-for-october-2026/>
- Image URL (`originalUrl`): <https://museumca.org/wp-content/uploads/2026/09/DSCF3302-scaled.jpg>
- Type: photo, focal 60% / 50%
- Rights: `promo-editorial`, scope "same-event coverage only". Site note: OMCA press room / press kit links on page.
- Retrieved: 2026-10-08T10:03:34-07:00. Original: 2560 × 1707 JPEG, 521,893 bytes, SHA-256 `e9a924006045b184458ae8fbae4626173124e39f5ba1a61cc2ed909af80e2083`
- Renditions: `/guides/official-events/oakland-omca-dia-muertos-2026.webp` 1280 × 854, 132,622 bytes, SHA-256 `1cad0e3e694de77d08323bbd4f7d4fe45014e08b6f27d2e7d3d010eb3a008295`; `-small` 480 × 320, 27,602 bytes, SHA-256 `c26e65d327e6d356f75b8f772cee76cc3a54edac004039422d63e6929a73f045`
- Replaces: `region-omca`, 资料图 · 2012 (mk30 from usa · CC BY 2.0 · 已缩放压缩)
- Caption: OMCA 户外演出现场的活动官方照片（随 2026 年 10 月公共活动新闻稿发布，拍摄时间未注明）；不是 2026 年亡灵节庆典现场，节目以官方安排为准。

### 24. `sf-world-of-dumplings-2026`

- Event: World of Dumplings at San Francisco’s Ferry Building (San Francisco, 2026-10-25)
- Official page (`creditUrl`, `rights.evidenceUrl`): <https://www.eventbrite.com/e/world-of-dumplings-2026-tickets-1997773482264>
- Image URL (`originalUrl`): <https://img.evbuc.com/https%3A%2F%2Fcdn.evbuc.com%2Fimages%2F1191270375%2F967567983623%2F1%2Foriginal.20260817-185605?w=940&auto=format%2Ccompress&q=75&sharp=10&s=1912989b447545970e3b0b62ac516dd8>
- Type: key-art, `fullFrame` (never cropped)
- Rights: `promo-editorial`, scope "same-event coverage only". Site note: Organizer image on Eventbrite.
- Retrieved: 2026-10-08T10:03:34-07:00. Original: 940 × 470 JPEG, 107,561 bytes, SHA-256 `34ddfb2124827685dcd1956984b2ec873f540d15ee9ad388d14d9284a86f70c9`
- Renditions: `/guides/official-events/sf-world-of-dumplings-2026.webp` 940 × 470, 68,428 bytes, SHA-256 `9a53aa4202a3d6677723875aa206ff6ede8e060a44676f8c417b27085375dd11`; `-small` 480 × 240, 26,278 bytes, SHA-256 `bbac6a27529df5e08729268b15f1910a255c2e41c7219643d0e4b7bbb94723a0`. dropped embedded sRGB profile
- Replaces: `verified-ferry-building`, 资料图 · 2022 (Suiren2022 · CC BY-SA 4.0)
- Caption: 2026 年第 3 届 World of Dumplings 的官方宣传图；摊位与菜品以主办方公布为准。

### 25. `r2-petaluma-lumafest-20261024`

- Event: Petaluma LumaFest: Campus Open House and Dia de los Muertos Celebration (Petaluma, 2026-10-24)
- Official page (`creditUrl`, `rights.evidenceUrl`): <https://lumafest.santarosa.edu/>
- Image URL (`originalUrl`): <https://lumafest.santarosa.edu/sites/lumafest.santarosa.edu/files/inline-images/2025%20Blue%20Zones%20Booth%20Lumafest_160%20%281%29_1.jpg>
- Type: photo, focal 50% / 40%
- Rights: `promo-editorial`, scope "same-event coverage only". Site note: © Santa Rosa Junior College.
- Retrieved: 2026-10-08T10:03:35-07:00. Original: 5866 × 3911 JPEG, 3,298,799 bytes, SHA-256 `5194e028b8b56082907fa9d1120e97941606dc8d3e747e7f5a39762b44c1ba57`
- Renditions: `/guides/official-events/r2-petaluma-lumafest-20261024.webp` 1280 × 853, 214,702 bytes, SHA-256 `5b14b302d4737c50141501cb7a70e286ae2c76a508f53db9582c9f2fb5c420da`; `-small` 480 × 320, 46,140 bytes, SHA-256 `bae77161699b4eece39d9059063f084d697764ac58b9332e9aa1e383b5ce5e68`. dropped embedded sRGB IEC61966-2.1 profile
- Replaces: no listing image (text card; the event's `weekend` key is an AI illustration that listings hide)
- Caption: 2025 年 LumaFest 上 Blue Zones Project Petaluma 摊位的活动官方照片；不是 2026 年活动现场，摊位与节目以官方页面为准。

### 26. `r2-petaluma-cider-circus-2026`

- Event: Petaluma Cider Circus: Cider and Riverside Festivities (Petaluma, 2026-10-24)
- Official page (`creditUrl`, `rights.evidenceUrl`): <https://www.bigwest.biz/cider-circus-petaluma>
- Image URL (`originalUrl`): <https://images.squarespace-cdn.com/content/v1/61f781cf6ebc7779fb5bb957/7fbbd0df-62c3-4ab7-947c-def0d7dcfb1f/MarielleVChua-24.jpg?format=2500w>
- Type: photo, focal 40% / 50%
- Rights: `promo-editorial`, scope "same-event coverage only". Site note: Page credits photographer ("Photos by"); filename MarielleVChua.
- Retrieved: 2026-10-08T10:03:36-07:00. Original: 2500 × 1667 WebP, 409,786 bytes, SHA-256 `1e7fbc90dc021662dd4cfa62a12b664da71a21bba45b12acadc19d08e940540d`
- Renditions: `/guides/official-events/r2-petaluma-cider-circus-2026.webp` 1280 × 854, 122,886 bytes, SHA-256 `90e223948a128b6f491b7f01cc3311a8a1fe645c93dcc788c1fe3eecb92d7e69`; `-small` 480 × 320, 33,632 bytes, SHA-256 `34c398c8f465154b97b1fda4503166b757b2199ef0f6b2d7337b675d64940f3a`. dropped embedded sRGB IEC61966-2.1 profile
- Replaces: no listing image (text card; the event's `weekend` key is an AI illustration that listings hide)
- Caption: 往届 Cider Circus 的活动官方照片：通往各苹果酒酒厂的木制指示牌，拍摄时间未注明；不是 2026 年活动现场，参展酒厂以官方名单为准。

### 27. `sj-symphonic-spooktacular-2026`

- Event: Symphony San Jose Halloween Concert (San Jose, 2026-10-24 to 2026-10-25)
- Official page (`creditUrl`, `rights.evidenceUrl`): <https://www.symphonysanjose.org/attend/2026-2027-season/concerts/symphonic-spooktacular/>
- Image URL (`originalUrl`): <https://www.symphonysanjose.org/wp-content/uploads/2025/02/12.jpg>
- Type: photo, focal 65% / 40%
- Rights: `promo-editorial`, scope "same-event coverage only". Site note: No licence stated.
- Retrieved: 2026-10-08T10:03:37-07:00. Original: 1080 × 1080 JPEG, 76,572 bytes, SHA-256 `810b510c7191934ad0504b5a416f2e4117686acb780902af938613c33a29ccfd`
- Renditions: `/guides/official-events/sj-symphonic-spooktacular-2026.webp` 1080 × 1080, 48,804 bytes, SHA-256 `0762298bb01fbc3bfd9af7db57e89f266dafb4fd11b87ec09435231299a0ddc0`; `-small` 480 × 480, 15,430 bytes, SHA-256 `4f7e24eaa3f8ed7734dacaef68cdaa1f67b145dd6e03359c0b76891b23c08f97`
- Replaces: no listing image (text card; the event's `weekend` key is an AI illustration that listings hide)
- Caption: 往届 Symphonic Spooktacular 音乐会的活动官方照片（乐团网站 2025 年发布）；不是 2026 年演出，曲目与指挥以官方页面为准。

### 28. `san-ramon-howl-o-ween-2026`

- Event: City Center Howl-O-Ween Pet Parade (San Ramon, 2026-10-25)
- Official page (`creditUrl`, `rights.evidenceUrl`): <https://www.bishopranch.com/br-event/howl-o-ween/>
- Image URL (`originalUrl`): <https://www.bishopranch.com/wp-content/uploads/2025/01/howloween-812-x-530-px-1024x683.png>
- Type: photo, focal 42% / 45%
- Rights: `promo-editorial`, scope "same-event coverage only". Site note: Bishop Ranch newsroom exists, no image terms.
- Retrieved: 2026-10-08T10:03:38-07:00. Original: 1024 × 683 PNG, 665,148 bytes, SHA-256 `b77c18dab7e8ae21c569428056565ae5f25421f5edeb9347458f28a124b46f65`
- Renditions: `/guides/official-events/san-ramon-howl-o-ween-2026.webp` 1024 × 683, 30,504 bytes, SHA-256 `fac1d211d3e0dd22220b70949b5de1c062b075b5e8739f4320e99dc9f57292a8`; `-small` 480 × 320, 11,920 bytes, SHA-256 `29de8bf79b08c05f876ff1b5fe2af1d99e79dc68e476144ae8fd93d7e85ba516`
- Replaces: no listing image (text card; the event's `weekend` key is an AI illustration that listings hide)
- Caption: 往届 Howl-O-Ween 宠物装扮活动的活动官方照片（主办方网站 2025 年发布）；不是 2026 年现场，巡游与 The Hub 活动安排以官方页面为准。

### 29. `petaluma-witches-wizards-water-2026`

- Event: Petaluma Witches & Wizards on the Water (Petaluma, 2026-10-24)
- Official page (`creditUrl`, `rights.evidenceUrl`): <https://www.thefloathousepetaluma.org/events/witches-wizards-on-the-water-2026>
- Image URL (`originalUrl`): <http://static1.squarespace.com/static/6302d39abd02437a9e9f0276/6413ba7c01e4e90e119a82fb/6a7d1a329694546b5978c415/1786584452250/Squarespace+event+image+2026+witches+%26+wizards+on+the+water+IG++%281500+x+1000+px%29.png?format=1500w> (served from <https://images.squarespace-cdn.com/content/6302d39abd02437a9e9f0276/1786584319022-IO1JRVF3HCEX2COA1Z5V/Squarespace+event+image+2026+witches+%26+wizards+on+the+water+IG++%281500+x+1000+px%29.png?content-type=image%2Fpng>)
- Type: key-art, `fullFrame` (never cropped)
- Rights: `promo-editorial`, scope "same-event coverage only". Site note: No licence stated.
- Retrieved: 2026-10-08T10:03:40-07:00. Original: 1500 × 1000 WebP, 879,110 bytes, SHA-256 `df5d44b093aeee7d25679d8590c4825ac6548ee2215505059d84262cea2600c7`
- Renditions: `/guides/official-events/petaluma-witches-wizards-water-2026.webp` 1280 × 853, 76,788 bytes, SHA-256 `52d5d3bd9b27ce0fc4a22798e19a14fec7fba9fda2c2564a0b740410eadb6e86`; `-small` 480 × 320, 18,458 bytes, SHA-256 `e2404dc96511012a6d508078e1acb9f290c3ba397f0cf838ec6c06762dee4e8e`
- Replaces: `coverage-petaluma-river`, 资料图 · 2001 (Colin Marquardt / Public domain · 已缩放压缩，卡片可能裁切)
- Caption: The Floathouse 2026 年 Witches & Wizards on the Water 的官方宣传图（黑白照片加 Floathouse 标志），拍摄时间未注明；不是 2026 年活动现场。

### 30. `ameswell-barks-boos-2026`

- Event: Ameswell Barks & Boos: a pet parade, costumes and market (Mountain View, 2026-10-25)
- Official page (`creditUrl`, `rights.evidenceUrl`): <https://www.theameswellhotel.com/experiences/happenings/barks-boos/>
- Image URL (`originalUrl`): <https://www.theameswellhotel.com/wp-content/uploads/2025/08/Barks-Boos.png>
- Type: key-art, `fullFrame` (never cropped)
- Rights: `promo-editorial`, scope "same-event coverage only". Site note: © The Ameswell Hotel; press page exists.
- Retrieved: 2026-10-08T10:05:28-07:00. Original: 2160 × 1080 PNG, 2,138,709 bytes, SHA-256 `cde720d50108f7cf4f92fe94cb51d7e51e6ceab6bc76e014722d872c3f6c31aa`
- Renditions: `/guides/official-events/ameswell-barks-boos-2026.webp` 1280 × 640, 43,012 bytes, SHA-256 `515384ff2295f930632ce601116bbb1b0a2888c0659e6fcc20f6c40147067d89`; `-small` 480 × 240, 12,188 bytes, SHA-256 `c1b121ed3ef69f1a44fdc5fb665b41d1d9e3c0c4aea3bb270e7ca6627bc2572e`
- Replaces: no listing image (text card; the event's `refresh-pets` key is an AI illustration that listings hide)
- Caption: The Ameswell Hotel 活动页的官方宣传图；披床单扮幽灵的狗是棚拍宣传照，不是活动现场。

### 31. `windsor-trick-or-treat-trail-2026`

- Event: Windsor Trick-or-Treat Trail (Windsor, 2026-10-24)
- Official page (`creditUrl`, `rights.evidenceUrl`): <https://www.townofwindsor.com/trickortreat>
- Image URL (`originalUrl`): <https://www.townofwindsor.com/ImageRepository/Document?documentID=32764> (served from <https://www.townofwindsor.ca.gov/ImageRepository/Document?documentID=32764>)
- Type: poster, `fullFrame` (never cropped)
- Rights: `promo-editorial`, scope "same-event coverage only". Site note: Town of Windsor.
- Retrieved: 2026-10-08T10:03:42-07:00. Original: 1545 × 1999 PNG, 1,162,711 bytes, SHA-256 `8778c7bee4b005cef1ca6251946cf012cc631268325a03129609e99eaf27d168`
- Renditions: `/guides/official-events/windsor-trick-or-treat-trail-2026.webp` 1280 × 1656, 205,732 bytes, SHA-256 `955c3b67e41818ea4bd01a6ae4b9d8eae2c52f403a3639fec2a5f2c2e04024b3`; `-small` 480 × 621, 54,638 bytes, SHA-256 `44934598eebfc6412c7e45b3714ab0976397cc804cd6d401223c28bb645ffebe`
- Replaces: no listing image (text card; the event's `garden-walk` key is an AI illustration that listings hide)
- Caption: Windsor 镇 2026 年 Trick or Treat Trail 的官方宣传图（海报）；预约、名额与入场时段以官方页面为准。

### 32. `sfpl-western-addition-open-house-oct24-2026`

- Event: Western Addition Library community open house (San Francisco, 2026-10-24)
- Official page (`creditUrl`, `rights.evidenceUrl`): <https://sfpl.org/events/2026/10/24/celebration-western-addition-open-house>
- Image URL (`originalUrl`): <https://sfpl.org/sites/default/files/2026-08/31464.png>
- Type: graphic, `fullFrame` (never cropped)
- Rights: `promo-editorial`, scope "same-event coverage only". Site note: SFPL press room offers library graphics.
- Retrieved: 2026-10-08T10:03:43-07:00. Original: 4000 × 2666 PNG, 1,087,010 bytes, SHA-256 `5e83b758f27ebdec18f51a8499c4a3f8f89af33da18a5fa92897d60f7ee87daa`
- Renditions: `/guides/official-events/sfpl-western-addition-open-house-oct24-2026.webp` 1280 × 853, 40,060 bytes, SHA-256 `4ed1fba8dc85bfef342559876a840387b5b2187ecaca863ac046a4d5dd6c64c5`; `-small` 480 × 320, 6,826 bytes, SHA-256 `44cc276ca4df84cc93df2f631205c6f2e6038184a8ced0b024c87648893f1136`
- Replaces: no listing image (text card; the event's `autumn-neighbors` key is an AI illustration that listings hide)
- Caption: SFPL 活动页的官方宣传图：Western Addition 分馆外观插画；不是照片，也不是开放日现场。

### 33. `sf-bay-beats-bandshell-oct24-2026`

- Event: Bay Beats Free Concert at the Golden Gate Bandshell (San Francisco, 2026-10-24)
- Official page (`creditUrl`, `rights.evidenceUrl`): <https://illuminate.org/event/bay-beats-at-the-bandshell-october-24/>
- Image URL (`originalUrl`): <https://illuminate.org/wp-content/uploads/2026/08/10.24-Saturday-Show.jpg>
- Type: poster, `fullFrame` (never cropped)
- Rights: `promo-editorial`, scope "same-event coverage only". Site note: Illuminate press page exists, no image terms.
- Retrieved: 2026-10-08T10:03:44-07:00. Original: 1080 × 1350 JPEG, 1,156,969 bytes, SHA-256 `e98c6ff255ef99771a214cc2856124e0bc302a5df2b3d5a264e1287e8b1f95c4`
- Renditions: `/guides/official-events/sf-bay-beats-bandshell-oct24-2026.webp` 1080 × 1350, 501,442 bytes, SHA-256 `cd79595695f3b597b840fb2d54fe88c5e001924beb0143e79402a4e82c4fe5b9`; `-small` 480 × 600, 123,982 bytes, SHA-256 `966501b99f677e2048b2e39f9dce13acfef2b1214a3533f0ba1a9ae85995a13b`. dropped embedded sRGB IEC61966-2.1 profile
- Replaces: no listing image (text card; the event's `autumn-neighbors` key is an AI illustration that listings hide)
- Caption: 第 4 届 Bay Beats Launch Party 的官方宣传图（海报）；演出阵容与时间以官方页面为准。

### 34. `burlingame-downtown-fall-fest-2026`

- Event: Burlingame Downtown Fall Festival and Costume Activities (Burlingame, 2026-10-25)
- Official page (`creditUrl`, `rights.evidenceUrl`): <https://www.burlingamedowntown.org/events/fall-fest-1>
- Image URL (`originalUrl`): <http://static1.squarespace.com/static/5ea65e68b60b5d7939abcb3a/5fa07fba8cf5f440cd07fa25/69b9eff768eac57c37792225/1791333110371/fallfest+2026.jpg?format=1500w> (served from <https://images.squarespace-cdn.com/content/5ea65e68b60b5d7939abcb3a/1791332757777-Y15D67PY5EBV7UULLOCT/fallfest+2026.jpg?content-type=image%2Fjpeg>)
- Type: poster, `fullFrame` (never cropped)
- Rights: `promo-editorial`, scope "same-event coverage only". Site note: Burlingame Downtown.
- Retrieved: 2026-10-08T10:03:44-07:00. Original: 1240 × 829 WebP, 225,262 bytes, SHA-256 `9de125a1840d5c361873b518d4708538777aeb602f878a80f0e6c054e3ca585d`
- Renditions: `/guides/official-events/burlingame-downtown-fall-fest-2026.webp` 1240 × 829, 208,646 bytes, SHA-256 `fff71cb47cd10e91ffa2fb456bbd7d01995e416f40334f941252624c181cee04`; `-small` 480 × 321, 38,324 bytes, SHA-256 `36f7f0ae3476def3d8629be6d13cc6b3a03e6abc4526ed024b987dde547e3499`
- Replaces: no listing image (text card; the event's `weekend` key is an AI illustration that listings hide)
- Caption: 2026 年 Downtown Burlingame Fall Fest 的官方宣传图（传单扫描件）；项目与收费以官方页面为准。

### 35. `fremont-fog-diwali-mela-2026`

- Event: Fremont FOG Diwali Mela: performances and a Festival of Lights market (Fremont, 2026-10-24)
- Official page (`creditUrl`, `rights.evidenceUrl`): <https://fogsv.com/event/fog-diwali/>
- Image URL (`originalUrl`): <https://fogsv.com/wp-content/uploads/2025/09/FogDiwali-2026-flyer.webp>
- Type: poster, `fullFrame` (never cropped)
- Rights: `promo-editorial`, scope "same-event coverage only". Site note: © Festival of Globe.
- Retrieved: 2026-10-08T10:03:45-07:00. Original: 1121 × 1403 WebP, 264,860 bytes, SHA-256 `b913f29e70c07235a9076db6156601a34dfd091ed770ada51411b0dfa9e1554e`
- Renditions: `/guides/official-events/fremont-fog-diwali-mela-2026.webp` 1121 × 1403, 287,864 bytes, SHA-256 `92434cc337cb4f1c133d107239d4a2b08270c53ecdf62be77e5eba7ea6c7c196`; `-small` 480 × 601, 89,228 bytes, SHA-256 `34d5068ca85fc21e777f3cfb49f82cd3f61efb1898a4da7c055659b2e5a01571`. dropped embedded sRGB profile
- Replaces: no listing image (text card; the event's `autumn-neighbors` key is an AI illustration that listings hide)
- Caption: 2026 年 FOG Diwali Mela 的官方宣传图（海报）；票价、节目与时间以主办方页面为准。

### 36. `napa-tulocay-heritage-halloween-tour-2026`

- Event: Napa Tulocay: Heritage Halloween walking tour (Napa, 2026-10-24)
- Official page (`creditUrl`, `rights.evidenceUrl`): <https://donapa.com/event/heritage-halloween-tulocay-cemetery-tour/>
- Image URL (`originalUrl`): <https://donapa.com/wp-content/uploads/2026/09/Spooktacular-2026.png>
- Type: collage, `fullFrame` (never cropped)
- Rights: `promo-editorial`, scope "same-event coverage only". Site note: Downtown Napa press room (photos via Dropbox).
- Retrieved: 2026-10-08T10:03:46-07:00. Original: 1920 × 1080 PNG, 4,736,959 bytes, SHA-256 `3e7b963754f7cc3423e2ac6342d7eaafbfdc2f87765b84a1005af44100eb0a95`
- Renditions: `/guides/official-events/napa-tulocay-heritage-halloween-tour-2026.webp` 1280 × 720, 192,772 bytes, SHA-256 `46055e0583ff4d8989df98bfc745d57abd8d0cd1de298ea4a79d9acad0e3d19c`; `-small` 480 × 270, 35,116 bytes, SHA-256 `0505a20f41e39ca5cc2a482f964531066011f3e177deee799bbbfdc885e41c57`
- Replaces: no listing image (text card; the event's `culture-visit` key is an AI illustration that listings hide)
- Caption: Heritage Halloween 墓园导览的官方宣传图，椭圆小图是往届讲解员扮演历史人物的照片；不是 2026 年导览现场，票务以官方页面为准。

### 37. `san-jose-avenida-altares-2026`

- Event: San José Avenida de Altares 亡灵节文化夜 (San Jose, 2026-10-31)
- Official page (`creditUrl`, `rights.evidenceUrl`): <https://mhplaza.org/allevents/avenida26>
- Image URL (`originalUrl`): <http://static1.squarespace.com/static/5c70f584797f74142d45f7cf/5c8bde1b419202e381dfb582/6a920245f065842e80cdad31/1790375168802/1920x1080_VISITSANJOSE_AVENIDA26.png?format=1500w> (served from <https://images.squarespace-cdn.com/content/5c70f584797f74142d45f7cf/1790375136617-D1229PXGPRSWSGKAHQ0M/1920x1080_VISITSANJOSE_AVENIDA26.png?content-type=image%2Fpng>)
- Type: graphic, `fullFrame` (never cropped)
- Rights: `promo-editorial`, scope "same-event coverage only". Site note: Page mentions a "Media Kit".
- Retrieved: 2026-10-08T10:05:29-07:00. Original: 1920 × 1080 PNG, 1,683,304 bytes, SHA-256 `7a34c38765e0fba15b0c7a50913a6f521dcaf300d272ecd051313b84d84461e8`
- Renditions: `/guides/official-events/san-jose-avenida-altares-2026.webp` 1280 × 720, 122,524 bytes, SHA-256 `e2cc4f4bcceb106bf509ce4c99b8e25911305fa76d5c3d7e0279a6143fabfce7`; `-small` 480 × 270, 24,220 bytes, SHA-256 `058dac8574aa5be6c1cf1e4916e4ee34bd02a4726fb51a52497dd6becef75368`
- Replaces: no listing image (text card; the event's `autumn-neighbors` key is an AI illustration that listings hide)
- Caption: 2026 年 Avenida de Altares 的官方宣传图；摊位与节目以官方页面为准。

### 38. `sf-halloween-hoopla-2026`

- Event: San Francisco Halloween Hoopla (San Francisco, 2026-10-31)
- Official page (`creditUrl`, `rights.evidenceUrl`): <https://ybgfestival.org/event/halloween-hoopla-2026/>
- Image URL (`originalUrl`): <https://ybgfestival.org/wp-content/uploads/2024/03/110224_HalloweenHoopla_web_1.jpg>
- Type: photo, focal 50% / 55%
- Rights: `promo-editorial`, scope "same-event coverage only". Site note: YBG Festival; "All Rights Reserved".
- Retrieved: 2026-10-08T10:05:39-07:00. Original: 1200 × 630 JPEG, 986,576 bytes, SHA-256 `a185ddf288f7e4b16edc1a6834455f304976829b73112ab90f1cf53e1793f2d0`
- Renditions: `/guides/official-events/sf-halloween-hoopla-2026.webp` 1200 × 630, 222,172 bytes, SHA-256 `b8dcb1c0708ac38d22c094a9564a80fe0bcdca76df8823316972d09c3935b6db`; `-small` 480 × 252, 46,590 bytes, SHA-256 `84bbfd452f89871a47e8cd45fe399b8499a79de9a25ff76972bcc6935e875fcf`
- Replaces: `verified-yerba-buena-gardens`, 资料图 · 2023 (The wub / CC BY-SA 4.0 · 已缩放压缩，卡片可能裁切)
- Caption: 往届 Halloween Hoopla 在 Yerba Buena Gardens 的活动官方照片（主办方网站 2024 年发布）；不是 2026 年现场，游行与活动容量以官方页面为准。

### 39. `mcm-halloween-spectacular-20261031`

- Event: Marin Country Mart Halloween Costumes and Trick-or-Treating (Larkspur, 2026-10-31)
- Official page (`creditUrl`, `rights.evidenceUrl`): <https://marincountrymart.com/events/0zog7elnls9d0aljsi62915xu1zww4>
- Image URL (`originalUrl`): <http://static1.squarespace.com/static/5cf7fa4ee0c75a0001f65816/5cf801e9f414a70001ce78f5/6ab0114e7145c80cbcdd5c93/1789923743578/MCM_HalloweenSpectacular_Digital_2026_Web+Square+.png?format=1500w> (served from <https://images.squarespace-cdn.com/content/5cf7fa4ee0c75a0001f65816/1789923695831-QREW1MKCZK8U3K1HVCTO/MCM_HalloweenSpectacular_Digital_2026_Web+Square+.png?content-type=image%2Fpng>)
- Type: graphic, `fullFrame` (never cropped)
- Rights: `promo-editorial`, scope "same-event coverage only". Site note: Marin Country Mart.
- Retrieved: 2026-10-08T10:03:49-07:00. Original: 1600 × 1600 WebP, 54,270 bytes, SHA-256 `f78239069165f059afe82a3c0e5e1ce0a7fc18c6107e311983b44859444d81fc`
- Renditions: `/guides/official-events/mcm-halloween-spectacular-20261031.webp` 1280 × 1280, 60,812 bytes, SHA-256 `b1a642fd6ae4237ef495167ab2252fe6a20a9aa42d9d9a2de6f1af4ccf171388`; `-small` 480 × 480, 21,436 bytes, SHA-256 `d708ed1566e269d0d4ab29d7a67d1775cce6035071b95c6b872087a8ff2e2bb0`
- Replaces: no listing image (text card; the event's `weekend` key is an AI illustration that listings hide)
- Caption: Marin Country Mart 2026 年万圣节活动的官方宣传图（插画）；不是活动现场照片。

### 40. `nov2026-presidio-dia-muertos-diwali`

- Event: Presidio：亡灵节与排灯节文化庆典 (San Francisco, 2026-11-07)
- Official page (`creditUrl`, `rights.evidenceUrl`): <https://presidio.gov/explore/events/dia-de-los-muertos-and-diwali-festival>
- Image URL (`originalUrl`): <https://wp.presidio.gov/wp-content/uploads/2025/09/PRSF_20221105_NJo_068.jpg>
- Type: photo, focal 50% / 40%
- Rights: `promo-editorial`, scope "same-event coverage only". Site note: Presidio Trust (not a federal PD work; check per image). Press page exists.
- Retrieved: 2026-10-08T10:05:30-07:00. Original: 2000 × 1333 JPEG, 1,865,875 bytes, SHA-256 `7ece332ce87adb8cf8f660ef966d9f0bcf637f1544bfc99ed337496e29d3eb60`
- Renditions: `/guides/official-events/nov2026-presidio-dia-muertos-diwali.webp` 1280 × 853, 150,190 bytes, SHA-256 `3b8448a3b2b245b62107a534715f1a3bec405b84bc60cb0cb92909ae22fd67c8`; `-small` 480 × 320, 36,808 bytes, SHA-256 `45058ed0f63a722da34e6d878835a6f4a0fd302773e77176f3b786510f809721`. dropped embedded sRGB IEC61966-2.1 profile
- Replaces: `presidio`, 资料图 · 2023 (Frank Schulenburg · CC BY-SA 4.0 · 已缩放压缩，卡片裁切)
- Caption: 2022 年 11 月 Presidio 活动中的亡灵节祭坛，活动官方照片（Presidio Trust 活动页）；不是 2026 年庆典现场，节目以官方安排为准。

### 41. `nov2026-presidio-free-yoga`

- Event: Free Presidio meadow yoga: reserve a place first (San Francisco, 2026-11-01 to 2026-11-22)
- Official page (`creditUrl`, `rights.evidenceUrl`): <https://presidio.gov/explore/events/free-yoga-in-the-park/2026-11-22/>
- Image URL (`originalUrl`): <https://wp.presidio.gov/wp-content/uploads/2026/08/20260812_Wellness_Yoga_Outpost_Meadow_3.jpg>
- Type: photo, focal 50% / 55%
- Rights: `promo-editorial`, scope "same-event coverage only". Site note: Presidio Trust.
- Retrieved: 2026-10-08T10:05:31-07:00. Original: 5908 × 3939 JPEG, 4,592,922 bytes, SHA-256 `7bbbdc19ee764f5eb7c35e7e94dcd5e8e50be80ac6da6b1f51a557b5f5313e80`
- Renditions: `/guides/official-events/nov2026-presidio-free-yoga.webp` 1280 × 853, 190,038 bytes, SHA-256 `1e34dc0816afcc00a953a31ebd12f63122121c5399ab1604613a1c09a9b9fc3e`; `-small` 480 × 320, 23,626 bytes, SHA-256 `39fc1fb52bbb63d4f9aa34298c6c39b81671b17033204e26a8ff4660deb1f7a5`
- Replaces: `octnov-presidio-context`, 资料图 · 2023 (Frank Schulenburg · CC BY-SA 4.0 · 已缩放压缩，卡片裁切)
- Caption: 2026 年 8 月 Outpost Meadow 瑜伽的活动官方照片（Presidio Trust，文件名日期 2026-08-12）；不是 11 月课程现场，预约与名额以官方页面为准。

### 42. `filoli-holidays-from-nov14-2026`

- Event: Holidays at Filoli begins: choose daytime or evening lights (Woodside, 2026-11-14 to 2027-01-10)
- Official page (`creditUrl`, `rights.evidenceUrl`): <https://filoli.org/holidays>
- Image URL (`originalUrl`): <https://filoli.org/media/xbcltkxd/filoli-holiday-lights-inmenlo-11-20-2022-0194-6.jpg>
- Type: photo, focal 55% / 55%
- Rights: `promo-editorial`, scope "same-event coverage only". Site note: Filoli press page: "download press releases and media images".
- Retrieved: 2026-10-08T10:03:55-07:00. Original: 6000 × 4000 JPEG, 4,376,411 bytes, SHA-256 `0ce17194b3c39e5b67de8b8e43a0a8597a488182229970b336244cdae14838ae`
- Renditions: `/guides/official-events/filoli-holidays-from-nov14-2026.webp` 1280 × 853, 292,974 bytes, SHA-256 `de6e77890f343fb87671e055be2406aa78fe4eb616c040a1f0c1899e478129ea`; `-small` 480 × 320, 55,856 bytes, SHA-256 `ad0e4d3d13aab0d958ec2f67f24f340b0844448ee5663847488b22c896b89810`. dropped embedded sRGB2014 profile
- Replaces: `region-filoli-house`, 资料图 · 2020 (Laurent Le Gourrierec · CC BY-SA 4.0 · 已缩放压缩)
- Caption: 2022 年 11 月 Filoli 节日灯饰的活动官方照片；不是 2026 年节日季现场，灯饰布置与票务以官方页面为准。

### 43. `octnov-pyt-wizard-oz-2026`

- Event: The Wizard of Oz: family theater in Mountain View (Mountain View, 2026-11-14 to 2026-11-22)
- Official page (`creditUrl`, `rights.evidenceUrl`): <https://pytnet.org/shows/the-wizard-of-oz/>
- Image URL (`originalUrl`): <https://pytnet.org/uploads/wizard.jpg>
- Type: poster, `fullFrame` (never cropped)
- Rights: `promo-editorial`, scope "same-event coverage only". Site note: Peninsula Youth Theatre.
- Retrieved: 2026-10-08T10:03:57-07:00. Original: 1080 × 1350 JPEG, 205,100 bytes, SHA-256 `4f22c1eeb8a38735195089e35b49ef7371c63f52c445ac226baca57becf751df`
- Renditions: `/guides/official-events/octnov-pyt-wizard-oz-2026.webp` 1080 × 1350, 122,462 bytes, SHA-256 `159f519ee8f599cc066c473cb9614b2c9aac9b06244b53edda6a320680644dbc`; `-small` 480 × 600, 48,144 bytes, SHA-256 `6117696a323b5a605a9e382119d68e513037a2438b26c589f2e8e30387b73ec1`
- Replaces: `octnov-mv-performing-arts-context`, 资料图 · 2009 (Aleh Haiko / CC BY-SA 3.0 · 已缩放压缩，保留原许可)
- Caption: Peninsula Youth Theatre 2026 年《绿野仙踪》的官方宣传图（海报）；演出场次与票务以官方页面为准。

## Approved but not shipped

- `half-moon-bay-pumpkin-festival-2026`: downloaded 2026-10-08T10:03:12-07:00 from <https://hmbpumpkinfest.com/images/media/2022-pumpkin-festival-parade-HMB-Marching-Band.jpg> (109,439 bytes, SHA-256 `d293c42bd340aa571be2289c685ff38a4bba31e68298429b50a658fe1df90ade`; rights basis would be `press-kit`, <https://hmbpumpkinfest.com/media-press-kit.html>). The event already shows a 2025 photo of this festival's parade (MegalithAgency, CC BY 4.0, 1400 px). The press-kit photo is from 2022 and 800 px, so it is older and smaller; kept out of the repo.

## Approved but not downloaded

These URLs refused the download. They were not retried with a different client or headers to get past a block, and no other image was substituted. Eight city sites answered HTTP 403 with an "Access Denied" page, one gallery site answered with a Cloudflare challenge page, and the Exploratorium reset the connection on all three attempts. If the owner wants them, he can save them by hand from a browser and a later batch can process them the same way.

| Event | Image URL | Result (2026-10-08) |
| --- | --- | --- |
| `cupertino-diwali-festival-2026` | <https://www.cupertino.gov/files/assets/city/v/1/parks-and-recreation/images/events/co-sponsored-festivals/festival_page_icons_diwali.png?w=1200> | HTTP 403 "Access Denied" HTML page |
| `menlo-hana-baba-folktales-2026` | <https://www.menlopark.gov/files/sharedassets/public/v/1/library-and-community-services/images/2026-11th-annual-storytelling-festival-v220260904-1600-x-900.jpg?w=1200> | HTTP 403 "Access Denied" HTML page |
| `palo-alto-pet-palooza-oct17-2026` | <https://www.paloalto.gov/files/assets/public/v/1/community-services/special-events/pet-palooza-parade-2026.png?w=1200> | HTTP 403 "Access Denied" HTML page |
| `r2-vallejo-wonder-sundays-2026` | <https://mareislandartstudios.com/wp-content/uploads/2026/08/step-into-wonder-poster-05.png> | HTTP 403, Cloudflare "Just a moment..." challenge page |
| `menlo-park-halloween-hoopla-2026` | <https://www.menlopark.gov/files/sharedassets/public/v/1/library-and-community-services/images/events/mp-mascot-nutty_community-members.jpg?w=1200> | HTTP 403 "Access Denied" HTML page |
| `sf-exploratorium-family-science-oct24-2026` | <https://www.exploratorium.edu/sites/default/files/styles/social_event/public/2026-09/Altar-Inprocess-exp00384_25ITH-pod_1.jpg?h=854a7be2&itok=ZWrnooYH> | Connection reset by the server while reading the body, three times (a header-only GET answered 200 image/jpeg) |
| `belmont-centennial-fest-2026` | <https://www.belmont.gov/home/showpublishedimage/18559/639221503011100000> | HTTP 403 "Access Denied" (AkamaiGHost) |
| `palo-alto-cal-ave-halloween-live-2026` | <https://www.paloalto.gov/files/assets/public/v/1/city-manager/communications-office/news-articles/2026/thursday-live-halloween-event-flyer.jpg?w=1200> | HTTP 403 "Access Denied" HTML page |
| `roundup-suisun-dia-muertos-2026` | <https://www.suisun.com/files/assets/suisuncity/v/1/winter-playbook-2026-flyers-half-page-8.5-x-5.5-in-1.png?w=1200> | HTTP 403 "Access Denied" HTML page |
| `ssf-senior-holiday-boutique-nov7-2026` | <https://www.ssfca.gov/files/assets/public/v/1/parks-and-recreation/images/recreation/seniors/senior-holiday-boutique_1.jpg?w=1200> | HTTP 403 "Access Denied" HTML page |

## Not changed

- Event facts, dates, prices and `verifiedAt` are unchanged. Captions describe the picture and point to the official page; they add no new facts about the 2026 events.
- Share cards stay text-only. baylink-api needs no change (its `lib/` never reads `imageKey`).
- The superseded venue photos stay registered for the other events that still use them.
