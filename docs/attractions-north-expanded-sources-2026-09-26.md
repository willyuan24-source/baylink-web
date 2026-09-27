# North Bay evergreen attraction expansion — verified 2026-09-26

Scope: two new guides and two Explore attractions. All listed pages were opened through the web research tool on the verification date. Route order, visit lengths, turnaround buffers, packing suggestions and shorter family versions are editorial advice, not published schedules. No exact fare or opening hour is frozen into the guides. These are evergreen guides without `editionMonth`.

## Point Reyes / Bear Valley

- [NPS trip ideas](https://www.nps.gov/pore/planyourvisit/tripideas.htm): Bear Valley visitor orientation, Earthquake Trail 0.6-mile loop and Divide Meadow 3.2-mile round trip. The lighthouse is a separate driving leg, not a required continuation.
- [NPS accessibility](https://www.nps.gov/pore/planyourvisit/accessibility.htm): Earthquake Trail has settled or tilted pavement and currently does not meet full accessibility criteria. Some users require assistance. Bear Valley to Divide Meadow is packed dirt with slopes over 5% and rocky sections; meadow toilets are not accessible. Visitor center has accessible facilities.
- [NPS fees](https://www.nps.gov/pore/planyourvisit/fees.htm): ordinary day entry, hiking and visitor-center/trailhead parking do not carry a park fee. Camping and special-use permits are separate.
- [NPS current conditions](https://www.nps.gov/pore/planyourvisit/conditions.htm): route readers to current road/trail information; an absence of recent reports is not an assurance of unchanged trail conditions.
- [NPS weather](https://www.nps.gov/pore/planyourvisit/weather.htm): coastal wind/fog and local variation support layers and a conservative return plan.
- [NPS visitor centers](https://www.nps.gov/pore/planyourvisit/visitorcenters.htm): official entry for current building operations. The text extraction exposes dynamic sections incompletely, so no fixed hours were transcribed.
- [NPS Bear Valley Trailhead](https://www.nps.gov/places/point-reyes-bear-valley-trailhead.htm): corroborates Divide Meadow distance, recommends the large gravel lot for hikers, and publishes coordinates `38.0396, -122.7998` for the **trailhead**, not the visitor center. Do not relabel that point as the building.

Editorial decisions: 2–3-hour short outing; optional 3–4-hour visit with Divide Meadow; each stop can be an endpoint. Directions use place searches, with official/on-site trails taking precedence. The guide does not promise that a paved trail is fully accessible.

## Angel Island

- [California State Parks park page](https://www.parks.ca.gov/?page_id=468): current service restrictions, separate state-park entry and museum information, ferry operators and park maps. On verification the page carried changing fire/service notices; the evergreen guide directs users to recheck instead of preserving short-lived status as permanent advice.
- [Visiting the island](https://www.parks.ca.gov/?page_id=1313): island accessible by boat; Ayala Cove is the landing/base. Immigration-station route via stairs is about 1 mile one way and approximately 140 steps. Supplies and concessions have seasonal constraints. Historical barracks and former-hospital museum are separate visitor experiences.
- [Tours and mobility](https://www.parks.ca.gov/?page_id=25767): stair-free immigration-station route is about 1.5 miles with steep hills. Park guidance specifically distinguishes power-wheelchair capability/battery and assistance that cannot necessarily carry power wheelchairs or visitors unable to transfer. Advance arrangements are needed; no on-demand access promise is made.
- [Golden Gate Ferry Angel Island service](https://www.goldengate.org/ferry/angel-island-ferry/): ferry price includes park admission; visitors are advised to arrange return tickets, since tickets are not sold on the island. Operator recommends arriving about 15 minutes before departure. Prices are deliberately linked, not transcribed.
- [Golden Gate Ferry route timetable](https://www.goldengate.org/ferry/route-schedule/angel-island-sf/): correct current San Francisco route URL, with day/direction selection. Recheck each travel date; no fixed departure times copied.
- [Angel Island Tiburon Ferry calendar](https://angelislandferry.com/schedule): separate operator/date calendar for Tiburon departures. Do not assume interchangeable tickets or guaranteed backup service.

Editorial decisions: 4–5 hours **on the island**, ferry time additional; focus on the immigration-station out-and-back, leaving summit/full circuit for a different visit. Thirty minutes back at Ayala Cove is an editorial target, separate from the ferry operator's boarding advice. Families can choose a full short visit around Ayala Cove.

## Photograph sources and processing

All new photographs were downloaded from the original Wikimedia Commons media URLs supplied by its `imageinfo` API. File-page metadata was inspected for the actual photograph license, creator, capture date and place. New files were rotated to EXIF orientation, resized to 1400 and 480 pixels wide, and encoded as WebP using the existing bundled Sharp runtime. No image generation or scene edits. Assets retain the source licenses; display credit explicitly identifies resize/compression. `src/data/attractions-expanded-coast-media.json` preserves original URLs, source pages, license URLs and capture/review dates. The exact visible Chinese media text is translated in `attractions-north-expanded-en.json`.

| Key | Source | Creator / license | Capture | Processing |
|---|---|---|---|---|
| expanded-point-reyes | [Bear Valley Visitor Center plaque and flagpole](https://commons.wikimedia.org/wiki/File:Bear_Valley_Visitor_Center_plaque_and_flagpole.jpg) | Harry Cutts / [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | 2021-11-26 | 1400 × 1867 and 480-wide WebP; portrait preserved with `fullFrame` |
| expanded-angel-island | [Ayala Cove (40173)](https://commons.wikimedia.org/wiki/File:Ayala_Cove_(40173).jpg) | Rhododendrites / [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | 2017-07-14 | 1400 × 820 and 480-wide WebP; bay scenery around Ayala Cove, not a claim of a dock close-up |
| expanded-dolores-park | [Dolores Park May 2025](https://commons.wikimedia.org/wiki/File:Dolores_Park_May_2025.jpg) | Alexwennerberg / [CC0](https://creativecommons.org/publicdomain/zero/1.0/deed.en) | 2025-05-24 | 1400 × 1050 and 480-wide WebP |
| expanded-lands-end | [Lands End Park, coastal trail and stairs, SF](https://commons.wikimedia.org/wiki/File:Lands_End_Park,_coastal_trail_and_stairs,_SF.jpg) | Another Believer / [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | 2018-09-28 | Reused correct-place 1280-wide and 480-wide files from `sf-landmark-photo-assets.json`; not previously a guide cover |
| expanded-sutro | [San Francisco (CA, USA), Sutro Baths -- 2022 -- 3045](https://commons.wikimedia.org/wiki/File:San_Francisco_(CA,_USA),_Sutro_Baths_--_2022_--_3045.jpg) | Dietmar Rabich / [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | 2022-07-01 | Reused correct-place 1280-wide and 480-wide files from the same manifest; supplementary image |

The three new originals were visually inspected before delivery. The generic Commons `Earthquake Trail.jpg` search result depicts Hawaii and was explicitly rejected; it is not used anywhere in these new assets.
