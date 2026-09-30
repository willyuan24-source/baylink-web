# BAYBAY neighborhood planning coverage — source audit

Checked on 2026-09-29. These records support editable drafts, not live opening, reservation, queue, ticket or route guarantees. `validThrough: 2026-10-31` is BAYLINK's editorial review cutoff; the venues have not promised unchanged hours through that date.

## Scope and result

- Added 9 places; the planning catalog now has 77 places.
- Added exact venue evidence to 2 existing Larkspur openings: Anya Hindmarch and Varley.
- Places with both a venue pin and structured hours increased from 9 to 20. This is data coverage, not a claim that every place can be combined on every date.
- Five clusters now have at least 3 nearby recorded stops: San Francisco waterfront, downtown Oakland, downtown San José, Larkspur's Marin Country Mart and downtown Redwood City.
- Runtime coverage tests check 2026-10-03, 2026-10-04 and 2026-10-07. In each of the five regions, at least two **different ordered stop sequences** make a three-stop half-day draft with the walking filter. The default travel allowance also produces at least two different half-day sequences of two or more stops per region/date.
- Walking here means the existing same-city, up-to-2-km straight-line selection plus a 30-minute allowance per connection. The default allowance is 45 minutes. Neither measures a pedestrian route or live travel time.

## Added places and operating evidence

