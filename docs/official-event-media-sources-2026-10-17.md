# Official event images: sources and rights (2026-10-17)

Lane CNT-WEEKEND-1128. Same rule as the earlier batches ([2026-10-08](official-event-media-sources-2026-10-08.md), [2026-10-14](official-event-media-sources-2026-10-14.md), [2026-10-15](official-event-media-sources-2026-10-15.md), [2026-10-16](official-event-media-sources-2026-10-16.md)): an organiser's own image may be shown beside coverage of **that same event**, labelled 官方图 with a link to the official page; the About page carries the takedown contact. On 2026-10-16 (about 20:15 PDT) the owner approved, in chat, **one** row of the 2027 Lunar New Year image-candidates list (GPT research, `gpt/out-1016e/image-candidates-lny.md`): the San Francisco Chinese New Year Parade photo (row `lny27-sf-parade`), to be labelled a past-year photo (往届 · 官方图 with a source link), never 2027. Not approved and not downloaded: the Miss Chinatown 2026 group photo and the two Knight Lights photos (flower market, YMCA run).

Result: **1 of 1 file downloaded, 1 shipped.** No image was generated, and none was edited beyond resizing and re-encoding.

## How it is wired

Same as 2026-10-16: one record in `src/data/official-event-media.json` (English in `official-event-media-en.json`), `OFFICIAL_EVENT_IMAGE_UPDATES` gives the event its `official-<event id>` key, and `getImageProvenance` labels it 官方图 · 2025 往届 / Official image · 2025 / 官方圖 · 2025 往屆: official because both credits say 官方 / official, and with the edition year because the caption names it ("2025 往届"); cards and the detail hero show no caption, so the badge carries the owner's 往届 condition there too. The download record (original URL, retrieval time, SHA-256) is in `scripts/data/official-event-media-downloads.json`, outside the bundle. The key has `coverOk: true` in `src/data/media-rights-overlay.json`; the rungs come from `npm run images:variants`. It is a photo (`kind: "photo"`) with a crop focus.

## Rights

`rights.basis: "promo-editorial"` with the organiser's home page as `evidenceUrl` (the photo appears there, in its About section) and `scope: "same-event coverage only"`: the San Francisco Chinese Chamber of Commerce shows the photo on its own festival site, and BAYLINK shows it only beside coverage of the same parade, credited and linked. The page publishes no open licence and names no photographer for it. Do not use the image in ads, share-card promotion, tester recruiting or fundraising.

Notes:
- **What it shows**: a night street scene: dancers in purple and green carry a long gold-and-silver dragon through an intersection, spectators sit behind the barricade, red banners above read 新春大吉 with the festival's name and sponsor logos. Faces of performers and adult spectators are visible at street-photo size; no child is shown in close-up.
- **Year**: the file's camera record (EXIF DateTimeOriginal) is **2025-02-15 18:41**, the evening of the 2025 parade (Saturday, February 15, 2025). The caption says it is the 2025 parade and not the 2027 one; the event page is the 2027 parade (2/20/2027), so the photo shows the event series, not this year's parade.
- **Crop**: focus 52/40 (the dragon's head) so cards keep the dragon.

## Download

One plain GET of the exact image URL in the approved row (no other client, no page scraping), into a folder outside the repository (`opus-qa/overhaul/lanes/CNT-WEEKEND-1128/downloads/`), on 2026-10-17 17:18 PDT; content type and size checked against the GPT editor's HEAD reply (200, image/jpeg, 20,476,541 bytes, exactly the HEAD size). The organiser's home page and FAQ were re-read the same day (ledger: `source-reads-2026-10.md`, CNT-WEEKEND-1128).

## Processing

Main file: original 6136×4090 resized to 1280 px wide (1280×853), sRGB, WebP q82, metadata stripped (so the camera date lives only in this document and the caption); no crop, colour edit or AI step. Rungs: `npm run images:variants`.

## Every approved row

| Event id | Image URL | Bytes (HEAD) | Type | Original | SHA-256 | Used | Shipped as |
|---|---|---|---|---|---|---|---|
| `sf-chinese-new-year-parade-2027` (research row `lny27-sf-parade`) | https://chineseparade.com/wp-content/uploads/2026/02/IMG_0504.jpg | 20476541 (20476541) | image/jpeg | 6136×4090 | `acd7fa2bb4ed83e5…` | **yes** | photo, focus 52/40; main WebP 1280×853, 199792 B |
