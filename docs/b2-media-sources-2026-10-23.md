# B2 photos: sources, approval and use (2026-10-23)

Lane UI9-IMG-B2-REGISTER. UI-9 DECISIONS 21–27 (every card has a picture; tier order ① official → ② venue → ③ stock), 32 (lead
slots take only photographic ①/②) and 33 (who approves a batch).

**Approval.** Owner, BAYLINK captain chat 2026-10-23 ~01:10 PT (DECISIONS 33): 「關於圖片方面，只要你分析過後，覺得合適，更好，就可以通過」.
Under it the captain approved this batch on 2026-10-23 after an independent skeptic check of every picture (rights, licence,
fit, quality, faces, text and logos, season) and a captain recheck of licences and dates (Wikimedia Commons API, EXIF, page
dates): `opus-qa/overhaul/lanes/UI9-IMG-B2/APPROVAL-B2-1023.md` and `approved-b2-1023.json`. 41 pictures approved
(③ 20, ② 16, ① 5); 82 candidates rejected and the gaps listed there were not touched.

**Downloads.** Only the 41 approved `imageUrl`s, one at a time about 4 s apart, on 2026-10-23 13:46–13:49 PT. Each download
record (scripts/data/category-stock-photos-downloads.json, venue-photo-media-downloads.json, official-event-media-downloads.json)
keeps the approval reference, page URL, original URL, time, content type, bytes, SHA-256 and SHA-1. Nothing else was fetched.

**Processing.** Resized to at most 1280 px wide and 1600 px tall (never upscaled, never cropped), EXIF orientation applied,
WebP q78 with metadata stripped. `npm run images:variants` adds the 480 w file, the 800/1200 rungs and the placeholder colour.
Three rungs stay over the size targets at the lowest quality step and are listed in scripts/data/image-budget-exceptions.json
(stock-winter-holidays-8 800 w and 1200 w: string lights; the Danville scarecrow 1200 w: straw and hay); the heavy stock
picture goes last in its pool (cover-candidates.ts HEAVY_STOCK).

**Labels and credits.** ③ 示意图 / Illustrative photo, credit 「示意图 · 摄影 <author> / Unsplash|Pexels」. ② 场馆照 · <year>,
credit names the author, Wikimedia Commons and the licence for CC files (CC BY / BY-SA attribution and 「已缩放压缩，按版面裁切」),
or 「<venue> 官方场馆图」 for the three photos from a venue's own page. ① 官方图 (官方图 · 2025 往届 for the two 2025 altar photos);
every ① caption says what the photo is not (not this year's event, another Pumpkins After Dark site, the installation before
festival day). Share cards: only CC0 / stock pictures may go on one (promoAllowed true); every ① and the CC BY / BY-SA and
venue-page ② photos are promoAllowed false.

## ③ Category stock (20)