| Record | Primary source | Recorded ordinary hours and limits |
| --- | --- | --- |
| `shop-book-passage-ferry-building` | [Ferry Building merchant page](https://www.ferrybuildingmarketplace.com/shops/book-passage/) | Mon–Fri 10:00–17:00, Sat 09:00–17:00, Sun 11:00–17:00. Current shop #37A. Author events and purchases are separate. |
| `venue-oakland-main-library` | [Oakland Public Library](https://oaklandlibrary.org/locations/XXA/) | Mon–Thu 10:00–20:00, Fri 12:00–17:30, Sat/Sun 10:00–17:30. Public reading access; history center and room reservations have separate rules. |
| `venue-sj-king-library` | [San José Public Library](https://www.sjpl.org/locations/king/) | Mon–Thu 08:00–20:00, Fri/Sat 08:00–18:00, Sun 13:00–18:00. Children's room opens at 10:00 Mon–Sat and 13:00 Sunday. Special collections, events and the AI Center are not presumed accessible throughout these hours. |
| `restaurant-farmshop-marin` | [Marin Country Mart's Farmshop page](https://marincountrymart.com/farmshop) | Mon–Thu 11:30–21:00, Fri 11:30–21:30, Sat 10:30–21:30, Sun 10:30–21:00. The reservation/menu link is available; no booking or table availability was checked. |
| `cafe-rustic-bakery-larkspur` | [Marin Country Mart's Rustic Bakery page](https://marincountrymart.com/rustic-bakery) | Daily 07:00–17:00, specifically 2017 Larkspur Landing Circle. Food, seating and queues remain unconfirmed. |
| `shop-copperfields-larkspur` | [Marin Country Mart's Copperfield's page](https://marincountrymart.com/copperfields-books) | Mon–Sat 10:00–18:00, Sun 10:00–17:00. Ordinary browsing, not a scheduled author event. |
| `venue-san-mateo-history-museum` | [San Mateo County Historical Association](https://historysmc.org/plan-your-visit/) | Tue–Sun 10:00–16:00, last entry 15:45; Monday closed. Published standard adult $6, seniors/students $4, children 5 and under free. The scalar admission field stays unknown because the user's ticket categories are unconfirmed. Archives and group visits have separate appointment rules. |
| `cafe-coupa-marston` | [Coupa's Marston location page](https://www.coupacafe.com/Locations/redwood-city-marston) | Daily 07:00–17:00 at 695 Main Street. Also returned by the operator's [securetree location page](https://coupacafe.app.securetree.com/Locations/redwood-city-marston). |
| `venue-redwood-city-library` | [City library hours](https://www.redwoodcity.org/departments/library/locations-and-hours) | Mon–Thu 10:00–20:00, Fri/Sat 10:00–17:00, Sun 12:00–17:00. Date overrides: 9/29 opens 12:00, 10/19 closed for staff training. Local History Room requires an appointment. |

Public-library ordinary entry is recorded as free; printing, room use, parking and other services are not. Food and retail records retain unknown spending, rather than recording a meal or purchase as free. The museum's different published ticket categories remain visible in its summary and source note.

## Coordinate provenance

No viewport center is used as a destination pin. The named destination or JSON-LD geo object was inspected separately from map camera coordinates.

| Venue | Latitude, longitude | Evidence |
| --- | --- | --- |
| Ferry Building, used for Book Passage | 37.7954425, -122.3936136 | [Official visit page](https://www.ferrybuildingmarketplace.com/visit/) directions destination (`!1d-122.3936136!2d37.7954425`). This is explicitly labeled the **building**, not the exact shop entrance. Use [the official building map](https://www.ferrybuildingmarketplace.com/map/) and #37A inside. |
| Oakland Main Library | 37.80094379066671, -122.26367525522537 | Official location page's JSON-LD `latitude`/`longitude`. |
| San José King Library | 37.3356906, -121.8852558 | Official location page's JSON-LD `latitude`/`longitude`. |
| Farmshop Marin | 37.9473194, -122.5088889 | Official listing links to [this named map pin](https://maps.app.goo.gl/XhzefoYFfaU3kEwo9); used the destination `!3d`/`!4d`, not the `@` viewport center. |
| Rustic Bakery Larkspur | 37.9470678, -122.5095934 | Official listing's [named map pin](https://maps.app.goo.gl/1j8VNSq4zW4aYkd78). |
| Copperfield's Larkspur | 37.946846, -122.5090725 | Official listing's [named map pin](https://maps.app.goo.gl/xxKogxzEu17tvHuq8). |
| Anya Hindmarch Larkspur | 37.947038, -122.509429 | [Official opening page](https://marincountrymart.com/anya-hindmarch-gifting-agency) links to [the named map pin](https://maps.app.goo.gl/djhuRrhyn2M5q1K19). Existing opening record and hours are retained. |
| Varley Larkspur | 37.9468868, -122.5088522 | [Official listing](https://marincountrymart.com/varley) gives 2409 Larkspur Landing Circle and a destination map link. Checked the named Varley destination at that address, [map CID 5315222296486893084](https://www.google.com/maps?cid=5315222296486893084). |
| San Mateo County History Museum | 37.486708, -122.2296696 | [Official directions page](https://historysmc.org/maps-directions/) embeds a map for 2200 Broadway. Decoded the page's `vc_raw_html` iframe and inspected the named address marker, not the embedded camera coordinate. |
| Coupa Marston | 37.4878393, -122.2261795 | The official location page's iframe identifies Coupa Cafe – Marston at 695 Main Street. Used the named destination's coordinates; its viewport longitude differs. |
| Redwood City Downtown Library | 37.4840501, -122.2273354 | Matched the city's published 1044 Middlefield Road address to the named Redwood City Public Library destination, [map CID 2747244861800554380](https://www.google.com/maps?cid=2747244861800554380). The source explicitly links this map rather than claiming the coordinates came from city JSON-LD. |

Marin Country Mart's [parking rules](https://marincountrymart.com/contact-1) impose a posted three-hour limit for its regular patron parking; a plan lasting longer must use an appropriate alternative. These are not ferry parking spaces. The venue summaries do not represent parking as an unlimited free benefit.

## Sources not promoted into planning data

- Blue Bottle's [property merchant page](https://www.ferrybuildingmarketplace.com/shops/blue-bottle-coffee/) lists operating hours, while the [brand location page](https://bluebottlecoffee.com/us/eng/cafes/ferry-building) returned `closed` for all seven days. This may reflect stale content or rendering, so no assumption about which page is correct was made. It was excluded from this expansion.
- The Tech's [daily schedule](https://www.thetech.org/visit/daily-schedule/) covered September 23–29. Its [visit page](https://www.thetech.org/visit/) says dates and hours vary seasonally. September's daily timetable was not extrapolated into October.
- Hiller's [visit page](https://www.hiller.org/visit/) publishes an October 3 early closure at 15:00 despite its ordinary 10:00–17:00 schedule. This candidate was not needed for the chosen downtown Redwood City cluster and was not added.
- Margaux's hours are already recorded, but no sufficiently clear individual destination pin was obtained in this pass. Its coordinates remain unknown; another store's coordinates were not reused.

## Verification

`tests/planner-neighborhood-coverage.test.ts` exercises the actual catalog and outing engine, deduplicates ordered stop sequences, checks same-city/venue pins, hours evidence, straight-line distance and timeline conflicts, and preserves the museum's Monday closure, 15:45 cutoff and library staff-training closure.

`tests/planner-copy.test.ts` verifies that all official time notes have English versions and retain numeric dates, times, prices and conditions. New place titles and summaries also have English dictionary entries. The two test files passed 7/7 locally after the expansion.
