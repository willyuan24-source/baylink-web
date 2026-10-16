# Official event images: sources and rights (2026-10-15)

Lane CNT-MEDIA-3. Same rule as the 2026-10-08 and 2026-10-14 batches ([sources 2026-10-08](official-event-media-sources-2026-10-08.md), [sources 2026-10-14](official-event-media-sources-2026-10-14.md)): an organiser's own image may be shown beside coverage of **that same event**, labelled 官方图 with a link to the official page; the About page carries the takedown contact. On 2026-10-15 at 18:45 PT the owner approved, in chat, five rows of the 10/24–25 and 10/31–11/1 image-candidates list (GPT research, `gpt/out-1016/image-candidates-1024-1031.md`, read 2026-10-15): Pumpkins After Dark, Mare Island Wonder Sundays, Mare Island Deep Dive, the Sonoma Garden Park harvest market and SF Opera's *Manon*. The other rows of that list were not downloaded.

Result: **5 of 5 files downloaded, 5 shipped.** No image was generated, and none was edited beyond resizing and re-encoding.

## How it is wired

Same as 2026-10-14: one record per image in `src/data/official-event-media.json` (English in `official-event-media-en.json`), `OFFICIAL_EVENT_IMAGE_UPDATES` gives each event its `official-<event id>` key, and `getImageProvenance` labels it 官方图 / Official image / 官方圖 because every credit says 官方 / official. The download record (original URL, retrieval time, SHA-256) is in `scripts/data/official-event-media-downloads.json`, outside the bundle. Each key has `coverOk: true` in `src/data/media-rights-overlay.json`; the 480/800/1200 rungs come from `npm run images:variants`. The one photo (`kind: "photo"`) carries a crop focus; the graphic, the two posters and the key art (`kind: "poster"`, `fullFrame`) are letterboxed on a blurred copy of themselves and never cropped.

## Rights

Every record uses `rights.basis: "promo-editorial"` with the official event page as `evidenceUrl` and `scope: "same-event coverage only"`: the organiser published the image on its own event page (for the two Mare Island posters, on the studio's own domain) to promote that event, and BAYLINK shows it only beside coverage of the same event, credited and linked. No organiser in this batch publishes an open licence. Do not use these images in ads, share-card promotion, tester recruiting or fundraising.

Notes per image:
- **Pumpkins After Dark** (Alameda County Fairgrounds): a night photo of a lit jack-o'-lantern tunnel with PUMPKINS AFTER DARK set across its lower third, edge to edge. A 3:4 card crop would cut the words, so it is shown whole as a graphic (`artwork: "graphic"`), like the 10-08 Danville and Ameswell images. The fairgrounds page says the event "is making its debut at Alameda County Fairgrounds this fall", so the photo is not from this venue; the caption says so. The file is 580 px wide, so it has the 480 rung only.
- **Wonder Sundays** (Mare Island Art Studios): the series poster. It also lists the paid Deep Dive sessions (10/10, 10/24) and the After Dark party (10/17); the caption says the page covers Wonder Sundays only. Its 800 and 1200 rungs stay over the 90/150 KB budgets at the lowest poster quality step (q52, small lettering on dense neon art) and are listed in `scripts/data/image-budget-exceptions.json`.
- **Deep Dive** (Mare Island Art Studios): the session poster (October 10 & 24, 10 AM–1 PM, $45, ages 18+, limited to 15).
- The origin of the feather and mask artwork on the two Mare Island posters is not stated. Looked at in full and zoomed, neither shows the defects that kept images out of the 10-14 batch (garbled lettering, pseudo-characters): the lettering is clean and the shapes are coherent. Owner note in the CNT-MEDIA-3 PR.
- **Sonoma Garden Park harvest market** (Sugarloaf Ridge State Park): a market photo under the stall barn; the page prints "Photo by Melania Mahoney", and the credit repeats it. Adults face the camera; the one child in the frame is seen from behind at the left edge, outside the 3:4 card crop (focus 62/45). No date is given for the photo. The file sits under the site's `/wp-content/uploads/2026/04/` folder, so it was uploaded in April 2026, before the first Saturday listed here (10/10). The caption therefore says the photo is undated and does not show any of the listed Saturdays (revised 10-16 after review; the first wording said only "not a particular Saturday").
- **Manon** (SF Opera): the 2026–27 season illustration (the page's image description reads "Illustration of a woman in a blue dress"), shown whole as key art. The page names no illustrator; its "Photos Credit: Cory Weaver" belongs to the production photos further down the page, so the credit is SF Opera only.

## Download

One plain GET per URL, the exact image URL in the approved rows (no other client, no page scraping), into a folder outside the repository; content type and size checked against the list's HEAD reply. All five answered 200 with exactly the HEAD size. SF Opera's URL asks for `?width=1920&quality=80`; the server answered with the 2400×1200 PNG, which is the file used. The two Mare Island event pages answer a plain GET with a Cloudflare challenge (403); they were not re-read, and nothing on the BAYLINK pages depends on them beyond what the posters themselves print. The other three pages were re-read on 2026-10-15 22:08 PT (ledger: `source-reads-2026-10.md`, CNT-MEDIA-3).

## Processing

Main file: original width up to 1280 px (never upscaled), sRGB, WebP q82, metadata stripped; no crop, colour edit or AI step. Rungs: `npm run images:variants`.

## Every approved row

| Event id | Image URL | Bytes (HEAD) | Type | Original | SHA-256 | Used | Shipped as |
|---|---|---|---|---|---|---|---|
| `pleasanton-pumpkins-after-dark-2026` | https://alamedacountyfair.com/wp-content/uploads/2026/08/PAD_web.jpg | 147572 (147572) | image/jpeg | 580×350 | `51dd53cfd76593f1…` | **yes** | graphic, whole (`fullFrame`); main WebP 580×350, 65712 B |
| `r2-vallejo-wonder-sundays-2026` | https://mareislandartstudios.com/wp-content/uploads/2026/08/step-into-wonder-poster-05.png | 2038518 (2038518) | image/png | 1102×1427 | `11bfa3ab94800555…` | **yes** | poster (`fullFrame`); main WebP 1102×1427, 277448 B |
| `r2-vallejo-wonder-deep-dive-2026` | https://mareislandartstudios.com/wp-content/uploads/2026/09/step-into-wonder-poster-deep-dive.png | 1917924 (1917924) | image/png | 1103×1426 | `5c9e7a81379a16e9…` | **yes** | poster (`fullFrame`); main WebP 1103×1426, 238640 B |
| `november-north-sonoma-harvest-market-2026` | https://sugarloafpark.org/wp-content/uploads/2026/04/Events-Calendar-Template-1-NVoO0l.png | 2264894 (2264894) | image/png | 1600×900 | `29dadc83a6620068…` | **yes** | photo, focus 62/45; main WebP 1280×720, 128706 B |
| `sf-opera-manon-2026` | https://www.sfopera.com/globalassets/operas/manon/2026-27/manon_2627season_webbanner_2400x1200.png?width=1920&quality=80 | 4573799 (4573799) | image/png | 2400×1200 | `df64efb55b1c6773…` | **yes** | key art (`fullFrame`); main WebP 1280×640, 122514 B |
