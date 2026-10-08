# Federal public-domain event photographs

Reviewed 2026-10-07 for the 2026-10-08 review. This package adds one U.S. Navy photograph from DVIDS and maps it to `san-francisco-fleet-week-2026`. It replaces the Fisherman's Wharf venue sign (`verified-fishermans-wharf`, a 2016 street-sign photograph) that the event used before. No event dates, facts or verification dates change.

The photograph shows a past Fleet Week, not the 2026 air show. Its caption dates it to the 2024 practice flight and points readers to the official 2026 schedule. No AI images were created or used.

## Integration

- `src/data/federal-pd-media.json` is registered into `GUIDE_IMAGES` after the October–November packages.
- `VERIFIED_EVENT_PLACE_MEDIA_UPDATES['san-francisco-fleet-week-2026']` points the event to `dvids-blue-angels-sffw-2024`. This is an event-specific photograph, not a venue alias. It is not listed in `EVENT_CONTEXT_PHOTOS`.
- Fleet Week is removed from the Fisherman's Wharf alias `eventIds`, and that caption no longer mentions Fleet Week. Chowder Fest keeps the alias.
- `src/data/federal-pd-media-en.json` is merged into the English dictionary through `scripts/english-sources.json`. Simplified Chinese is authored here; Traditional Chinese uses the existing OpenCC conversion.
- Do not add Fleet Week to `OCTNOV_EVENT_MEDIA_UPDATES` or `octnov-2026-extra-image-updates.json`. Both are applied after the verified map and would replace the photo. `tests/fleet-week-media.test.ts` guards this.

## Source record

| Field | Value |
| --- | --- |
| Key | `dvids-blue-angels-sffw-2024` |
| Source page | [San Francisco Fleet Week 2024: Blue Angels over San Francisco](https://www.dvidshub.net/image/8691645/san-francisco-fleet-week-2024-blue-angels-over-san-francisco) (page title says "Image 6 of 10"; its notice says "Image 10 of 10") |
| DVIDS Photo ID | 8691645 |
| VIRIN | 241010-N-BT947-1353 (date 241010, service N = U.S. Navy) |
| Date taken | 2024-10-10 (DVIDS "Date Taken 10.10.2024") |
| Location | San Francisco, California, United States |
| Photographer | Mass Communication Specialist 1st Class Jacob I. Allison, U.S. Navy (byline "Petty Officer 1st Class Jacob Allison"; notice "PO1 Jacob Allison") |
| DVIDS caption | Opens "The U.S. Navy Blue Angels Flight Demonstration Team fly over San Francisco during San Francisco Fleet Week Oct. 10, 2024." and ends with the credit "(U.S. Navy photo by Mass Communication Specialist 1st Class Jacob I. Allison)". |
| Original on DVIDS | 4661 × 3107, 2.28 MB. The full-resolution download requires a DVIDS login, so it was not used. |
| Rendition used | Public DVIDS CDN rendition 2000 × 1333 JPEG, RGB, 700,628 bytes: [2000w_q95.jpg](https://d1ldvf68ux039x.cloudfront.net/thumbs/photos/2410/8691645/2000w_q95.jpg). The page links it as `twitter:image`; its `og:image` is the 1000w rendition. |
| Retrieved | 2026-10-07, about 20:35 PDT, with owner approval |
| SHA-256 of the rendition | `f8574e6c1d10c962680a8ef7cb921905e9b4d1321c70214433dcc3cacd87f983` |

The 2000w JPEG has no EXIF and no ICC profile (JFIF only). It is kept outside the repository.

## Rights

- The DVIDS page marks the photograph "PUBLIC DOMAIN". Its notice says the work "must comply with the restrictions shown on" [dvidshub.net/about/copyright](https://www.dvidshub.net/about/copyright).
- That page (checked 2026-10-07, now titled for the Department of War) says works of U.S. government employees are not eligible for copyright. It states no credit requirement. It asks all users to display the non-endorsement disclaimer, "requested" for non-commercial use and required for commercial use: "The appearance of U.S. Department of War (DoW) visual information does not imply or constitute DoW endorsement."
- BAYLINK shows that disclaimer in the image credit line, in both languages: "美国战争部（国防部）视觉资料的出现，不意味着也不构成战争部的认可" / "The appearance of U.S. Department of War (DoW) visual information does not imply or constitute DoW endorsement".
- The credit names the photographer, DVIDS and the public-domain status. It does not say "official"/"官方", so the site labels the photo "资料图 · 2024" / "Archive photo · 2024", not "官方图".
- Use is limited to editorial event surfaces: the event page, listing cards, calendar, planner and the home weekend card. Do not use it in BAYLINK ads, tester-recruiting promotion or fundraising; DVIDS treats those as commercial use and asks commercial users to obscure military markings. Publicity and privacy rights of anyone pictured are not waived; no person is identifiable in this frame.

## Processing

Pillow 12.3.0, run with `python -I`. Proportional resize only (LANCZOS), RGB, WebP quality 82, method 6. Each output is re-created as a fresh RGB image, so no metadata is written. No crop, colour edit, retouching or upsampling.

| File | Size | Bytes | SHA-256 |
| --- | --- | --- | --- |
| `public/guides/federal-pd/dvids-blue-angels-sffw-2024.webp` | 1280 × 853 | 58,096 | `c028bf636a0a7a30ae7286e43b8e8985cca1a4e384d81e13993c480ba1837462` |
| `public/guides/federal-pd/dvids-blue-angels-sffw-2024-small.webp` | 480 × 320 | 11,134 | `282f384943e529cb4bdc547e63f569bbd7cf67d722f45efadb1282a47f3990fb` |

## Visual check

The 2000w JPEG and both WebPs were opened and inspected before alt text and captions were written.

- Four Blue Angels jets (blue with yellow trim) fly left to right in a tight four-ship formation, trailing white smoke.
- In the frame they sit just below the Golden Gate Bridge deck, passing in front of one orange-red bridge tower.
- The Marin Headlands rise behind in haze. Two sailboats and a small motorboat are on the water.
- No people are identifiable.

The jets occupy about 48–69 % of the width and 60–73 % of the height. Centred crops at 16:9 (home card), 16:10 (detail page), about 2:1 (/this-week and calendar cards) and 4:5 all keep the jets and the tower. There is no per-image focal point (VISUAL-17); none is needed for this frame.

## Wording

- Caption (zh, source of the provenance label): starts with "2024 年 10 月 10 日". It says the photo is an archive photo of the practice flight on the day before the 2024 air show, not the 2026 show, and that 2026 performers, flight times and formations follow the official schedule. The 2024 air show ran October 11–13, 2024; October 10 was the Thursday practice day.
- Caption (en): "2024 archive photo: …", so the first year in either language is 2024.
- Alt text describes only what is visible.

## Not changed

- Share cards (`/weekly/*.png`, per-event cards) stay text-only. A photo share card is D5.
- Event fact files (`october-events.ts`, `autumn-release-events.json`, `october-2026-events-refresh.ts`) still carry their legacy `sf-wharf` image key; the verified override supersedes it.
- baylink-api needs no change. Its `data/planner-catalog.json` copy keeps the old image key, but its `lib/` never reads `imageKey`.
