# Peninsula and South Bay events and openings — checked 2026-09-27

Scope: four new October event cards (two per region) and two recently opened restaurant cards (one per region). Existing region-tagged objects across `src/data/*.ts` were inspected with the TypeScript AST before selection; these IDs and programs were not already listed. No media downloaded; existing editorial image keys are used.

## CuriOdyssey First Friday Nights — October 2

- [Official dated event](https://curiodyssey.org/event/first-friday-nights-23/2026-10-02/) — opened successfully; October 2, 17:00–20:00. Year is explicit in the dated calendar URL.
- [Official program](https://curiodyssey.org/exhibits-events/first-friday-nights/) — opened successfully; current October Spooky Science theme, animal presentations, Casa Círculo Cultural collaboration, Fernando Escartiz alebrijes, pumpkin experiments and fossil cleaning. Non-member and member ticket links are separate.
- [Directions](https://curiodyssey.org/visit/directions/) — opened successfully; 1651 Coyote Point Drive inside Coyote Point Recreation Area.
- The linked [general ticket page](https://7050.blackbaudhosting.com/7050/page.aspx?pid=196&tab=2&txobjid=56542d93-ca3c-4788-bd68-a9e158280363) opened showing a stale February 6 selection, despite the current event page. Another indexed ticket URL showed October 2 in search but an old September selection when opened. Therefore **no exact ticket prices, ticket availability or sold-out claim is published**. The card instructs readers to select October 2, 2026 or contact the venue. The general paid classification is supported by the official ticket types. Park entry fees and evening exit are checks to make, not an assertion about a particular charge or closing time.

## Hiller Halloween Paint-A-Plane — October 24–25

- [Official October calendar](https://www.hiller.org/events/category/event/2026-10/) — official indexed contents inspected; explicitly lists October 24 and 25, each 10:00–12:00. Direct open returned an internal error.
- [October 24 event](https://www.hiller.org/event/paint-a-plane/2026-10-24/) — official indexed contents inspected in a targeted search; date/time, included-with-admission statement and Halloween activity list visible. Direct opens returned an internal error. [October 25 dated event](https://www.hiller.org/event/paint-a-plane/2026-10-25/) returned 403.
- [General information](https://www.hiller.org/visit/general-information/) — official indexed contents inspected: free museum parking; approximately one-mile walk from San Carlos Caltrain over Highway 101; admission and accessibility information.
- The repeating event body retains an inconsistent “Sunday October 24” in its old March–September section. The specific Halloween section correctly lists Saturday October 24 and Sunday October 25; the dated event metadata and October monthly calendar corroborate those dates. Only the corroborated Halloween dates are used. Activities such as outdoor painting and inflatables are weather dependent. No old PDF pricing or historical holiday dates are used.

## SJMA Reimagining Our Waterways — October 16–17

- [Official event](https://sjmusart.org/reimagining-our-waterways) — opened successfully; advance registration required, $20 general / $15 member, catered lunch and museum admission included. Main first-day program 09:30–17:00 at 110 S Market Street; networking reception follows. Day two 10:30–14:00 at Coyote Creek, meeting location to be announced.
- [Official calendar](https://sjmusart.org/calendar) — opened successfully and establishes the 2026 year.
- [Official linked ticket page](https://52102.blackbaudhosting.com/52102/tickets?tab=2&txobjid=8d20eb6d-d23c-4fc8-807f-2706cafffad5) — opened successfully; $20 general ticket, October 16 with 09:00–18:00 envelope. Card distinguishes the main program from ticket/check-in timing and directs registrants to their confirmation. No transport between venues is promised; accessibility and meeting-point questions are explicitly left for the organizer.

## SJMA Día de los Muertos Community Day — October 24

- [Official announcement](https://sjmusart.org/programs-at-sjma/community-days/dia-de-los-muertos) — opened successfully; October 24, 2026, 11:00–16:00, free admission all day. Preregistration speeds check-in; walk-ins welcome. Performance list, artmaking list and map are still “Coming soon.” Card does not invent them.
- [Getting Here](https://sjmusart.org/visit/getting-here) — opened successfully; 110 South Market Street with transit and parking links. Official event also points to ParkSJ and accessibility equipment at admissions.
- Ignore the event page's stale exhibition reference to an exhibition ending October 18; the new card does not list that exhibition as available on October 24.

## Yutori Restaurant & Bar — Palo Alto

- [San Francisco Chronicle, September 24 report](https://www.sfchronicle.com/food/restaurants/article/yutori-restaurant-opening-palo-alto-22442762.php) — opened; explicitly says restaurant opening September 24, whereas café/konbini/market opened earlier in spring. Only opening timing/context is attributed to the report.
- [Official site](https://www.yutori-pa.com/) and [Restaurant & Bar](https://www.yutori-pa.com/restaurant-bar/) — both opened successfully; active restaurant reservation links, Japanese food through a California lens, separate café/deli/market/dinner hours, address and additional back parking. `openedOn: 2026-09-24` is scoped to the Restaurant & Bar in the card's name and copy, not the entire business.

## IGNITE — San Pedro Square, San José

- [Silicon Valley Business Journal, September 15](https://www.bizjournals.com/sanjose/news/2026/09/15/ignite-replaces-sushi-confidential-san-jose.html) — opened; publicly visible headline/lede establishes the replacement of Sushi Confidential and current new restaurant. Full subscriber article was not available; no unseen claims are used.
- [Official website](https://www.eatatignite.com/) — opened successfully (www variant required); confirms restaurant concept, reservations, menu and 26 N San Pedro Street address. Strong enough to list “open in September,” without a separately verified first-service date.
- A local blog and an unverified self-described Reddit operator mentioned a September 11 soft opening and October 2 grand opening. These are **not** used to assign `openedOn`, publish a celebration date or claim a live discount. An automated directory had a conflicting Market Street address and is excluded; brand address is used.

## Existing record update reported to root

`marufuku-burlingame-announced`: [brand homepage](https://www.marufukuramen.com/) now says “COMING SOON TO BURLINGAME / GRAND OPENING OCT. 11 11AM.” Directly opened September 27. [Burlingame page](https://www.marufukuramen.com/burlingame) still only says Coming Soon, with no street address. Root owns any update: keep announced status, do not create `openedOn` from a grand-opening banner, do not guess an address. The banner itself does not print a year; do not manufacture additional specificity. This record is not duplicated in the new module.

All editorial travel, clothing, budgeting and sequencing suggestions are explicitly suggestions or checks. No restaurant taste claims, affiliate incentives or current discounts are asserted. All new card `verifiedAt` values are 2026-09-27.
