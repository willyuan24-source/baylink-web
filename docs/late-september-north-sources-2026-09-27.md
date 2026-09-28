# North Bay late-September update — source record

Checked September 27, 2026. New data is confined to `src/data/late-september-north.ts` and its English dictionary. Existing event, opening and offer files were searched by region and by candidate names before writing; no duplicate of these seven entries was found. No shared data or media files were changed.

## Events

- `napa-water-wise-workshops-oct2026`: [City of Napa workshop page](https://www.cityofnapa.org/588/Water-Wise-Landscaping-Workshops) was fully read. It specifies October 7 and 14, 2026, 6:30–8:30 pm, Senior Center Manzanita Room at 1500 Jefferson Street, free attendance and online registration. These are separate sessions, represented with `occurrenceDates`, not continuous daily programming. Editorial advice about bringing yard photos and checking incentive eligibility is identified as planning advice.
- `napa-beyond-bin-oct10-2026`: [Napa Recycling's September 21 announcement](https://naparecycling.com/beyond-the-bin-napas-recycling-composting-facility-tour-day/) was fully read for October 10, 9 am–1 pm, 820 Levitin Way in American Canyon, departures every 20 minutes from 9:20 am to 12:20 pm, footwear requirements and heavy-rain cancellation. [The city-hosted Eventbrite listing](https://www.eventbrite.com/e/2026-beyond-the-bin-tour-day-at-napas-recycling-composting-facility-tickets-1997481680477) was readable through official indexed text, including its organizer and reservation instructions, but direct extraction returned HTTP 429. Eventbrite's [indexed location listing](https://www.eventbrite.com/fr_BE/poi/ca--napa/scenic-overlook--nZTL3/) explicitly marked this exact city event free. No seat availability was tested or promised.
- `srsymphony-boo-dance-oct25-2026`: [Santa Rosa Symphony's event page](https://www.srsymphony.org/event/boo-lets-dance/) was fully read for October 25, 2026 at 3 pm, Weill Hall, the Snoopy/ballet program, costume encouragement, $20 adult/$10 youth (12 and under) single-ticket prices, and nonrefundable tickets. Copy directs readers to checkout for the final total; it does not confuse the single ticket with a subscription or apply other concert-series promotions.

Events cover Napa County (Napa and American Canyon) and Sonoma County (Rohnert Park). The clock times use the locally displayed event text. The Symphony page's add-to-calendar text contained an inconsistent Asia/Kolkata label; that machine-calendar timezone was not used.

## New restaurant concepts and reopening

- `panama-hotel-restaurant-reopened-sep2026`: [Panama Hotel's dated September 2 announcement](https://panamahotel.com/a-new-chapter-begins-at-the-historic-panama-hotel-restaurant/) was fully read. The hotel explicitly says the restaurant reopened September 1, so `openedOn` reflects actual reopening rather than an article date or party. It identifies chef Hiram Diaz, the cuisine, dinner days and 4 Bayview Street address.
- `aliotos-focacceria-san-rafael`: [Downtown San Rafael's September 1 feature](https://downtownsanrafael.org/alioto-new/) and [Alioto's official website](https://www.aliotosfocacceria.com/) were fully read. Together they establish a new deli concept replacing The Kitchen Table, an operating San Rafael location at 1574 4th Street, and current listed 10 am–5 pm daily hours. September 1 is the district article date; the first public-service date is unverified and `openedOn` is intentionally omitted. The Reno location and its separate opening history are not treated as San Rafael facts. The existing schema's `new-restaurant` type represents this new concept; prose explicitly explains the conversion of an existing restaurant.

Neither entry is a firsthand dining review. No unsupported prices, availability or opening celebration dates are claimed.

## Offers and benefits

- `marin-transit-clean-air-oct7-2026`: [Marin Transit's official fare-free calendar](https://marintransit.gov/fare-free-promotions) was fully read and confirms October 7, 2026 local bus service is free for all riders. The benefit is limited to the operator's stated local-bus scope; no blanket claim is made for ferries, SMART or other connecting services.
- `napa-costume-exchange-oct3-2026`: [City of Napa's September 25 newsletter](https://www.cityofnapa.org/CivicSend/ViewMessage/message/301296) was fully read and explicitly calls the October 3 Fire & Life Safety Day costume exchange free, with no donation required. It confirms 10 am–2 pm and Fire Station #1, 930 Seminary Street. [Napa Recycling's September 21 exchange page](https://naparecycling.com/halloween/) corroborates this date. The entry describes only this confirmed event; it does not claim all monthlong collection locations use the same hours or guarantee costume inventory.

Both offers have exact future date bounds. The current `FreebieOffer` schema has no `verifiedAt` field, so no extra field is introduced; their source check date is documented here for parent-task integration.

## Additional research not added

- [NCRWS tire-recycling announcement](https://naparecycling.com/get-rid-of-those-unsightly-tire-piles-today/) and its [county coupon PDF](https://naparecycling.com/wp-content/uploads/2026/02/Mar-insert-3-County-two-sided-County-Tire-Coupon.pdf) were read. The county-customer coupon expires December 30, 2026; the City of Napa customer window ended September 6. The county coupon is restricted to eligible NCRWS customers, up to nine qualifying tires and one coupon per delivery. It is a useful future lead but was omitted in favor of two nearer dated benefits. Do not conflate the two customer programs or use the facility's general hours in place of the coupon's specific acceptance hours.
- [Petaluma Pride](https://petalumapride.org/) and its organizer's [Eventeny page](https://www.eventeny.com/events/pet-pride-fest26-30964/) confirm October 10, noon–5 pm and the venue. An explicit public-admission price was not found in those pages, so no event was added with an invented free/paid label.
- Aggregator listings for Connolly Ranch first-Wednesday free visits and Makers Market Napa were treated only as leads. Current official information did not sufficiently confirm every desired detail in this pass, so they were omitted.
- No existing item requiring a factual correction was identified during this scoped search.

Existing illustrative image keys are reused and remain labeled as illustrations by the site's media registry. The two offer entries additionally state that the images are not actual vehicles, stops, costumes or inventory.
