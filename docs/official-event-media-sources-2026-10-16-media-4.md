# Official event images: sources and rights (2026-10-16, CNT-MEDIA-4)

Lane CNT-MEDIA-4. Same rule as the 2026-10-08, 2026-10-14 and 2026-10-15 batches ([sources 2026-10-15](official-event-media-sources-2026-10-15.md)): an organiser's own image may be shown beside coverage of **that same event**, labelled 官方图 with a link to the official page; the About page carries the takedown contact. On 2026-10-16 the owner approved, in chat, three rows of the November–December image-candidates list (GPT research, `gpt/out-1016c/image-candidates-nov-dec.md`, read 2026-10-15): the Healdsburg Saturday market (`salsa-sales.jpg`), the Fort Mason Sunday market and the Arion Press tours. The owner's condition: never present them as a photo of a future session. The other rows of that list were not downloaded. (CNT-WEEKEND-1107 records its own 10-16 rows in `official-event-media-sources-2026-10-16.md`.)

Result: **3 of 3 files downloaded, 2 shipped** (Fort Mason market, Arion Press), both as photos. **Healdsburg is held back** until the owner answers: the photo's subject is a stallholder whose face is clearly identifiable, smiling at the camera in a medium shot, with a man close by in profile, and the lane brief allows no identifiable face up close. Shipped as a cover it would show that face on list and home cards, not only on the event page. The download stays in the lane folder (its record is in the table below), so shipping it later means reverting the hold-back commit and regenerating. No image was generated, and none was edited beyond resizing and re-encoding.

## How it is wired

Same as 2026-10-15: one record per image in `src/data/official-event-media.json` (English in `official-event-media-en.json`), `OFFICIAL_EVENT_IMAGE_UPDATES` gives each event its `official-<event id>` key, and `getImageProvenance` labels it 官方图 / Official image / 官方圖 because every credit says 官方 / official. The download record (original URL, retrieval time, SHA-256) is in `scripts/data/official-event-media-downloads.json`, outside the bundle. Each key has `coverOk: true` in `src/data/media-rights-overlay.json`; the 480/800/1200 rungs come from `npm run images:variants`. Each photo carries a crop focus.

What the images replace:
- **Healdsburg** (held back, unchanged): the same `salsa-sales.jpg` is registered as `octnov-healdsburg-market-context`, a *theme* photo (`event-image-usage.ts`). The cover resolver never uses a theme photo as a cover, so the event keeps its text card, as on main.
- **Fort Mason market and Arion Press**: both used `octnov-fort-mason-context`, a 2015 Commons photo of the Fort Mason piers, which the resolver rejects as a cover (older than eight years), so both showed text cards. The venue alias lost its two events and is removed from `octnov-2026-event-photo-aliases.ts`. The photo itself stays registered on purpose: it is a correctly credited venue photo that a later Fort Mason listing can use through a venue alias, and the registered keys are pinned in `scripts/data/media-rights-baseline.json`.

## Rights

Every record uses `rights.basis: "promo-editorial"` with the official event page as `evidenceUrl` and `scope: "same-event coverage only"`: the organiser published the photo on its own page for that event, and BAYLINK shows it only beside coverage of the same event, credited and linked. No organiser in this batch publishes an open licence. Do not use these images in ads, share-card promotion, tester recruiting or fundraising.

Notes per image:
- **Healdsburg Certified Farmers Market** (held back): the stall photo on the market's home page; its alt text there reads "A woman in a hat and glasses stands behind a market stall, smiling at three customers. Jars of salsa are displayed on the counter." The stallholder faces the camera (an adult, a medium shot, the market's own promotional photo); the customers are seen from behind or in profile. The site's credits page names its photographers as a group ("PHOTOGRAPHY: Cynthia Glassell, Will Bucquoy and Healdsburg Farmers Market friends") without saying who took which photo, so the credit is the market only. The photo is not dated (the file sits under `/wp-content/uploads/2026/03/`). Held back for the face (see Result).
- **Fort Mason Sunday farmers market**: the `og:image` of the Fort Mason market page. Crates of peaches and cherries under a K & J Orchards banner; the stallholder wears a mask. Not dated, but the file sits under `/wp-content/uploads/2015/09/`, so it has been on the site since September 2015 and is at least that old. The caption says so (the official tier skips the cover age gate, so the caption is where a reader learns the age), and, because peaches and cherries are summer fruit, that it does not show what the November Sundays will have. On the 10/31 weekend it is the home page's #2 pick.
- **Arion Press public tours**: the `og:image` of the Fort Mason event page for the 11/21 tour. The workshop's glass frontage on the pier, presses and type cabinets inside, a staff member blurred behind the glass and a passer-by seen from behind. Not dated (the file sits under `/2024/11/`); the caption says it is not from a tour day.

Captions (both shipped ones say 活动官方照片, that the photo is not dated, and that it is not a listed session):
- Fort Mason market: 2015 年就已上传到官网，拍摄日期未注明；桃子和樱桃是夏季水果，不代表 11 月各个周日的摊位和商品，以当天为准。 (EN: "on the site since 2015; the shoot date is not given")
- Arion Press: 拍摄日期未注明，不是导览当天的现场；参观内容以工坊安排为准。

## Download

One plain GET per URL, the exact image URL in the approved rows, into a folder outside the repository, on 2026-10-16 at 14:55 PT; content type and size checked against the list's HEAD reply. All three answered 200 with exactly the HEAD size. The three event pages were re-read with plain GETs the same day at 15:02 PT (all 200; ledger: `source-reads-2026-10.md`, CNT-MEDIA-4), and each page still shows the downloaded file.

## Processing

Main file: original width up to 1280 px (never upscaled), sRGB, WebP q82, metadata stripped; no crop, colour edit or AI step. Rungs: `npm run images:variants`.

## Every approved row

| Event id | Image URL | Bytes (HEAD) | Type | Original | SHA-256 | Used | Shipped as |
|---|---|---|---|---|---|---|---|
| `november-north-healdsburg-market-2026` | https://healdsburgfarmersmarket.org/wp-content/uploads/2026/03/salsa-sales.jpg | 63002 (63002) | image/jpeg | 1000×585 | `f5e4962e3ac6470d…` | **held back** (face; owner to decide) | — (prepared as a photo, focus 42/40, main WebP 1000×585, 41340 B; not in the repo) |
| `nov2026-fort-mason-farmers-market` | https://fortmason.org/wp-content/uploads/2015/09/farmers_market_peaches_bigslide.jpg | 167908 (167908) | image/jpeg | 1400×900 | `5246b435d8e7ce67…` | **yes** | photo, focus 50/62; main WebP 1280×823, 166884 B |
| `nov2026-arion-press-public-tours` | https://fortmason.org/wp-content/uploads/2024/11/arion_press_entry_3840x2560.jpg | 350669 (350669) | image/jpeg | 2560×1707 | `20c8ff4fd11c43bb…` | **yes** | photo, focus 55/45; main WebP 1280×854, 125642 B |

The Arion Press file name says 3840×2560; the file served is 2560×1707.

## Follow-ups for a content lane (not changed here)

- Healdsburg: the market's home page lists Saturdays "April 11 - December 19"; the event's dates stop at 11/28.
- Arion Press: the tour page also lists Saturday, December 19 (and Thursdays November 12 and December 10); the event lists 11/12 and 11/21.
