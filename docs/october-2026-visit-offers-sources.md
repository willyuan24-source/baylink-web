# October 2026 visitor guides and verified offers

Checked: 2026-10-02, America/Los_Angeles.

## Delivered content

- `src/data/guides-october-2026-visit.ts`: three guides, 13 / 15 / 14 blocks.
- `src/data/guides-october-2026-visit-en.json`: complete English mapping for all Chinese strings in those guides.
- `src/data/october-2026-verified-offers.ts`: six new ongoing benefits plus `october2026OfferUpdates` for SFPL Discover & Go and SFMOMA October 25.
- `src/data/october-2026-verified-offers-en.json`: complete English mapping for new offers and updates.
- Guide routes, suggested durations, budget decisions and packing advice are editorial suggestions, explicitly distinguished from official rules.

## Sources and verification boundaries

| Official source | Fact used | Access / limitation |
| --- | --- | --- |
| [NPS Alcatraz fees](https://www.nps.gov/alca/planyourvisit/fees.htm) | Authorized landing operator; ferry and audio inclusion; park passes do not waive ferry fare; up to 90 days advance sale | Read live. Did not copy its January 2026 price table into a current fare promise. Actual ticket inventory not checked. |
| [NPS basic information](https://www.nps.gov/alca/planyourvisit/basicinfo.htm) | Pier 33; Mandarin audio option | Read live. |
| [NPS accessibility](https://www.nps.gov/alca/planyourvisit/accessibility.htm) | Dock-to-cellhouse climb and mobility tram | Read live; avoids claiming general tourist access to S.E.A.T. |
| [Golden Gate Bridge pedestrian rules](https://www.goldengate.org/bridge/visiting-the-bridge/bikes-pedestrians/) | East sidewalk; seasonal hours; possible earlier construction closure | Read live; no unverified day-specific closure asserted. |
| [NPS maritime planning](https://www.nps.gov/safr/getinvolved/planning.htm) | Historic ships relocated; return timetable unsettled | Read page updated August 15, 2026. Existing `guides-attractions-sf.ts` already correctly warns of relocation; no contradictory promise found there. |
| [Presidio GO](https://presidio.gov/visit/getting-to-and-around-the-park/presidio-go-shuttle) | Free routes; some Downtown commuter trips restricted; accessible vehicles | Read live. Not presented as unrestricted all-day free city transport or door-to-door bridge service. |
| [Field Station](https://presidio.gov/explore/attractions/field-station) | Free drop-in family entry, regular hours, address and access features | Read live. No guarantee of a specific activity or borrowed equipment inventory. |
| [GGGP tickets](https://gggp.org/tickets/) | Three-garden SF resident benefit, acceptable address proof, general free entry windows | Web extractor exceeded size limit; read the same public official HTML using Python urllib. Digital proof, utility bill/lease plus photo ID, and free morning windows explicitly appear in the source. Special-program exclusions retained. |
| [YBCA visit](https://ybca.org/visit/) | Wednesday free galleries 11 AM–8 PM; separate program prices | Read live. October 7/14/21/28 are derived from a weekly rule, not claimed as individually verified special events. |
| [YBCA March 2026 announcement](https://ybca.org/yerba-buena-center-for-the-arts-announces-extended-evening-hours-and-programming-as-part-of-free-wednesdays/) | Corroborates extended free Wednesday hours | Read official announcement. |
| [SFMOMA Free to See](https://www.sfmoma.org/visit/free-to-see/) | Unticketed designated public art spaces | Read live. Does not promise free access to all galleries. |
| [SFMOMA visit](https://www.sfmoma.org/visit/) | Adult general fare, free age 18-and-under admission, closures | Read live; $60 family example is arithmetic for two ordinary adults plus one minor. Surcharged exhibition availability remains separate. |
| [SFMOMA accessibility](https://www.sfmoma.org/visit/accessibility/) | Elevators and free equipment loans | Read live. First-come availability explicitly retained. |
| [SFMOMA free days](https://www.sfmoma.org/free-days/) | October 25, maximum two accompanying adults, advance release and surcharged-exhibition exclusions; newly announced K-Pop program | Read live. Existing two-adult rule was already correct; update replaces stale “program to be announced” text. |
| [SFPL Discover & Go FAQ](https://sfpl.libanswers.com/faq/97385) | SF residency, Teacher Card exclusion, two reservations, release timing, named-holder restriction, no cancellation after download/print | SFPL entry URL returned 429 to web extractor; public official HTML followed its redirect to this FAQ successfully. The source gives no universal participant-age minimum, so none was invented. No live account inventory accessed. |
| [SF City Guides FAQ](https://www.sfcityguides.org/about-us/faqs/) | Free regular walks, advance registration, optional donations, private tour distinction | Read live. No claim that a particular tour is scheduled or accessible. |
| [SF Ballet museum partnership](https://www.sfballet.org/community/audience-programs/legion-of-honor/) | 2026 collaboration and Legion of Honor Free Saturdays for nine-county residents | Opened and read the museum partner's current page. No October performance inferred from its historical event listings. |
| [UCSF Free Saturdays, April 21, 2026](https://myfamilysandbox.ucsf.edu/news/free-saturdays-at-the-s-f-fine-arts-museums) | Both de Young and Legion of Honor offer Saturday general admission to nine-county residents | Opened and read. Combined with the partner source above, replaces the older city budget as the published rule evidence. FAMSF direct visit/events/ticketing pages returned 403, so live ticket inventory, date-specific exceptions and accepted proof details were not claimed as verified. The offer links UCSF and separately links museum ticketing. The older city budget was read only as historical corroboration and removed from published guide/offer sources. |
| [Exploratorium visit](https://www.exploratorium.edu/visit) | Daytime fares, age bands, Sunday noon public opening, 18+ Thursday evening and separately booked Tactile Dome | Read live. $109.85 is arithmetic: two $39.95 adults plus one $29.95 youth. Did not reuse potentially stale transit-line details from the source. |
| [Randall hours/directions](https://randallmuseum.org/directions-hours/) | Free Tuesday–Saturday access and steep Castro approach | Read live. Not recommended as automatically low-effort solely because it is free. |

## Integration notes

- Guide exports: `october2026VisitGuides`.
- Offer exports: `october2026NewOffers`, `october2026OfferUpdates`.
- Apply updates by ID after merging old and new offers so all consumers share corrected metadata.
- Existing image keys reused: `culture-visit`, `presidio`, `neighborhood`, `ggp-conservatory`. Image notes distinguish illustration/reference photo from the actual attraction.
- Suggested guide imagery: `sf-alcatraz` / `sf-bridge`; `culture-visit` / `ggp-conservatory`; `presidio` / `culture-visit`.
- No new exact-day free offers inferred from unconfirmed calendars; ongoing rules state their scope.
- No new SFMOMA First Thursdays offer added. Contemporary sources indicate its pause, but no unrelated legacy guide was rewritten without current primary evidence.
