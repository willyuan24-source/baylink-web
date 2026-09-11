# September openings verification — 2026-09-11

## Publication scope

`src/data/september-openings.ts` exports `SeptemberOpening` and `septemberOpenings`: six distinct entries, **one verified September opening**, **four opening/relocation/reopening announcements**, and **one opening celebration at an already operating café**. The latter is not evidence of its first trading date. No entry is a firsthand food review. Do not auto-promote announcements to `open` when their estimated date passes.

## Evidence ledger

| Entry | Decision and evidence | Source |
|---|---|---|
| Sergeant Ma | First public opening: 2026-09-09. The property owner's Aug. 27 press release announced that date; SFGATE's Sept. 10 report confirms that it opened. | [McCarthy Cook / Hi Neighbor press release](https://www.mccarthycook.com/china-basin-news/what-comes-after-live-work-play-south-coast-metro-has-some-observations/), [SFGATE follow-up](https://www.sfgate.com/food/article/sergeant-ma-china-basin-22411402.php), [restaurant](https://www.sergeantma.com/) |
| La Boulangerie at ERIA Marina | Official locations page says “NOW OPEN!”; a Sept. 12, 10:00–14:00 celebration is advertised. First trading date is not established. The pastry offer requires an espresso purchase. | [Official locations](https://www.laboulangeriesf.com/locations-hours), [event listing](https://www.sfstation.com/brunch-soir-e-e15773232), [organizer event URL](https://partiful.com/e/0iThOnsLM9vFCisWbwag) |
| Florecita Panadería | Relocation, not a new business. July coverage gave Sept. 12; the newer Aug. 31 Standard article gives Sept. 20. Keep the conflict visible and classify as announced. | [Mission Local earlier date](https://missionlocal.org/2026/07/the-mission-is-losing-a-plant-store-and-a-anaderia-is-on-the-move/), [Standard updated date](https://sfstandard.com/2026/08/31/new-sf-restaurants-bakeries/), [brand](https://www.florecitapanaderia.com/) |
| Handroll Hawker | Eater's Sept. 9 report gives late September, without a day. Official site confirms the address and menu concept, but does not prove service has begun. | [Eater current forecast](https://sf.eater.com/openings/213611/san-francisco-bay-area-anticipated-fall-restaurant-bar-openings-2026), [official menu/concept](https://www.handrollhawker.com/) |
| Woods, Fisherman's Wharf | The Standard gives late September for an extended pop-up. Official website currently lists the group's other venues, so no confirmed opening date or operating hours are published here. | [Standard forecast](https://sfstandard.com/2026/08/31/new-sf-restaurants-bakeries/), [brand locations](https://www.woodsbeer.com/) |
| Hedley Club & Palm Court | Eater's Aug. 25 report describes the renovated spaces and September forecast. No verified service date. Classify as reopening. Tejer is a separate December project. | [Eater feature](https://sf.eater.com/restaurant-news/213458/hedley-club-palm-court-hotel-de-anza-opening-san-jose), [group](https://calindiacollective.com/), [hotel](https://www.hoteldeanza.com/) |

Short evidence excerpts (not reviews): SFGATE, “opened Sept. 9”; Standard, “Opening Sept. 20”; Eater fall preview, “Opening: Late September”; Eater Hedley feature, “debuts in September 2026.” The editorial advice and visit suggestions in the data are BAYLINK's own planning suggestions.

## Media handoff

Exact image URLs, source pages, attributions and reuse notes are in `output/september-openings-media-candidates.json`. No image files were downloaded in this research task.

- Sergeant Ma: official opening press image, Hardy Wilson, hosted by McCarthy Cook.
- La Boulangerie: ERIA Marina image from its own location listing; event poster is an alternate.
- Handroll Hawker: official sushi-and-bridge campaign photograph; label promotional image, not restaurant interior.
- Florecita: official homepage's `florecita_home_pandulce_1748971496.png`, retrieved from the public Square Online page data; image HEAD returns 200/image/png. Brand pastry file photo, not the new 23rd Street premises. [Official page](https://www.florecitapanaderia.com/).
- Woods: official Community Club's `April_ClubRelease_MezcalLocalHoney_Mourvedre_006.jpg`, image HEAD returns 200/image/webp. Brand wine/beer file photograph of a past release, not Fisherman's Wharf premises or its current menu. [Official page](https://woodsbeer.squarespace.com/community-club).
- Hedley Club: no usable merchant-hosted image verified; hotel website could not be reached. The earlier Eater/Gino De Grandis candidate has been removed. Use an original Art Deco lounge/palm-court concept illustration, clearly labeled as an illustration rather than an image of the restaurant.

All five retained candidates originate from merchant or property publicity, with source links and credits. They are collected for limited editorial introductions, not represented as open-license or cleared for unrestricted reuse. Attribution does not itself grant a reproduction license. Media-owned photographs from the Standard and Eater have been removed from the download candidates. Do not use a different branch's old photos to depict a not-yet-open venue.

### Woods location distinction

[SFist's Sept. 2 report](https://sfist.com/2026/09/02/aliotos-plaza-unveiled-at-fishermans-wharf-with-new-seating-beer-concession/) describes a temporary Woods concession at the newly opened Alioto's Plaza. That is distinct from the planned former Fishermen's Grotto taproom at **2847 Taylor Street** in the data. The plaza concession is not proof that the indoor venue is open.

## Exclusions and unresolved leads

- **Tartine Mill Valley** is an August opening (Aug. 19 grand opening), not September. [Marin Magazine author listing](https://muckrack.com/mimi-towle) and [August roundup](https://www.finedininglovers.com/explore/lists/best-restaurant-openings-northern-california-august-2026).
- **Cinderella Mission / The Mess Hall / Le Mil's** appear in the August opening roundup; do not relabel them because a September article recommends them. [August roundup](https://www.finedininglovers.com/explore/lists/best-restaurant-openings-northern-california-august-2026).
- **Black Jet Luncheonette**: Eater's forecast is late September **or early October**. Keep outside the confirmed September list. [Fall preview](https://sf.eater.com/openings/213611/san-francisco-bay-area-anticipated-fall-restaurant-bar-openings-2026).
- **LUNA Los Altos**: an early-September target appears in secondary real-estate blogs, but the original current article could not be reliably retrieved and the official locations page lists Alameda and Pruneyard only. No assertion that Los Altos is open. [Official locations](https://www.lunamexicankitchen.com/hours-and-locations/).
- **Raising Cane's, Fisherman's Wharf**: conflicting aggregator targets (Aug. 24 / Sept. 21); no verified official current date found. Excluded.
- Search results also contained generated aggregation and old posts with newly crawled dates. Neither a crawl date nor a restaurant-guide update date is an opening date.

## Retrieval notes

The restaurant and property press URLs for Sergeant Ma were verified by direct HTTP fetch (200) where the web reader failed. Florecita and Black Jet homepages return HTML but no useful readable text to the web extractor. Hotel De Anza timed out during this check, and the Partiful reader was unavailable; the La Boulangerie facts above rely on its readable official locations page plus the dated SF Station listing. No paywall or access control was bypassed.
