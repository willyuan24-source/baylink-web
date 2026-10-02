# October 2026 event refresh — source ledger

Checked: **2026-10-02**, America/Los_Angeles. These records supplement existing event data; they do not claim all Bay Area events are covered. The primary event URLs used for confirmation below were directly opened. Search-only discovery leads are explicitly distinguished. Only the eight new records and four patched records receive this verification date. Earlier unrelated records keep their existing dates.

## Integration

- `src/data/october-2026-events-refresh.ts` exports `october2026NewEvents: MonthlyEvent[]` (8) and `october2026EventUpdates: (Partial<MonthlyEvent> & Pick<MonthlyEvent, 'id'>)[]` (4). Merge patches by ID after loading existing arrays; never append a patch as a second card.
- `src/data/october-2026-events-refresh-en.json` translates all Chinese strings introduced by these records.
- New coverage: San Francisco 6, East Bay 1, North Bay 1. All dates remain usable on or after October 2.
- Goblin Jamboree has nine explicit `occurrenceDates`; intervening weekdays are not event days. Fleet Week retains the official October 4–12 umbrella dates but its `occurrenceDates` are October 6–12, the dates with entries on the accessed official calendar. The October 24 Presidio record is a single specifically verified calendar occurrence, not an inference of daily opening.
- Reused image keys are existing illustrations: `family-workshop`, `secondhand-check`, `october-library-culture`, `outdoor-cinema`, `autumn-neighbors`, `culture-visit`. No new photo association or implied event photograph was added. Existing event image keys on patches remain untouched.

## New events

### Calendar city reference points

- Read the public [2026 Census California places Gazetteer](https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2026_Gazetteer/2026_gaz_place_06.txt) on October 2. The browser research tool could not parse the text URL; a direct PowerShell HTTP request returned status 200 and the pipe-delimited source rows, including the `INTPTLAT` / `INTPTLONG` headers.
- Alameda city: GEOID `0600562`; source reference coordinates `37.74229, -122.2605`; stored to three decimals as `37.742, -122.261`, `precision: 'city'`.
- Sausalito city: GEOID `0670364`; source reference coordinates `37.858369, -122.491844`; stored to three decimals as `37.858, -122.492`, `precision: 'city'`.
- These are Census city reference points used only for calendar aggregation. They are **not event entrances, venue coordinates or navigation destinations**; visitors should use each event's named venue/address. The mapping is in `src/data/calendar-city-locations.ts`.

### sausalito-goblin-jamboree-2026

