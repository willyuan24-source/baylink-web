# September 23 community discovery release

Adds 31 sourced local entries: 20 events, 3 confirmed business openings, 5 offers or experiences and 3 practical-news guides. Updates Florecita's inspection/relocation status and Handroll Hawker's announced September 29 opening. Current catalog totals: 93 events, 55 offers, 14 opening records and 76 guides. Eighty-two events intersect October; the edition continues through October 31.

## Reader-facing changes

- More neighborhood events across San Francisco, East Bay, South Bay, Peninsula and North Bay, including Menlo Park storytelling, San José Mid-Autumn celebrations, Oakland Asian Cultural Center workshops, Sonoma cultural events, San Mateo Halloween and APAture film.
- Hey Yogurt San Mateo, CHICHA San Chen Pleasanton and Asia Live Valley Fair are confirmed open. Past grand-opening giveaways are explicitly expired; future announcements are not silently promoted to open.
- Offers retain actual dates and conditions: Berkeley tea BOGO, Onigilly anniversary bento, birthday BOGO, Cupertino tea-tasting reservations and AMC member discount days. Unconfirmed October tasting availability is marked for local checking.
- BART access/parking/service changes, SJ Access device-lending changes and SCCLD Sharks library cards have distinct sourced guides. Two clearly labelled fictional AI covers accompany the new guides.
- Calendar, event detail, My Week, itinerary validation and ICS export share confirmed occurrence dates. Nonconsecutive events no longer produce plans or calendar reminders on gap days. Backend recommendation and plan validation enforce the same dates.
- New entries are included in English dictionaries, crawlable detail pages, guide and planner catalogs, sharing cards and the sitemap. San Mateo and Sonoma city reference points are included in the event map.

## Verification

- Frontend: 454/454 tests passed; ESLint has zero errors and 46 existing warnings.
- Backend: 146/146 tests passed for the occurrence/date and catalog changes; 6/6 catalog tests passed after the final English catalog correction.
- Production build: 262 public HTML pages. All 238 share-card PNG dimensions and independently decoded direct-link QR codes passed verification.
- Browser checks: October 17 North Bay calendar and Sonoma marker/card filtering; Hey Yogurt opening detail; English SCCLD article, labelled cover and official sources.
- Source verification: public official Instagram posts plus merchant, venue, city and library pages. Xiaohongshu search required login, so no inaccessible notes were presented as verified sources.

## Evidence and asset records

- [Event sources](community-discovery-events-sources-2026-09-23.md)
- [Business and offer sources](community-discovery-business-sources-2026-09-23.md)
- [Public-service guide sources](community-discovery-guides-sources-2026-09-23.md)
- [New cover paths and exact built-in imagegen prompts](community-discovery-image-prompts-2026-09-23.md)

Backend commits: `7472b03` (catalog expansion and confirmed occurrence dates), `1d14b9e` (English catalog completion). Production health confirmed the latter commit before the website release.
