# Guide photos from Wikimedia Commons: sources and licences (2026-10-16)

Lane CNT-MEDIA-4. On 2026-10-16 the owner approved, in chat, all ten photos of `gpt/out-1016c/guide-image-candidates.md` (GPT research, read 2026-10-15) for the 办事 and 长辈 guides, with two conditions: credit the author, the licence and the licence link exactly; and label the two photos taken outside the Bay Area and California (the Social Security office in Corning, New York, and the HHS building in Washington, D.C.) 示意图.

Result: **10 of 10 files downloaded and shipped, on 7 guides.** No image was generated, and none was edited beyond resizing and re-encoding.

## How it is wired

- `src/data/guide-commons-photos-2026-10.json`: one record per photo (key `commons-…`, `/guides/commons/<key>.webp`, size, crop focus, alt, caption, credit, `creditUrl` = the Commons file page, `licenseUrl`, `photoDate`, `rights: { basis: "cc", evidenceUrl: <file page>, scope }`). English in `guide-commons-photos-2026-10-en.json` (listed in `scripts/english-sources.json`); 繁體 through the runtime converter.
- `scripts/data/guide-commons-photos-downloads.json`: the download record, outside the bundle (Commons title, author, licence, original URL, retrieval time, bytes, SHA-256, SHA-1, changes).
- `src/data/media-rights-overlay.json`: `coverOk: true` for eight photos; `coverOk: false` for the two 示意图 photos, so they can never be a list cover (a card's label could not say 示意图).
- `src/data/guide-media.ts`: five guides take a photo as their list cover (`bySlug`), and `GUIDE_EXTRA_INLINE` places each photo in the article step it belongs to. These are pilot guides (their page leads with the card carousel, not the cover), so the list-cover photo is repeated in its own article, where it would otherwise never appear. GuideDetail shows a pilot step's photo with the step's diagram, outside the 展开原文与来源 fold.
- The Medicare guide keeps its coded cover: /guides lists it twice (the 长辈与家属 rail and 医疗保险), and a photo would then appear twice on that page.

## Credit, licence and changes

Every credit reads `<author> / Wikimedia Commons · <licence> · 已缩放压缩，按版面裁切` (English: `… · resized and compressed; cropped to fit the layout`); the author name links to the Commons file page and 图片授权 / Licence links the licence deed exactly as approved. The Chinatown YWCA photo came to Commons from Flickr, so its credit says `Gary Stevens / Flickr，经 Wikimedia Commons`. Changes: resized to at most 1280 px wide (800 for the one portrait photo) and re-encoded as WebP (q82, metadata stripped); pages crop cards to their layout and cut a tall article photo to 4:5. No other edits. The licences do not transfer trademark rights (DMV, SSA, Clipper, BART and other signs in the photos), and no author or agency endorses BAYLINK.

The photos are 照片 / 资料图 by their caption year, never 官方图: they are not the agencies' own images. Captions date each photo and say what it is not.

## Download and checks

One plain GET per original URL (`upload.wikimedia.org`), on 2026-10-16 between 14:55 and 14:56 PT, into a folder outside the repository. The same afternoon (15:05 PT) the Commons API (`imageinfo`, `extmetadata`) was read for all ten files: author, licence short name, licence URL, date and size match the approved list, and every downloaded file's SHA-1 equals the SHA-1 Commons reports. Each file was looked at whole and zoomed where people appear: people are only far away (DMV headquarters, DHCS, HHS, the apartment tower) or absent; no identifiable face.

## Every approved photo

| Key | Guide (step) | Commons file | Author | Licence | Date | Original | SHA-256 | Shipped |
|---|---|---|---|---|---|---|---|---|
| `commons-dmv-sacramento-hq` | DMV licence/ID: list cover; step 6 | [California Department of Motor Vehicles Headquarters.jpg](https://commons.wikimedia.org/wiki/File:California_Department_of_Motor_Vehicles_Headquarters.jpg) | Coolcaesar | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | 2016-09-03 | 4816×3328, 4183520 B | `d6e2b0509d20090e…` | 1280×885 |
| `commons-dmv-eureka-office` | DMV licence/ID: step 3 | [California DMV Eureka CA2.jpg](https://commons.wikimedia.org/wiki/File:California_DMV_Eureka_CA2.jpg) | Ellin Beltz | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | 2014-10-15 | 3072×1794, 3056601 B | `5f8f8d06bf5fb1d5…` | 1280×748 |
| `commons-ssa-corning-ny` (示意图) | Social Security retirement: step 4 | [Corning NY social security office building.jpg](https://commons.wikimedia.org/wiki/File:Corning_NY_social_security_office_building.jpg) | J. Passepartout | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | 2025-12-03 | 4032×3024, 3417483 B | `3179fc02f7bf1e68…` | 1280×960 |
| `commons-dhcs-sacramento` | Medicare / Medi-Cal: step 3 | [California Department of Health Care Services 4.jpg](https://commons.wikimedia.org/wiki/File:California_Department_of_Health_Care_Services_4.jpg) | Sarbjit Bahga | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | 2018-05-22 | 3687×2634, 4945821 B | `5da06ba6ab45488d…` | 1280×914 |
| `commons-hhs-washington-dc` (示意图) | Medicare / Medi-Cal: step 2 | [Hubert-H-Humphrey-Building-…-Washington-DC-Apr-2014.jpg](https://commons.wikimedia.org/wiki/File:Hubert-H-Humphrey-Building-Marcel-Breuer-and-Herbert-Beckhard-Independence-Avenue-Washington-DC-Apr-2014.jpg) | Gunnar Klack | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | 2014-04-07 | 2500×1352, 466463 B | `d9514dd0988e0658…` | 1280×692 |
| `commons-clipper-embarcadero` | Senior transit and Clipper: list cover; step 1 | [BART Clipper machines in Embarcadero station.jpg](https://commons.wikimedia.org/wiki/File:BART_Clipper_machines_in_Embarcadero_station.jpg) | Fullmetal2887 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | 2021-05-15 | 4032×2831, 1750604 B | `78032f98201b6f11…` | 1280×898 |
| `commons-nema-sf` | Rental scams: list cover; step 2 | [NEMA San Francisco.jpg](https://commons.wikimedia.org/wiki/File:NEMA_San_Francisco.jpg) | Dead.rabbit | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | 2021-06-17 | 2268×4032, 2982320 B | `3890e851b469ae76…` | 800×1422 (portrait) |
| `commons-ggp-senior-center-front` | Chinese senior services: list cover; step 1 | [Golden Gate Park Senior Center - San Francisco, CA.jpg](https://commons.wikimedia.org/wiki/File:Golden_Gate_Park_Senior_Center_-_San_Francisco,_CA.jpg) | Daderot | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 2026-06-16 | 4032×2268, 3486345 B | `b7a8f2a3deea8c7d…` | 1280×720 |
| `commons-ggp-senior-center-side` | Chinese resource map: step 2 (长者服务) | [Golden Gate Park Senior Center, April 2022.jpg](https://commons.wikimedia.org/wiki/File:Golden_Gate_Park_Senior_Center,_April_2022.jpg) | Pi.1415926535 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | 2022-04-09 | 3402×2549, 4733805 B | `d57c7f85f1c7e42d…` | 1280×959 |
| `commons-chinatown-ywca-chsa` | Chinese resource map: list cover; step 1 | [Chinatown YWCA (8467462746).jpg](https://commons.wikimedia.org/wiki/File:Chinatown_YWCA_(8467462746).jpg) | Gary Stevens (Flickr) | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | 2013-02-11 | 4000×3000, 4241763 B | `16ead49839db2603…` | 1280×960 |

Full SHA-256 and SHA-1 values are in `scripts/data/guide-commons-photos-downloads.json`.

## What the captions rest on

- Which building each photo shows: the Commons file title and description (and, for the senior centre, the name over its door: "San Francisco Recreation & Park Department · Golden Gate Park Senior Center").
- The DHCS caption uses the guide's own source list (DHCS's Medi-Cal page is its official entry for Medi-Cal); the HHS caption uses the guide's own sentence that Medicare is federal health insurance. The DHCS page answered a plain GET with a 212-byte shell and hhs.gov with 403 on 2026-10-16, so no new fact about either agency was added.
- The Chinatown YWCA: CHSA's About page, read 2026-10-16 (ledger), "Visit our museum housed in the historically landmarked Julia Morgan-designed Chinatown YWCA building at 965 Clay Street".

## Not done

- HICAP still has no photo of its own; the HHS picture is Medicare background only and is never shown as a HICAP office.
- The elder scam guide has no approved photo; it keeps its coded cover.