- [Museum event page](https://bayareadiscoverymuseum.org/events/goblin-jamboree/) confirms October 3–4, 10–11, 17–18, 24–25 and 31; 9am doors, rain or shine, costumes welcome, $30 general / $5 member tickets, free member tickets October 3–4, and member ticket requirement. Confirms $10 EBT/SNAP/WIC tickets in person, up to four; library passes and ACM/ASTC discounts excluded. Address and complimentary parking are on this page.
- The page expressly dates the separate October 16 fundraiser to 2026, reinforcing the current season; the weekend dates also align with 2026.
- The official BUY TICKETS link to the museum's `comeplay.bayareadiscoverymuseum.org/orders/600/calendar` was opened, but its dynamic response had no readable inventory. **No live availability, infant admission age cutoff, fee total or date-specific closing time is claimed.** Users are directed to confirm those at checkout. The evening fundraiser is not counted in the nine daytime occurrences.

### alameda-point-antiques-october-2026

- [Organizer home](https://alamedapointantiquesfaire.com/) explicitly gives next faire October 4, 2026, address 3900 Main Street, and entry tiers: 6–7:30am $20; 7:30–9am $15; 9am–1pm $10; 1–3pm $5.
- [Organizer ticket service](https://alamedapointantiquesfaire.thundertix.com/) confirms that day's event, online sales only for two early entry periods, cash-only on-site tickets, paper exchange of online tickets, children **under** 12 free with adult, free parking and no pets other than service dogs.
- [Organizer directions](https://alamedapointantiquesfaire.com/directions/) confirms parking and GPS address. Route 96 and ferry claims on that evergreen page were **not** copied as current operational promises; the record asks ferry users to check Sunday schedules.
- [Trade calendar found in research](https://antiquesandthearts.com/event/alameda-point-antiques-faire-6/) was a search-only discovery source: its $5 tier begins at noon and differs from the current organizer's **1pm**. Organizer price boundaries win. Weather can trigger a rollover; ticket availability and purchases remain live.

### sf-mandarin-conversation-oct6-2026

- [SFPL dated event page](https://sfpl.org/events/2026/10/06/dialogue-mandarin-bilingual-conversation-club) confirms Tuesday October 6, 6–7pm, adults, Main Library third-floor Chinese Center Exhibit Space, 100 Larkin Street, and a conversation format. SFPL's attendance section says drop-in unless otherwise noted.
- **Conflict handled:** English body says twice monthly; Chinese body says first Wednesday. Neither cadence was used to invent additional dates. Only the explicit Tuesday dated event is included.
- Library program is classified free under SFPL's longstanding public-program practice; the dated page carries no price field and no paid booking link. A historically explicit general statement is in [SFPL's library-program blog](https://sfplamr.blogspot.com/search/label/programs), consulted in search results. The current page verifies the dated program and drop-in rule, not a new universal fee policy.
- The page renders times without AM/PM in extracted text; the session's 6–7 range is during the listed Tuesday 9am–8pm library hours. The card uses evening 18:00–19:00. No recurring calendar rule is inferred.

### sf-chinatown-calligraphy-oct8-2026

- [SFPL dated event page](https://sfpl.org/events/2026/10/08/workshop-chinese-calligraphy-copying-practice-xuexilintie) confirms October 8, 2–3:30pm, adults, Chinatown meeting room, 1135 Powell Street, Mandarin/Cantonese tags, and reservations by phone 415-355-2888 beginning October 1.
- Reservation is required, not the library's usual drop-in default. Materials and remaining seats are not specified; visitors are asked to confirm by phone.
- Same general free-library-program classification caveat as the Mandarin session. No current paid admission, guaranteed materials, or confirmed vacancy is asserted.

### sf-sundown-beetlejuice-2026

- [Current organizer landing page](https://sfstandard.com/sundown-cinema/) confirms next screening October 16, Beetlejuice (1988), Crane Cove Park, activities from **5pm**, movie around **6:30pm**, free/open to all, optional RSVP drawing for reserved seating, and optional canned-food donations.
- [Organizer's August 28, 2026 season update](https://sfstandard.com/sponsored/sf-sundown-cinema-inside-out-parent-trap/) was directly opened and explicitly identifies the remaining 2026 screenings, including October 16 Beetlejuice at Crane Cove Park. It establishes the year without relying on an annual-date assumption. The linked official RSVP form is titled “Sundown Cinema 2026 RSVP” but returned no readable form fields, so no form submission or confirmed seat is claimed.
- [2026 dated discovery listing](https://www.510families.com/calendar/sundown-cinema-beetlejuice/) led directly to that organizer page but gives 7–9pm. That time was discarded in favor of the organizer's current 5pm/6:30pm information. The organizer's five-night sequence is the June–October 2026 schedule, followed separately by its labeled 2025 photo gallery.
- No guaranteed reserved seating, end time, weather cancellation status or active prize eligibility is claimed. We do not name SF Parks Alliance as the current organizer; the current page identifies The San Francisco Standard.

### sf-sunday-streets-excelsior-2026

- [Dedicated 2026 organizer page](https://sundaystreetssf.com/sunday-streets-excelsior-2026/) now confirms **October 18, 11am–4pm, Mission Street from Geneva Avenue to Theresa Street**, Persia Triangle Family Hub, clothing swap, parklet party, Lucha Libre, and separately registered 9:30am Walktober at Cayuga Playground.
- Same page recommends Balboa Park BART, says 14 Mission will reroute on Alemany between Geneva and Silver, and says the exhibitor list is still being finalized.
- [Season home](https://sundaystreetssf.com/) still says to stay tuned for routes, but links to the more detailed dedicated event page. [Program/about page](https://sundaystreetssf.com/about/) confirms free community activities. Dedicated event information takes precedence over older generic FAQ towing hours.
- No full vendor lineup, exact walk price, reserved space or guaranteed weather operation is claimed. Standalone Sunday Streets attendance is not made contingent on registering for Walktober.

### sf-presidio-artspan-oct24-2026

- [Presidio Trust event calendar](https://presidio.gov/explore/events/artspan-sf-open-studios-at-sports-basement/2026-10-24) explicitly confirms October 24, 2026, 9am–7pm, free admission, Sports Basement at 610 Old Mason Street, Muni 30 at Sports Basement Parking Lot, Presidio GO alternatives and paid adjacent parking.
- No required ticket registration is stated. Buying art is separate. Individual artist attendance is not guaranteed.
- Broader ArtSpan discovery searches yielded a season calendar, but direct [general visitor page](https://www.artspan.org/visitsfos) returned an internal error and [weekend index](https://www.artspan.org/sfosguide/weekends/) returned zero readable lines. These are **not recorded as fully verified official season pages**, and no whole-city season record was created from them.
- Only the actual October 24 calendar occurrence is included; October 25 was not assumed.

### sf-scaregrove-2026

- [SF Recreation and Parks main event](https://www.sfrecpark.org/Calendar.aspx?EID=10822&calType=0&day=30&month=10&year=2026) confirms October 30, 2026, 3–9pm, Sigmund Stern Grove at 19th Avenue/Sloat Boulevard, free admission and food for sale. It lists haunted attractions, carnival rides, crafts and entertainment; costumes are encouraged.
- [Official October 30 list](https://www.sfrecpark.org/calendar.aspx?day=30&month=10&view=list&year=2026) separately lists Mobile Rec at noon–8pm. Only the main event's 3–9pm hours are used for this card.
- The detail URL initially returned a tool error, then was successfully read by following the main-calendar link from the list page. It does not state a visitor reservation requirement; its sign-up link is for volunteers. No booking availability, minimum age, individual attraction schedule, parking entitlement or weather guarantee is asserted. Transit and family-planning tips are editorial.

## Existing IDs refreshed

### hardly-strictly-bluegrass-2026

- [2026 organizer FAQ](https://hardlystrictlybluegrass.com/info-faq-2026/) confirms October 2–4, free/no ticket, gates Friday 11am and weekend 9am, daily end 7pm, bag limit and prohibited items, cashless concessions, no bikes inside, water refills and child hearing protection.
- [2026 SFMTA event advisory](https://www.sfmta.com/travel-updates/hardly-strictly-bluegrass-october-2-4-2026) confirms performance windows Friday 1–7pm / weekend 11am–7pm, added service and nightly 6–8:30pm 5R return to Civic Center. Gate opening and performance beginning are explicitly distinguished.
- **Conflicts not propagated:** FAQ ADA-shuttle paragraph still says Fri Oct 3 / Sat Oct 4 / Sun Oct 5, a prior-year date pattern. Blanket policy says both under 6×8 feet and a later 5×7 feet maximum. FAQ says no bike valet while SFMTA mentions a Lyft bike valet. No blanket size, ADA timetable or categorical valet claim was added; those require direct confirmation.
- Existing title/location/free status remain. Updated verified date reflects these accessed sources only.

### san-francisco-fleet-week-2026

- [Official 2026 calendar](https://fleetweeksf.org/calendar-of-events/) shows the October 4–12 umbrella and dated entries October 6–12. Confirms October 9 ship parade 11am–noon.
- [Official air-show page](https://fleetweeksf.org/air-show/) confirms October 9–11, noon–4pm daily and free general admission at Marina Green with paid VIP offerings.
- [Official ship-tour page](https://fleetweeksf.org/events/ship-tours/) confirms free first-come tours, October 8/10/11 10am–4pm at Piers 27 and 35, October 12 9am–noon at Pier 35, dress/bag/ID restrictions, no storage and steep ladders/uneven surfaces.
- **Conflict exposed:** The calendar lists October 7 Pier 35 10am–4pm in addition to Pier 27 10am–1pm. The dedicated ship-tour schedule only lists Pier 27 October 7. The record does not resolve that discrepancy by guessing and asks October 7 visitors to reconfirm.
- October 9 has no ship-tour listing; the card avoids implying daily ship tours. Adult government ID wording is conservative; official wording is “over 18” while minors 17 and under require accompaniment. No nationality/passport eligibility or admission guarantee is invented.

### sf-italian-heritage-parade-2026

- [Organizer parade page](https://sfitalianheritage.org/parade/) explicitly confirms Sunday October 11, 2026, 12:30pm start at Jefferson/Powell, Columbus Avenue route to Washington Square, and free parade plus Concorso Italiano car show.
- Same page lists restaurants with street seating. The record says restaurants arrange reservations/charges; it does not promise a free seat or availability.
- Air-show time overlap comes from the separately accessed Fleet Week air-show page above; choose-one-main-event advice is editorial.

### sf-castro-street-fair-2026

- [General organizer page](https://castrostreetfair.org/fair/) confirms October 4, 2026, 11am–6pm, Castro/Market, $10–20 suggested donation and Muni Metro access.
- [Current organizer home](https://castrostreetfair.org/) and [2026 entertainment page](https://castrostreetfair.org/fair/entertainment/) confirm the newly published program and first Family Zone: 18th near Diamond, Per Sia story time noon–12:30pm, SF Black Pride Showcase 11am–2pm, Sundance Saloon at Castro Theatre parking lot.
- [2026 SFMTA advisory](https://www.sfmta.com/travel-updates/castro-street-fair-sunday-october-4-2026) confirms F-line and 24/33/35/37 reroutes. Organizer's generic list of rail services is not repeated as a current line-by-line promise.
- The old statement that performers are not announced is replaced. Free/suggested-donation distinction remains, with purchases separate.

## Additional leads excluded

- [Potrero Hill Festival](https://potrerofestival.com/) confirms October 17, 2026, 10am–5pm, but the same page retains a “Postcards from 2025” section before performer listings. We did not present that performer lineup as verified 2026 information. [Vendor FAQ](https://potrerofestival.com/become-a-vendor/) was also opened; no card was added.
- [Downtown Alameda events](https://downtownalameda.com/events/) was a search-only discovery source, not an added record; it separates past summer Art & Wine Faire from upcoming October events.
- Search snippets and third-party lists were used to discover organizer URLs, not to manufacture confirmation when direct official reading failed.
