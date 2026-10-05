# BAYLINK everyday perks — source audit

Checked: 2026-10-04 (America/Los_Angeles). Ten new offers, two in each BAYLINK region. These are ongoing resources, not unannounced October event dates. All eligibility, capacity and appointment statements derive from the official pages below; live availability was not booked or guaranteed.

## Added offers

| Offer ID | Region | Official evidence | Scope and editorial handling |
| --- | --- | --- | --- |
| sfpl-kanopy-streaming | SF | [SFPL Movies, TV & More](https://sfpl.org/research-learn/elibrary/bay-beats-movies-tv) lists Kanopy Movies and Kanopy Kids with service and FAQ links; [free library card](https://sfpl.org/free); [Kanopy setup](https://help.kanopy.com/en-us/4171.htm) | Requires an active linked library card and a Kanopy account. California residents can obtain a free SFPL card with an in-person ID check. Do not copy old “10 movies” or another library’s ticket allowance; current limits remain account-specific. |
| sfpl-linkedin-learning | SF | [SFPL eLearning](https://sfpl.org/research-learn/elearning); [SFPL computer learning](https://sfpl.org/es/node/4654) | Active library card and PIN/password. Mobile Library ID is sfpl. Learning access does not imply a LinkedIn Premium subscription. |
| tilden-little-farm-free | East Bay | [Current Nature Area page](https://www.ebparks.org/parks/tilden-nature-area); [2026 attractions schedule](https://www.ebparks.org/sites/default/files/Tilden-Attractions.pdf?v=Fall2025) | Free farm and parking; current page says public feeding has ended. EEC hours are Tuesday–Sunday 10:00–16:30. October tree-work notices are acknowledged without promising all trails open. |
| richmond-art-center-free | East Bay | [Visitor information](https://richmondartcenter.org/about/contact-visit/); [Community Corner and courtyard](https://richmondartcenter.org/announcements/plan-your-next-visit-to-richmond-art-center/) | Galleries and parking free, Wednesday–Saturday 10:00–16:00 except closures. Art-making corner and courtyard are first come, first served. Classes and rentals are separate; contact ahead for groups of 15+. |
| smcl-free-printing | Peninsula | [Print Anywhere](https://smcl.org/printanywhere/); [Computer FAQ](https://smcl.org/faq/computer-access/) | Up to 25 printed sides daily. Upload and collection branch must match. Saturday 17:00–24:00 maintenance clears queued jobs. Applies to SMCL, not all independent municipal libraries in San Mateo County. |
| palo-alto-art-center-free | Peninsula | [City visitor guide](https://www.paloalto.gov/About/Visiting); [Art Center contact page](https://www.paloalto.gov/I-Want-To/Experience-the-Art-Center) | Regular exhibitions free. Courses and workshops are separate. Official pages show inconsistent gallery hours, so the card deliberately directs readers to current opening information without fixing a weekly timetable. No Family Day date inferred. |
| sjpl-free-seed-library | South Bay | [SJPL Seed Libraries](https://www.sjpl.org/seed-libraries/) | No card required; seasonal quantities and varieties vary. Take only what is needed, record the selection, and call ahead for a specific variety. Donations are optional. |
| intel-museum-free | South Bay | [Intel Museum](https://www.intel.com/content/www/us/en/company-overview/intel-museum.html) | Admission and parking free; Monday–Friday 09:00–17:00 with special closures. Ordinary self-guided visitors do not need a reservation; guided visits and larger groups need arrangements. Chip-factory exhibits are not access to a factory. |
| marin-library-parking-passes | North Bay | [Marin library park passes](https://marinlibrary.org/parks/) | Separate Marin Water, Mount Tam and California State Parks physical passes. One-week loan, two renewals when no waitlist. Specified day-use sites only; no general camping benefit. |
| marine-mammal-center-free | North Bay | [Official home and ticket notice](https://www.marinemammalcenter.org/); [contact/address](https://www.marinemammalcenter.org/contact/) | Free tickets require advance reservation. At verification, dates through October 11 used Eventbrite; October 12 onward was awaiting release during a platform transition. Current patient visibility varies. |

## Source conflicts and publication limits

- Tilden’s [2020 Little Farm brochure](https://www.ebparks.org/sites/default/files/tilden_little_farm_2020.pdf) still invites lettuce/celery feeding. The current official park notice supersedes it. The new offer explicitly says not to feed animals.
- Follow-up source audit found the existing Tilden guide and English translation already correctly explain the end of public feeding. No date-only edit or animal-feeding correction was needed in those existing files.
- Palo Alto’s generic city visitor article shows a narrower schedule than the Art Center contact page. Free admission is corroborated, but the card omits exact hours until these pages agree.
- The Marine Mammal Center’s free-entry policy is confirmed; future reservation availability is not. The ticket-system transition is visible in the card and this offer is not recommended for a first evergreen poster.
- SMCL 3D printing was considered but replaced by the better-documented daily printing benefit for this batch.
- No purchases, trial subscriptions, account duplication, or guessed future event dates are presented as free benefits.
- Existing offer IDs and subject matter were reviewed in september-freebies, september-offers-update, october-offers, october-offers-extra, autumn-refresh-offers, community-discovery-offers, late-september-local, late-september-north, and october-2026-verified-offers. Existing tools, museum passes, and free museum entries were not duplicated.

## Implementation

- Data: `src/data/everyday-perks-2026.ts`, export `everydayPerks2026: FreebieOffer[]`.
- Exact string translations: `src/data/everyday-perks-2026-en.json`, including all Chinese offer fields and the combined brand/source accessibility label.
- All ten items use `verifiedAt: '2026-10-04'` and existing registered media keys. Subject images are explicitly described as reference photographs or illustrations where not venue-specific.
- Recommended six-card social selection: sfpl-kanopy-streaming, tilden-little-farm-free, smcl-free-printing, palo-alto-art-center-free, sjpl-free-seed-library, marin-library-parking-passes. Keep the key eligibility condition on the card itself.
