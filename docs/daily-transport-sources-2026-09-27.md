# Daily transport guide source audit — 2026-09-27

Scope: two evergreen commute guides in `src/data/guides-daily-transport.ts`, with exact-key English strings in `src/data/daily-transport-en.json`. Research used official web pages and official-site search results on September 27, 2026. This is an operational guide, not a fixed rate or enforcement calendar. Both guides have the shared tag 日常办事.

## Street parking guide

Slug: `bay-area-street-parking-first-time-guide`.

| Official source | Access and use |
| --- | --- |
| [SFMTA — How to Park Legally](https://www.sfmta.com/getting-around/drive-park/how-avoid-parking-tickets) | Full page opened. Supports reading every applicable sign, street sweeping, temporary restrictions, curb and intersection restrictions. SFMTA expressly allows parking after the sweeper actually cleans the curb, while other parking restrictions still apply. That exception is described only for San Francisco. |
| [SFMTA — Daylighting](https://www.sfmta.com/getting-around/walk/pedestrian-improvements-toolkit/daylighting) | Full page opened during final review. The general parking page mentions 20 feet but omits the directional detail. This dedicated page confirms the vehicle approach side of marked or unmarked crosswalks, 20 feet generally and 15 feet with a curb extension, local posted/painted distances, the right-hand approach on two-way streets and both curbside approaches on one-way streets. The guide does not describe a blanket 20-foot restriction on both sides of every intersection. |
| [SFMTA — Parking Meters](https://www.sfmta.com/getting-around/drive-park/parking-meters) | Full page opened. Supports posted operation and maximum stays, correct payment procedures, and the warning that SFMTA does not accept QR-code meter payments. Some residual page text mentions older payment apps; the guide intentionally directs readers to the official page instead of naming an app. |
| [Oakland — Street Sweeping](https://www.oaklandca.gov/Public-Safety-Streets/Streets/Street-Sweeping) | Full page opened. Street-specific map and dated holiday information support checking the actual block and relevant calendar year. The guide does not apply San Francisco's after-sweeper exception to Oakland. |
| [San Jose — Parking Meters](https://www.sanjoseca.gov/your-government/departments-offices/transportation/parking/parking-meters) | Direct web open returned an internal retrieval error. An official-domain search excerpt was available and stated that maximum stays are indicated on meters and signs. Only this qualitative instruction is used. The guide does not reproduce the excerpt's numeric time limits, meter counts, fees or telephone number. The general San Jose parking landing page was also not retrievable through direct web open. |
| [ParkSJ — Parking Reservations / Facilities](https://parksj.org/parking-reservations/) | Full page opened. Used for facility entrances, operating arrangements and planning a garage alternative. Availability can carry an earlier update time; the guide does not promise live availability, universal hours or free parking. |
| [San Jose — Text-to-Pay announcement](https://www.sanjoseca.gov/Home/Components/News/News/7142/5104) | Official search result dated February 4, 2026 linked visitors to ParkSJ, establishing its municipal relationship. Background provenance only, not an additional guide source. |
| [San Mateo — Downtown On-Street Parking](https://cityofsanmateo.org/4130/Downtown-On-Street-Parking) | Full page opened. Supports distinguishing downtown parking areas and on-street versus city parking facilities. The guide avoids copying fixed hours or prices. |
| [San Mateo — Pay Stations](https://www.cityofsanmateo.org/4131/Pay-Stations) | Full page opened. Supports checking the vehicle, payment device and PayByPhone location code. San Francisco's QR-code policy is not generalized to this city. |

Editorial decisions:
- Municipal parking restrictions, local dates, street sides and temporary signs are checked independently. The guide never presents a Bay Area-wide free-parking schedule or holiday exemption.
- Payment success or app extensions do not override maximum stays or prohibited hours. Faulty equipment is not described as automatic permission to park free.
- Garage access, height limits, retrieval time and event rates are practical checks, not claims that every facility publishes or follows one rule.
- Fine amounts are omitted. The only numeric clearance guidance concerns daylighting and follows the dedicated SFMTA page, including its direction, curb-extension and local-marking qualifications. The private trip note requires no plate, account, payment details or home address.

## FasTrak, bridge and express-lane guide

Slug: `bay-area-fastrak-bridge-express-lanes-guide`.

| Official source | Access and use |
| --- | --- |
| [FasTrak — Toll Bridges](https://www.bayareafastrak.org/en/toll-locations/toll-bridges.shtml) | Full page opened. Supports identifying individual bridges, toll direction and payment options. Numeric Golden Gate Bridge rates on this overview conflict with the bridge operator's dated rate table; no fixed toll amounts are reproduced. |
| [Golden Gate Bridge — Tolls & Payment](https://www.goldengate.org/bridge/tolls-payment/) | Full page opened. Supports electronic southbound toll collection into San Francisco, no on-site cash collection, and checking the operator's current rate table. The operator's July 1, 2026 two-axle table lists FasTrak $10.25, while the FasTrak bridge overview says a minimum $10.50. Readers are directed to the operator rather than given a potentially stale number. |
| [511 — Express Lanes](https://511.org/travel/express-lanes) | Full page opened. Supports optional lane use, destination-based displayed prices, entering and exiting at permitted markings, separate operating schedules and corridor-specific occupancy rules. I-80 has seven-day operation, so the guide explicitly rejects the assumption that every lane is free on weekends. A guessed legacy /driving/express-lanes address returned 404 and is not used. |
| [FasTrak — Carpooling Guide](https://www.bayareafastrak.org/en/help/carpooling-guide.shtml) | Full page opened. Primary reference for bridge-specific occupancy, designated lanes, operating hours and toll-tag requirements, including the 2026 change at six state-owned bridges. Supports keeping bridge carpool rules separate from highway express-lane rules. |
| [511 — Get FasTrak](https://511.org/travel/express-lanes/fastrak) | Full page opened for cross-checking. A broad statement that bridge carpools can use standard or Flex tags conflicts with the detailed 2026 FasTrak bridge rules. The guide does not reuse that broad claim. This page also mentions the planned January 1, 2027 standard-tag phaseout; the guide avoids promising ongoing standard-tag acceptance. Background cross-check only. |
| [FasTrak — License Plate Account](https://www.bayareafastrak.org/en/ways-to-pay/license-plate-account.shtml) | Full page opened. Ordinary and short-term plate accounts pay bridge tolls, not express-lane tolls. Short-term timing windows and existing-invoice payment routes are separate; the guide directs readers to those workflows without hardcoding deadlines. |
| [FasTrak — Rental Vehicles Guide](https://www.bayareafastrak.org/en/help/rental-vehicles-guide.shtml) | Full page opened. Supports confirming rental-company coverage and service fees, use of a personal tag, rental plate registration with accurate start/end dates, updating an extended rental and removing the device at return. No claim is made that a rental toll package necessarily covers express lanes. |
| [FasTrak — Text Scam Alert](https://www.bayareafastrak.org/en/cms/news-detail-article28.shtml) | Full page opened. Alert dated April 3, 2024 remains available. Supports the precise warning that FasTrak does not request payment by text messages containing a website link. The guide does not claim FasTrak never sends any text messages. |

Editorial decisions:
- Express-lane use remains optional; the normal lanes are an alternative. Bridge tolls and express-lane charges are distinct.
- At verification, 511 lists two-person free travel on I-580 and half-price travel for an ordinary two-person vehicle on US-101, subject to applicable tag conditions. The word “ordinary” avoids incorrectly excluding the special two-seat-vehicle provision. The examples are explicitly tied to the verification date.
- The detailed FasTrak page says six bridges—Antioch, Benicia-Martinez, Carquinez, Dumbarton, Richmond–San Rafael and San Mateo–Hayward—changed eligible carpool tag requirements in 2026. The guide does not reproduce the full bridge eligibility table or imply that a Flex tag alone grants a discount.
- Bay Bridge and Golden Gate Bridge are not included in that six-bridge change. Readers must verify the individual bridge's own occupancy, time, lane and equipment conditions.
- No fixed toll rates, service fees, fines or blanket weekend/holiday rules are published.
- Templates only record a trip/check status. They explicitly exclude account numbers, complete plates, payment information and verification codes.

## Local validation

The content module contains two guides, each with four substantive headings, a personal copyable planning template, two official action links and the guides CTA. Parking has eight displayed official sources and four checklist items; FasTrak has seven sources and five checklist items.

The accompanying JSON translates all new Chinese display strings, including shared metadata, tags, source titles/descriptions, templates and CTA.

- Targeted ESLint passed for `src/data/guides-daily-transport.ts`.
- Importing the saved module with Node/tsx succeeded; the JSON parsed successfully.
- Recursive actual-file validation found 98 unique Chinese display strings and 98 matching English keys, with no missing translations or remaining Chinese in English values.
- Both guides have the `commute` category, the September 27, 2026 update date and the shared 日常办事 tag.
- Each guide has four headings, one template and two official action links. Source counts are eight and seven; checklist lengths are four and five.
- Full integration, registry/i18n changes and repository-wide checks are owned by the parent task.
