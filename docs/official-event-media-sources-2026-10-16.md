# Official event images: sources and rights (2026-10-16)

Lane CNT-WEEKEND-1107. Same rule as the earlier batches ([2026-10-08](official-event-media-sources-2026-10-08.md), [2026-10-14](official-event-media-sources-2026-10-14.md), [2026-10-15](official-event-media-sources-2026-10-15.md)): an organiser's own image may be shown beside coverage of **that same event**, labelled 官方图 with a link to the official page; the About page carries the takedown contact. On 2026-10-16 the owner approved, in chat, two rows of the 11/28–12/13 image-candidates list (GPT research, `gpt/out-1016d/image-candidates-dec.md`, read 2026-10-16): the Union Square Ice Rink photo and the City of Cupertino's Baer blacksmith shop photo ("skip Baer if it cannot be downloaded"). The other rows of that list were not downloaded.

Result: **2 of 2 files downloaded, 2 shipped.** No image was generated, and none was edited beyond resizing, re-encoding and (Union Square only) one full-resolution cut, described under Processing.

## How it is wired

Same as 2026-10-15: one record per image in `src/data/official-event-media.json` (English in `official-event-media-en.json`), `OFFICIAL_EVENT_IMAGE_UPDATES` gives each event its `official-<event id>` key, and `getImageProvenance` labels it 官方图 / Official image / 官方圖 because both credits say 官方 / official. The download record (original URL, retrieval time, SHA-256) is in `scripts/data/official-event-media-downloads.json`, outside the bundle. Each key has `coverOk: true` in `src/data/media-rights-overlay.json`; the rungs come from `npm run images:variants`. Both are photos (`kind: "photo"`) with a crop focus.

## Rights

Both records use `rights.basis: "promo-editorial"` with the official event page as `evidenceUrl` and `scope: "same-event coverage only"`: the organiser shows the photo on its own event page, and BAYLINK shows it only beside coverage of the same event, credited and linked. Neither page publishes an open licence or names a photographer. Do not use these images in ads, share-card promotion, tester recruiting or fundraising.

Notes per image:
- **Union Square Ice Rink**: the 2026–27 season page's wide hero (1920×480), a night view from above: the lit rink, the Christmas tree and the Dewey Monument column, shops and Geary/Powell streets around it. Skaters are tiny; no face is recognisable. The season opens 11/4, so the photo is from an earlier season; the caption says it is not this season and gives no year. The main file is a full-resolution 1280×480 cut of it (see Processing); cards crop it around the rink (focus 42/62) and the wide detail header shows the rink, the column and the tree.
- **Baer blacksmith shop** (City of Cupertino): the page photo of the McClellan Ranch shop building behind tall grasses, no people and no demonstration under way. The caption says it shows the building, not a demonstration day. The approved row's URL asks the city's file server for a 480 px rendition (`?dimension=pageimage&w=480`), and the registry needs a main file wider than 480 px (its own 480 rung), so the same city asset was fetched once more at the server's `w=1280` rendition (1280×853, 435414 bytes, HEAD 200); it is the same photo, compared side by side with the 480 file. The 480 file stays in the lane's download folder, marked superseded. The event page answers 403 to scripts; it was read in a browser by the GPT editor on 2026-10-16 (11/28 listed); the lane could not re-read it.

## Download

One plain GET per URL, the exact image URL in the approved rows (no other client, no page scraping), into a folder outside the repository (`opus-qa/overhaul/lanes/CNT-WEEKEND-1107/downloads/`); content type and size checked against a HEAD reply. Both files answered 200 with exactly the HEAD size (the Baer row's original `w=480` URL answered HEAD with 403 to the GPT editor, and 200 to a plain GET). The rink's season page was re-read on 2026-10-16 15:10 PT (ledger: `source-reads-2026-10.md`, CNT-WEEKEND-1107 images).

## Processing

Main file: original width up to 1280 px (never upscaled), sRGB, WebP q82, metadata stripped; no colour edit or AI step. Baer: resized only, no crop. Union Square (lane review): the 1920×480 panorama scaled to 1280×320 left the 16:9 detail hero about 1.3× upscaled at DPR 1 and 2.5× at DPR 2, so the main file is a 1280×480 cut of the original at full resolution (x 500–1780, no scaling) that keeps the rink, the column and the tree; the left street edge and the right building edge fall away. Cards still crop it around the rink by `focal`. Rungs: `npm run images:variants`.

## Every approved row

| Event id | Image URL | Bytes (HEAD) | Type | Original | SHA-256 | Used | Shipped as |
|---|---|---|---|---|---|---|---|
| `union-square-holiday-ice-rink-2026` | https://unionsquareicerink.com/wp-content/uploads/hero-2026-03.jpg | 109823 (109823) | image/jpeg | 1920×480 | `4659c9b541769c11…` | **yes** | photo, focus 42/62; main WebP 1280×480 (cut x 500–1780 of the original, no scaling), 151394 B |
| `cupertino-baer-blacksmith-fall-2026` | https://www.cupertino.gov/files/assets/city/v/1/parks-and-recreation/images/mcclellan-ranch-preserve/historic-buildings/blacksmith-shop-1.jpg?dimension=pageimage&w=1280 (approved row: the same path with `w=480`, 72006 B, 480×320, `454a3aecd963e200…`, superseded) | 435414 (435414) | image/jpeg | 1280×853 | `46dbbd551ba43d3b…` | **yes** | photo, focus 48/55; main WebP 1280×853, 196486 B |
