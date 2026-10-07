# October–November 2026 editorial refresh

Reviewed 2026-10-07. This package treats the OPUS report as audit evidence, not as authority to make unsupported content or configuration changes. Existing review dates are preserved unless the specific item was reread.

## Scope and behavior

The SF/East package adds 15 programs; the regional package adds 19 and extends one existing Healdsburg market entry. Every new event has explicit occurrence dates rather than a continuous season interpreted as daily sessions. The edition now covers through November 30. Five regional half-day articles, four opening reports, three dated offers and three notices complement the calendar. The Caltrain notice deliberately consolidates Veterans Day and Thanksgiving because notices deduplicate by source URL.

Quick search marks offers requiring reconfirmation as unverified. Opening freshness is based on each record, not a hard-coded October archive cutoff; a review date never becomes a first-service date. Monthly article previews start with six and expand in groups of six. Existing editorial styling, source attribution and accessibility behavior are retained.

## Root-owned source checks

| Entry | Sources and scope |
| --- | --- |
| Old Post Office, Burlingame | https://www.oldpostofficeburlingame.com/ confirms **222 Park Road**, dinner and announced lunch/brunch hours. https://www.sfgate.com/food/article/old-post-office-burlingame-22449256.php supplies Oct 1 first opening. Some earlier press gives 220; the current business address wins. No dining review or opening discount claimed. |
| Shinka | https://jayhotelsf.com/eat-drink/shinka/ and https://jayhotelsf.com/eat-drink/ explicitly say October 2026, Coming Soon and hours to be announced. Address 433 Clay Street is on the hotel page. The hotel's existing restaurant hours are not reused. |
| Flora | https://www.florasantanarow.com/ confirms a 2026 Santana Row project. https://sf.eater.com/restaurant-news/212458/flora-restaurant-opening-san-jose supplies reported suite/address. Earlier summer forecasts are not treated as evidence of opening. |
| Excelsior | https://www.hiddensplendor.beer/the-wonder/the-wonder-begins identifies the project and 1132 Fourth Street. https://www.sfchronicle.com/food/restaurants/article/openings-new-bay-area-2026-21266878.php supplies only a reported November forecast. No exact date, hours or admission invented. |
| Marufuku update | https://www.marufukuramen.com/burlingame announces Oct 11 Grand Opening, 11am–2pm / 5pm–9pm. The directory still says Coming Soon. Remains announced on Oct 7; no fabricated first-service date. |
| Green Friday | https://www.ebparks.org/we-celebrate/green-friday explicitly lists Nov 27, 2026 and fees waived. State fishing licenses, watercraft inspection and concessions remain excluded; Tilden Merry-Go-Round and Redwood Valley Railway are not free. |
| Yogurtland | https://www.yogurtland.com/news_posts/view/86/celebrating-20-years-of-yogurtland-anniversary-promo-how-you-can-join-the-fun states the 2026 monthly-20th 20% member discount. Nov 20 is rule-derived, participating stores/in-store only; exclusions retained. |
| Botanical Thanksgiving | https://gggp.org/tickets/ currently lists Thanksgiving as a public free-admission day for SF Botanical Garden. Nov 26 is explicitly a 2026 calendar derivation from that rule, not a separately announced event. The page exceeded the web renderer size limit; its indexed primary-source text was readable. No fee exemption for the other gardens or special programs claimed. |
| Caltrain | https://www.caltrain.com/schedules/holiday-service-schedules official indexed 2026 table lists Nov 11 weekday, Nov 26 weekend, Nov 27 modified service. Detailed holiday timetable availability remains conditional. |
| SF parking | https://www.sfmta.com/getting-around/drive-park/holiday-enforcement-schedule distinguishes Nov 26 from Nov 27. Safety restrictions and private garages are not waived by the city holiday schedule. |
| SF art | https://www.sfmoma.org/exhibition/sarah-sze/ lists Nov 21 opening in the free Floor 1 atrium. https://www.sfmoma.org/visit/ confirms Wednesday and Thanksgiving closure. Free atrium does not mean all museum galleries are free. |
| East Bay redwoods | https://www.ebparks.org/parks/reinhardt-redwood has current Stream/Old Church and planned Golden Spike work notices. No November reopening is assumed. Green Friday guide uses the separate fee-waiver source. |
| Half Moon Bay | https://www.parks.ca.gov/?page_id=531 distinguishes the dog-permitted Coastside Trail from beaches where ordinary dogs are prohibited; park hours and Francis Beach entrance checked. Suggested route is editorial, not a navigation guarantee. |
| Alviso | https://parks.santaclaracounty.gov/locations/alviso-marina-county-park main body lists 1195 Hope Street, free park admission, park/trail hours and dog/bike/drone boundaries. The footer contains a conflicting city/ZIP; main park address is used. No salt color or bird-sighting guarantee. |
| Sonoma | https://svma.org/visit/ confirms Wednesday free admission, front-desk check-in, adult accompaniment under 13, Oct 17 early closing and Oct 22/29 closures. November Wednesday dates are rule-derived and holiday closure remains conditional. |

Other events and structured program facts: [SF/East source ledger](octnov-2026-sf-east-sources.md), [regional source ledger](octnov-2026-regional-sources.md).

## Images and provenance

All new images are local WebP files with source URLs, credited owners/authors, captions and responsive sizes. They are resized/encoded only. No generated photo is presented as a real venue or event. Archived photographs preserve their year where known; official posters are identified separately.

Root media metadata: `src/data/octnov-2026-media.json`, `src/data/octnov-2026-extra-media.json`. The latter contains Healdsburg market archival photography and four official program/brand graphics. Petaluma and Healdsburg Library provide small originals (180 / 220 px); they are not described as high-resolution imagery. Point Reyes artwork collage is labelled as a reused Fall 2025 asset, not a 2026 exhibitor list. The Jay photograph's source filename says Prelude, so its caption explicitly does not claim it depicts an open Shinka. Excelsior's property photo predates the new restaurant. Flora's wordmark is official artwork, not a dining-room photo. SFMOMA exterior (2017) and SF Botanical Garden (2005) retain Commons licenses.

Marin Holiday Light Spectacular's official image host returned HTTP 403; no alternate access was attempted and the inaccessible image is not shipped. Another candidate, 15romolo.com, redirected to an unrelated gambling site and was excluded. SFMOMA First Thursdays are paused; no November first-Thursday free-entry claim was added. Prior-year holiday promotions are not advanced to 2026.

## Release acceptance

Required before publication: complete site and 3D tests, lint, dependency audit, production build, share-card decoding, weekly and release checks; inspect the new pages in a real browser at mobile and desktop widths, including English and traditional Chinese. Synchronize the final frontend exports into backend runtime catalogs and rebuild its source registry, then run the complete backend checks. Verify the exact deployed SHAs, new localized pages, photo bytes and public catalogs after hosting completes. Local build success and a successful Git push are not production acceptance.

This content refresh does not close all 301 OPUS ledger rows. Production operational configuration, real model evals and ongoing future editorial supply remain separate evidence requirements. The user is managing the OpenAI provider budget directly.

- Alviso final review: county park alert explicitly closes the parking lot October 15–18 (including overnight) for event setup/breakdown. Day on the Bay remains October 17, 2026, 10 a.m.–2 p.m.; the guide now states the parking restriction without implying a full park closure. Confirmed against the park page and https://parks.santaclaracounty.gov/day-bay on October 7.
