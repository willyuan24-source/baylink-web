# Additional Bay Area benefits and openings — checked 2026-09-15

This batch adds seven benefits and five openings beyond the existing 26 offers and six opening entries. `verifiedAt` is the editorial check date, not an expiration date. Recurring benefits have no invented October deadline. No image was assigned without an exact verified match.

## Benefits

| ID | Official evidence | Scope and editorial treatment |
| --- | --- | --- |
| sonoma-county-museum-family-oct10 | [Museum calendar](https://museumsc.org/events/), [visit](https://museumsc.org/visit/) | Calendar explicitly lists October 10, 2026, 11 AM–1 PM, Free Family Day. Detail link could not be retrieved. Copy only commits to the listed family-program window, and does not claim every hour is free or invent activities. |
| sfmoma-family-oct25 | [SFMOMA free days](https://www.sfmoma.org/free-days/) | October 25 explicitly confirmed. One child/teen age 18 or younger permits up to TWO adults free general admission; surcharge exhibitions excluded. Tickets released two weeks ahead, program not yet announced. No adult-only free-day claim. |
| cantor-stanford-free | [Current museum visit page](https://museum.stanford.edu/visit) | Free public admission; groups of 10+ register. Current venue page says closed Tuesday/Wednesday and open Monday. Older Stanford event-directory text has conflicting hours/reservation language; the current museum page governs. Parking/food not included. |
| sfpl-radon-detector-loan | [SFPL program announcement](https://sfpl.org/releases/2026/07/15/free-radon-detector-loan-program-promote-home-safety) | Free device loans with an SFPL card, maximum 21 days, online holds, all locations, first come first served. Not a gift; must return. The August lecture in the same article is expired and was excluded. No medical interpretation added. |
| berkeley-tool-lending | [Borrowing requirements](https://www.berkeleypubliclibrary.org/locations/tool-lending-library/borrowing-tools), [inventory](https://www.berkeleypubliclibrary.org/locations/tool-lending-library/tools), [library card policy](https://www.berkeleypubliclibrary.org/library/your-card) | Berkeley residents/property owners OVER age 18, separate address/ownership verification, borrowing paperwork, maximum 10 items. A general California library card is not enough. Equipment is borrowed, not given away. |
| ikea-emeryville-as-is-wednesdays | [Emeryville store terms](https://www.ikea.com/us/en/stores/emeryville/) | Additional 10% off marked As-is goods on Wednesdays, only this store and IKEA Family members. No stacking, prior purchases, online use or As-is returns. October 7/14/21/28 are derived from the weekly rule. No published end date. The separately advertised free kids meals end September 30 and were not extended into October. |
| poppy-claro-doggie-dinners-fall | [Restaurant fall announcement](https://www.poppyandclaro.com/) | $6 three-course DOG meal on patio Fridays 5–8 PM, weather permitting. Official copy explicitly extends into fall. October 2/9/16/23/30 derived from Fridays; no final end date published. Human meals are not included. |

## Openings

| ID | Evidence | Status and date treatment |
| --- | --- | --- |
| kaiyo-handroll-union | [KAIYŌ official events](https://www.kaiyosf.com/events) | September 11, 2026 grand opening at 1838 Union Street, with current nightly service invitation. `open`, `opening-celebration`; no first-service date inferred. Old brand handroll landing page contains inconsistent 2025/2026 coming-soon copy and was not used. |
| mess-hall-presidio-breadwinner | [Venue](https://www.messhallpresidio.com/), [Presidio 2026 announcement](https://presidio.gov/about/press/whats-new-at-the-presidio-of-san-francisco-in-2026) | Official indexed venue text says NOW OPEN, currently Breadwinner from 11 AM to close, 201 Halleck Street. Boda and Dayboat Seafood remain coming soon. Park source establishes the 2026 project. No first-service date asserted. Venue direct text extraction is sparse, but official indexed content was inspected in full. |
| broken-dreams-oakland | [Official contact page](https://www.brokendreamsoakland.com/contact), [menu/home](https://www.brokendreamsoakland.com/) | Official page explicitly states opened August 10, 2026. 1312 Broadway. Weekends temporarily closed. Same page conflicts between noon and 11 AM opening; card explains the discrepancy and gives restaurant phone rather than inventing a resolved time. [Nosh](https://richmondside.org/2026/09/04/east-bay-open-laderach-angelas-broken-dreams-balompie/) independently agrees with August 10. |
| hijau-san-jose-storefront | [Indonesian consulate firsthand report](https://kemlu.go.id/id/sanfrancisco/berita/umkm-indonesia-naik-kelas-di-silicon-valley-kjri-san-francisco-dorong-hijau-coffee-jadi-jembatan-promosi-indonesia-di-san-jose?type=publication), [performing ensemble](https://pusakasunda.org/performances/), [brand](https://www.wearehijau.com/) | Consulate records September 5, 2026 permanent-store inauguration with local officials. Performer lists September 5 grand opening, 1–1:30 PM. `open`, `opening-celebration`, no first-service date inferred. Official Santa Clara County food-facility results independently show Hijau Coffee at 1432 W San Carlos #70. Brand URL was found via its linked profile; direct retrieval returned 502, so operating hours are not promised. Consulate indexed article was read; direct renderer returns little text. |
| marufuku-burlingame-announced | [Brand location page](https://www.marufukuramen.com/burlingame), [directory](https://www.marufukuramen.com/locations) | Both explicitly say Coming Soon. No opening date or street address published. `announced`, no `openedOn`, no claim it will open by October. Unknown street address is displayed clearly rather than guessed. |

## Rejected or limited leads

- Poppy & Claro and Entre Comales are not newly opening in autumn 2026; aggregator date claims conflict with earlier reporting. Only Poppy's explicitly current fall benefit was retained.
- Saints Smokehouse predates the late-summer opening window and has inconsistent reported soft-opening milestones. Excluded from this recent batch.
- BitterBuck: local reporting says September 4 soft opening while official landing page still says coming soon. Excluded pending a consistent primary confirmation.
- Haru: several secondary sites disagree on opening day; excluded rather than repeat an uncertain date.
- Marufuku Palo Alto is already an established listed location; the new announced location is Burlingame.
- No SFMOMA first-Thursday or community-day date was invented. Its current official page lists the next community day as TBD.

## Deliverables

- `src/data/october-offers-extra.ts`: `additionalOctoberOffers` and `officialSources`; offers include explicit `verifiedAt` via the assignable `VerifiedExtraOffer` subtype.
- `src/data/october-openings-extra.ts`: `additionalOctoberOpenings`, existing `SeptemberOpening` shape.
- `src/data/october-offers-extra-en.json`: exact normalized English mappings, including source metadata descriptions.
- `src/data/october-openings-extra-en.json`: exact English mappings including the unpublished-address label.

All eligibility, purchase and reservation limits remain visible. Dated entries expire after their event day; standing services remain standing services. Integration and shared display changes belong to the root task.