| # | Key | Source | Author | Licence | Year | Rights | Focal | Use | Downloaded (PT) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `stock-lantern-1` | [page](https://unsplash.com/photos/red-animal-paper-lanterns-yfSNuhjxci0) | fishy fishy (@its12_06pm) | Unsplash License | uploaded 2026-09-20; EXIF Olympus E-M5 Mark II | stock · promo yes | [45, 45] | pinned to `event:smcl-portola-valley-mid-autumn-lantern-2026` | 13:46:01 |
| 2 | `stock-halloween-7` | [page](https://www.pexels.com/photo/kids-in-halloween-outfits-playing-trick-or-treat-5859556/) | Charles Parker | Pexels License | uploaded 2020-11-11 (same-day series; pre-photoreal-AI) | stock · promo yes | [55, 60] | pool `halloween`; pinned to `event:menlo-park-trunk-or-treat-2026`, `event:orinda-trunk-and-treat-october-2026`, `event:concord-police-trunk-treat-2026`, `event:windsor-trick-or-treat-trail-2026` | 13:46:06 |
| 3 | `stock-campus-open-day-1` | [page](https://unsplash.com/photos/old-brick-building-surrounded-by-vibrant-autumn-foliage-M9VhxlGuyRw) | Cloris Ying (@clorisyy) | Unsplash License | uploaded 2026-06-07; EXIF Sony ILCE-7RM2 | stock · promo yes | [50, 50] | pinned to `event:berkeley-college-information-day-2026` | 13:46:10 |
| 4 | `stock-diwali-5` | [page](https://www.pexels.com/photo/people-sprinkling-colored-powder-5491495/) | Nishant Aneja | Pexels License | uploaded 2020-10-01 (pre-photoreal-AI) | stock · promo yes | [55, 45] | pool `diwali` | 13:46:15 |
| 5 | `stock-diwali-6` | [page](https://unsplash.com/photos/marigold-and-jasmine-flower-garlands-V15kJDxvqKk) | Sangram Rakate (@najaratonajaria) | Unsplash License | uploaded 2026-09-21; EXIF Sony ILCE-7M3 | stock · promo yes | [50, 50] | pool `diwali` | 13:46:19 |
| 6 | `stock-winter-holidays-8` | [page](https://unsplash.com/photos/pathway-decorated-with-glowing-string-lights-at-night-xCCWAxAzUFo) | note thanun (@notethanun) | Unsplash License | uploaded 2026-01-09; EXIF Google Pixel 6 | stock · promo yes | [50, 45] | pool `winter-holidays`; pinned to `event:sfzoo-zoolights-2026` | 13:46:24 |
| 7 | `stock-muni-1` | [page](https://www.pexels.com/photo/red-and-white-tram-on-street-13241427/) | Justin L U C K (@Justyzvidz) | Pexels License | uploaded 2022-08-16 | stock · promo yes | [60, 55] | pinned to `offer:sfmta-free-muni-seniors`, `offer:chase-center-ticket-muni-included`, `offer:muni-youth-free` | 13:46:29 |
| 8 | `stock-muni-2` | [page](https://unsplash.com/photos/red-and-gray-train-interior-yhFdxUYkgA8) | Josh Wilburne (@joshwilburne) | Unsplash License | uploaded 2018-01-05; EXIF Sony ILCE-7 | stock · promo yes | [50, 50] | pinned to `offer:sfmta-free-muni-seniors`, `offer:chase-center-ticket-muni-included`, `offer:muni-youth-free` | 13:46:34 |
| 9 | `stock-dumplings-1` | [page](https://unsplash.com/photos/person-making-dumplings-rioTUXsDImc) | Frank Zhang (@frankzphoto) | Unsplash License | uploaded 2019-10-09; EXIF Canon EOS 5D Mark IV | stock · promo yes | [45, 50] | pinned to `event:sf-world-of-dumplings-2026` | 13:46:38 |
| 10 | `stock-dumplings-2` | [page](https://www.pexels.com/photo/faceless-woman-preparing-jiaozi-dumplings-served-on-bamboo-tray-7363964/) | Angela Roma | Pexels License | uploaded 2021-04-02 (series) | stock · promo yes | [50, 55] | pinned to `event:sf-world-of-dumplings-2026` | 13:46:43 |
| 11 | `stock-pumpkin-harvest-5` | [page](https://unsplash.com/photos/a-couple-of-scarecrows-in-a-pumpkin-patch-UqlvLAfcvBs) | Simon Hurry (@bullterriere) | Unsplash License | uploaded 2022-10-31; EXIF Canon EOS M100 | stock · promo yes | [50, 55] | pool `pumpkin-harvest` | 13:46:48 |
| 12 | `stock-pumpkin-harvest-6` | [page](https://unsplash.com/photos/hay-bales-in-a-field-during-autumn-FQX34vNxOJo) | Damian Kravchuk (@damiankravchuk) | Unsplash License | uploaded 2025-10-13; EXIF Sony ILCE-7RM5 | stock · promo yes | [50, 60] | pool `pumpkin-harvest` | 13:46:53 |
| 13 | `stock-community-festival-5` | [page](https://unsplash.com/photos/stage-and-tents-on-grassy-field-FJOefYIOSrc) | XS Xue (@kngstm) | Unsplash License | uploaded 2026-09-25; EXIF Sony ILCE-7CM2 | stock · promo yes | [50, 50] | pool `community-festival` | 13:46:59 |
| 14 | `stock-stage-show-4` | [page](https://unsplash.com/photos/people-standing-on-stage-with-lights-turned-on-during-nighttime-PFfA3xlHFbQ) | Erik Mclean (@introspectivedsgn) | Unsplash License | uploaded 2020-04-01; EXIF Canon EOS Rebel T3 | stock · promo yes | [55, 40] | pool `stage-show` | 13:47:03 |
| 15 | `stock-stage-show-5` | [page](https://www.pexels.com/photo/close-up-shot-of-microphone-12092846/) | A. S. | Pexels License | uploaded 2022-05-10 | stock · promo yes | [50, 45] | pool `stage-show` | 13:47:07 |
| 16 | `stock-swap-meet-4` | [page](https://unsplash.com/photos/assorted-ceramic-mugs-on-stainless-steel-rack-7f0nfLisUtk) | Mats Hagwall (@hagwall) | Unsplash License | uploaded 2021-06-12; EXIF Panasonic DMC-GX7 | stock · promo yes | [50, 50] | pool `swap-meet` | 13:47:12 |
| 17 | `stock-swap-meet-5` | [page](https://www.pexels.com/photo/miscellaneous-merchandise-with-glasses-and-figurines-14346109/) | Boys in Bristol Photography (@lebele) | Pexels License | uploaded 2022-11-07 | stock · promo yes | [50, 50] | pool `swap-meet` | 13:47:16 |
| 18 | `stock-swap-meet-6` | [page](https://unsplash.com/photos/tables-with-decorative-items-and-mirrors-displayed-outside-YlA_ag0CJcI) | Lana Graves (@lanathegraves) | Unsplash License | uploaded 2025-10-28; EXIF Canon EOS 550D | stock · promo yes | [50, 50] | pool `swap-meet` | 13:47:20 |
| 19 | `stock-sports-hockey-7` | [page](https://www.pexels.com/photo/hockey-goal-on-hockey-rink-6847292/) | Tima Miroshnichenko | Pexels License | uploaded 2021-02-16 | stock · promo yes | [45, 55] | pool `sports-hockey` | 13:47:24 |
| 20 | `stock-library-9` | [page](https://unsplash.com/photos/a-bookshelf-in-the-shape-of-a-house-in-the-middle-of-a-park-8ZVgkpKfyRM) | Gigi (@ling_gigi) | Unsplash License | uploaded 2023-08-05; EXIF Canon EOS RP | stock · promo yes | [50, 55] | pool `library`; pinned to `event:sfpl-western-addition-open-house-oct24-2026` | 13:47:29 |

Pin-only pictures (not in a shared pool): the lantern, the campus open day, the two Muni pictures (only the three SFMTA /
Muni offers, never the transit pool) and the two dumpling pictures. src/data/record-photo-pins.json also holds the
reviewed fallback orders that needed no download (approved-b2-1023.json `dataOnly`): Financial Planning Day, Windsor's
trick-or-treat trail, the Western Addition open house and the Cherryland storytimes. No first-aid pool: no CPR picture
was approved.

## ② Venue photos (16)

| # | Key | Source | Author | Licence | Year | Rights | Focal | Use | Downloaded (PT) |
|---|---|---|---|---|---|---|---|---|---|
| 21 | `venue-sf-main-library` | [page](https://commons.wikimedia.org/wiki/File:SFPL_Main_Branch_atrium_ceiling.jpg) | ECTran71 | CC BY-SA 4.0 | 2026 (EXIF 2026-01-24) | cc · promo no | [50, 45] | venue `sf-main-library` (match 100 Larkin, SF Main Library, San Francisco Main Library) | 13:47:33 |
| 22 | `venue-sap-center` | [page](https://commons.wikimedia.org/wiki/File:SAP_Center_in_San_Jose_(52194580276).jpg) | Daniel Ramirez | CC BY 2.0 | 2022 (EXIF 2022-06-10) | cc · promo no | [45, 50] | venue `sap-center` (match SAP Center) | 13:47:37 |
| 23 | `venue-exploratorium` | [page](https://commons.wikimedia.org/wiki/File:Pier_15_(San_Francisco)_July_2022.JPG) | Benoît Prieur | CC0 1.0 | 2022 (EXIF 2022-07-19) | cc · promo yes | [50, 50] | venue `exploratorium` (match Exploratorium) | 13:47:42 |
| 24 | `venue-ferry-building` | [page](https://commons.wikimedia.org/wiki/File:Ferry_Building_July_2022_(2).JPG) | Benoît Prieur | CC0 1.0 | 2022 (EXIF 2022-07-19) | cc · promo yes | [50, 40] | venue `ferry-building` (match Ferry Building, 1 Ferry Building, Ferry Plaza) | 13:47:47 |
| 25 | `venue-opl-main-library` | [page](https://commons.wikimedia.org/wiki/File:Oakland_Public_Library_-_main_library.jpg) | Mx. Granger | CC0 1.0 | 2024 (EXIF 2024-05-19) | cc · promo yes | [45, 50] | venue `opl-main-library` (match 125 14th Street, 奥克兰公共图书馆总馆) | 13:47:51 |
| 26 | `venue-omca` | [page](https://museumca.org/press/) | Oakland Museum of California (photographer initials OH) | official press-page photo; editorial use with credit | 2021 (file name 2021-02-25) | promo-editorial · promo no | [50, 50] | venue `omca` (match Oakland Museum of California, OMCA; records event:oakland-omca-friday-finale-2026, offer:omca-free-nov1-2026) | 13:47:55 |
| 27 | `venue-sf-botanical-garden` | [page](https://commons.wikimedia.org/wiki/File:San_Francisco_Botanical_Garden_23_2024-04-23.jpg) | Fastily | CC BY-SA 4.0 | 2024 (EXIF 2024-04-13) | cc · promo no | [50, 55] | venue `sf-botanical-garden` (match San Francisco Botanical Garden; records event:nov2026-botanical-one-day-choir, offer:botanical-free-nov10-2026, offer:botanical-thanksgiving-nov26-2026) | 13:48:00 |
| 28 | `venue-fort-mason-center` | [page](https://commons.wikimedia.org/wiki/File:Fort_Mason_in_December_2025_-_01.jpeg) | David Lee | CC BY 4.0 | 2025 (EXIF 2025-11-14) | cc · promo no | [40, 55] | venue `fort-mason-center` (match Fort Mason Center) | 13:48:04 |
| 29 | `venue-smcl-millbrae-library` | [page](https://commons.wikimedia.org/wiki/File:Millbrae_Library,_exterior_(October_2024)_01.jpg) | BriefEdits | CC BY-SA 4.0 | 2024 (EXIF 2024-10-26) | cc · promo no | [45, 55] | venue `smcl-millbrae-library` (match Millbrae 图书馆, Millbrae Library; records event:smcl-millbrae-chinese-storytime-oct-2026, event:smcl-millbrae-chinese-culture-club-ai-nov7-2026) | 13:48:09 |
| 30 | `venue-smcl-foster-city-library` | [page](https://commons.wikimedia.org/wiki/File:Foster_City_Library,_exterior_(November_2024)_02.jpg) | BriefEdits | CC BY-SA 4.0 | 2024 (EXIF 2024-11-09) | cc · promo no | [50, 55] | venue `smcl-foster-city-library` (match Foster City 图书馆, Foster City Library; records event:smcl-foster-city-nidhi-chanani-2026, event:smcl-foster-city-maker-exploration-2026) | 13:48:13 |
| 31 | `venue-smcl-brisbane-library` | [page](https://smcl.org/locations/1R/) | San Mateo County Libraries (photographer not named) | official location-page photo; no licence stated | 2021 (building opened 2021-04-22; file 2021-09-21) | promo-editorial · promo no | [50, 50] | venue `smcl-brisbane-library` (match Brisbane 图书馆, Brisbane Library) | 13:48:18 |
| 32 | `venue-smcl-atherton-library` | [page](https://commons.wikimedia.org/wiki/File:Atherton_Library_Entrance.jpg) | BrokenSegue | CC BY-SA 4.0 | 2026 (EXIF 2026-10-21) | cc · promo no | [50, 50] | venue `smcl-atherton-library` (match Atherton 图书馆, Dinkelspiel Station; records event:smcl-atherton-diwali-henna-2026, event:smcl-atherton-maker-families-2026) | 13:48:22 |
| 33 | `venue-sjpl-calabazas-library` | [page](https://commons.wikimedia.org/wiki/File:Calabazas_Branch_Library_0432.jpg) | Cristiano Tomás | CC BY-SA 4.0 | 2021 (2021-03-31) | cc · promo no | [50, 50] | venue `sjpl-calabazas-library` (match Calabazas 分馆, Calabazas Branch) | 13:48:26 |
| 34 | `venue-sccl-campbell-library` | [page](https://sccld.org/locations/campbell/) | Santa Clara County Library District (photographer not named) | official location-page photo; no licence stated | 2026 (file CampbellLibrary2026, 2026-04-06) | promo-editorial · promo no | [50, 50] | venue `sccl-campbell-library` (match Campbell 图书馆, Campbell Library; records event:sccl-campbell-scam-calls-workshop-2026, event:sccl-campbell-friends-book-sale-nov14-2026) | 13:48:31 |
| 35 | `venue-acl-castro-valley-library` | [page](https://commons.wikimedia.org/wiki/File:Castro_Valley_Library,_exterior_(September_2026)_01.jpg) | BriefEdits | CC BY-SA 4.0 | 2026 (EXIF 2026-09-15, iPhone 17) | cc · promo no | [50, 50] | venue `acl-castro-valley-library` (match Castro Valley 图书馆, Castro Valley Library; records event:acl-castro-valley-military-records-2026) | 13:48:36 |
| 36 | `venue-opl-dimond-library` | [page](https://commons.wikimedia.org/wiki/File:Oakland_Public_Library_Dimond_Branch,_exterior_(September_2026).jpg) | BriefEdits | CC BY-SA 4.0 | 2026 (EXIF 2026-09-15, iPhone 17) | cc · promo no | [45, 55] | venue `opl-dimond-library` (match Dimond 分馆, Dimond Branch; records event:opl-dimond-kids-arts-crafts-2026) | 13:48:41 |

Retired where a photo above replaces them (DECISIONS 22's 8-year rule): `roundup-sap-center` (2014) on the four SAP Center
events and the city update, `region-omca` (2012) on the OMCA events, offers and the Lake Merritt + OMCA guide, and
`octnov-sf-botanical-context` (2005) on the Botanical Garden Thanksgiving offer. `region-omca` stays on the OMCA place
card of the regional map (places are outside this batch).

## ① Lead photos (5)

| # | Key | Source | Author | Licence | Year | Rights | Focal | Use | Downloaded (PT) |
|---|---|---|---|---|---|---|---|---|---|
| 38 | `official-r2-petaluma-lumafest-20261024` | [page](https://lumafest.santarosa.edu/) | SRJC LumaFest (photographer not named) | organiser's own page; no licence stated | 2025 (EXIF 2025-10-18) → label 官方图 · 2025 往届 | promo-editorial · promo no | [50, 55] | own image of `event:r2-petaluma-lumafest-20261024` | 13:48:45 |
| 39 | `official-san-jose-avenida-altares-2026` | [page](https://mhplaza.org/allevents/avenida26) | Mexican Heritage Plaza (photographer not named) | organiser's own page; no licence stated | 2025 (file 2025-11-01) → 官方图 · 2025 往届 | promo-editorial · promo no | [50, 30] | own image of `event:san-jose-avenida-altares-2026` | 13:48:49 |
| 40 | `official-nov2026-fruitvale-dia-muertos` | [page](https://unitycouncil.org/lacatrina/) | The Unity Council (organiser; photographer not named) | organiser's own page; no licence stated | 2026 (uploaded 2026-09) | promo-editorial · promo no | [50, 30] | own image of `event:nov2026-fruitvale-dia-muertos` | 13:48:53 |
| 41 | `official-pleasanton-pumpkins-after-dark-2026` | [page](https://pumpkinsafterdark.com/) | Pumpkins After Dark (event producer; photographer not named) | organiser's own page; no licence stated | not stated → label 官方图 (no year) | promo-editorial · promo no | [50, 50] | own image of `event:pleasanton-pumpkins-after-dark-2026` | 13:48:58 |
| 42 | `official-danville-scarecrow-stroll-2026` | [page](https://danville.ca.gov/851/Scarecrow-Stroll) | Town of Danville (photographer not named) | organiser's own page; no licence stated | not stated (uploaded with the 2026 banner) → label 官方图 | promo-editorial · promo no | [50, 35] | own image of `event:danville-scarecrow-stroll-2026` | 13:49:03 |

Four replace an older official image of the same event in place (same key, new file; the old files are deleted): LumaFest's
posed volunteer photo (it also leaves the close-up list), the Avenida de los Altares text poster, the Pumpkins After Dark
title image and Danville's straw-frame text banner. Fruitvale's La Catrina photo replaces a ③ stock picture.
Promotion rights for any ① stay with the owner (asking organisers is the owner's call).
