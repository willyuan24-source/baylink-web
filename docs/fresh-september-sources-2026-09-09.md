# September 2026 additions: sources and image provenance

Checked on **2026-09-09**. These are editorial guides, not firsthand event reports. No social-media-only promotion was treated as a confirmed 2026 offer.

## Coastal Cleanup Day

Guide: `bay-area-coastal-cleanup-2026-guide`.

- [California Coastal Commission](https://www.coastal.ca.gov/publiced/ccd/ccd.html): the 42nd California Coastal Cleanup Day is **Saturday, September 19, 2026, 9 a.m.–noon**. Some local sites have other dates/times. Follow site registration instructions and complete the requested waiver. The page provides Traditional Chinese paper waivers as well as English/Spanish options. **September 26 is not the statewide 2026 cleanup date.**
- [Golden Gate National Parks Conservancy: Ocean Beach](https://www.parksconservancy.org/events/ocean-beach/coastal-cleanup-day-2026-ocean-beach): **September 19, 9 a.m.–noon; Stairwell 17**. Registration is required. Groups of five or more need advance arrangements. Bring reusable supplies if available; the organizer also has supplies. Closed-toe shoes, layers, water and sun protection are requested.
- [Organizer registration form](https://parksregistration.tfaforms.net/70?drp=142): site/date selection and volunteer details, without a ticket purchase or payment step in the public form. This is not an explicit published zero-fee statement, so the monthly free-event card uses Treasure Island instead. No availability count is promised.
- [SF Environment: Treasure Island](https://www.sfenvironment.org/events/coastal-cleanup-day-treasure-island): **September 19, 10 a.m.–noon**; **free**, preregistration required. Meets at Treasure Island Museum for Cityside Park/Clipper Cove. Organizer explicitly says wheelchair accessible and suggests Muni 25, ferry or carpool. Article asks readers with access needs to confirm the work area, rather than infer that every shoreline surface is accessible.
- [Save The Bay calendar](https://savesfbay.org/calendar/): MLK Regional Shoreline, Oakland, **September 19, 9 a.m.–noon**. Its program rules: under 18 signed in by parent/guardian; under 13 also accompanied. These rules are not generalized to every organizer.
- [East Bay Regional Park District](https://www.ebparks.org/get-involved/volunteer/coastal-cleanup): **September 19, 2026**, multiple locations; registration requested, walkups allowed; groups of 10+ require contact after registering. No promise of free parking, prizes or a service-hours certificate is made.

Monthly event export: `freshSeptemberEvents` in `src/data/fresh-monthly-events.ts`; single **Treasure Island** entry, September 19, **10 a.m.–noon**, with the detailed cleanup guide as `relatedGuideSlug`. Its free status is explicit on the SF Environment page, and it uses the matching Treasure Island photo.

## Half Moon Bay pumpkin season

Guide: `half-moon-bay-pumpkin-season-2026-guide`. This is a September farm outing **and clearly marked October preview**, not an October festival mislabeled as happening now.

- [Lemos Farm 2026 pumpkin page](https://www.lemosfarm.com/pumpkin-patch): **September 5–November 15, 2026**. September weekends and selected weekdays; October daily; November weekends. Buy for the actual available date/time. Address 12320 San Mateo Road, Half Moon Bay.
- [Official 2026 SimpleTix listing](https://www.simpletix.com/e/2026-fall-pumpkin-patch-tickets-279454), reached from the farm: current displayed range **$12.99–$37.99**, not a fixed every-date price. Parking included. Pumpkin picking, gem mining, face painting, animal feed, concessions and other named activities are extras. Gold Pass pony rides list ages 18 months and up, up to 70 lb. The article tells readers to verify each pass rather than repeat contradictory generalized weight categories on old FAQ pages.
- [Lemos ticket policy](https://www.lemosfarm.com/tickets): children **under 14 months** do not need a pass. Sales final/non-refundable; different-day requests possible. The separate FAQ says “14 months and under,” so the article uses the ticket page’s narrower wording and requests verification at the boundary. Walk-in admission is capacity dependent; no availability or discount percentage is promised.
- [Festival home page](https://www.hmbpumpkinfest.com/): **October 17–18, 2026, 9 a.m.–5 p.m., Main Street**. World pumpkin weigh-off **Monday, October 12**, IDES Grounds.
- [Festival update note](https://www.hmbpumpkinfest.com/event-details/about-the-event): the page explicitly says details are still from **2025 although dates are correct for 2026**, and to return 3–4 weeks beforehand. The article therefore does **not** copy parade times, the vendor list, parking prices, shuttle plans or contest details as confirmed 2026 information. It explains the historical/current free-admission format without promising that all activity costs have been finalized.
- [SamTrans routes](https://www.samtrans.com/routes): linked for destination-specific trip planning. No unverified route number, service frequency or last departure is prescribed.

Excluded: Arata Pumpkin Farm's current front page still refers to Friday October 31 and Sunday November 2, matching 2025, not 2026. Its older generic opening pattern was not promoted as verified 2026 season news. No old Lemos blog ticket price was reused.

## Images

All four photographs have different content and are downloaded as local WebP assets with a separate **480 px** responsive derivative. Full assets are 1400 px wide, except the 1280 px original pumpkin-patch photo, which was not enlarged. Changes: resize/compress; cards may crop using CSS. Actual pixels were visually checked in `output/fresh-september-contact-sheet.png`.

The image licenses were checked on individual Commons file pages, not inferred from the general Commons footer. Photographer credit, original file page and license link are included in `src/data/fresh-september-media.json`. BY-SA derivative retains the same BY-SA 4.0 license. No endorsement is implied.

| Key | Source and author | License | Photo date / use boundary |
| --- | --- | --- | --- |
| `fresh-ocean-beach` | [Seal Rocks, Ocean Beach, San Francisco](https://commons.wikimedia.org/wiki/File:Seal_Rocks,_Ocean_Beach,_San_Francisco.jpg), **© Radomianin / Wikimedia Commons** | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | August 21, 2019. North-end coastline, not the 2026 cleanup or Stairwell 17 meeting point. Full required credit line retained. |
| `fresh-treasure-island` | [Treasure Island Shoreline Sunset - 2025 (1)](https://commons.wikimedia.org/wiki/File:Treasure_Island_Shoreline_Sunset_-_2025_(1).jpg), **9yz** | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | May 27, 2025. Island setting, not a promised work area or event photo. |
| `fresh-pumpkin-parade` | [Half Moon Bay Art & Pumpkin Festival Great Pumpkin Parade](https://commons.wikimedia.org/wiki/File:Half_Moon_Bay_Art_%26_Pumpkin_Festival_Great_Pumpkin_Parade.jpg), **MegalithAgency** | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | October 2025. Archived festival scene; 2026 lineup remains subject to official publication. |
| `fresh-hmb-pumpkins` | [Pumpkin Patch](https://commons.wikimedia.org/wiki/File:Pumpkin_Patch.jpg), **JR Conlin** | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | October 9, 2004. Genuine Half Moon Bay patch, explicitly not identified as Lemos Farm or a 2026 setup. |

## Integration handoff

- Import `freshSeptemberGuides` from `guides-fresh-september.ts` and add to the shared guides array.
- Register `fresh-september-media.json` in the media registry and the existing media integrity test asset list.
- Cover/inline mappings:
  - cleanup → `fresh-ocean-beach`, `fresh-treasure-island`.
  - pumpkin season → `fresh-pumpkin-parade`, `fresh-hmb-pumpkins`.
- Import `freshSeptemberEvents` into the monthly event list.
- Merge **new** entries from `output/fresh-september-en.json`; preserve established translations for pre-existing shared strings unless deliberately changing terminology. Both guides, the event and image alt/caption/credit strings are covered.
- Add both guide slugs to hosting/prerender routing and sitemap; regenerate both language AI catalogs after translations are merged.
