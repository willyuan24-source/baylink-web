# BAYBAY round 4: budget matching, neighborhood coverage and web candidates

Date: 2026-09-29 (America/Los_Angeles)

## Behavior

- Admission search caps are independent from the editor's whole-trip budget. Unknown admission stays eligible as an explicitly unconfirmed draft; known over-budget admission, age restrictions and timing conflicts still block automatic combinations. A zero admission cap does not assert that restaurant meals are free.
- The planner displays the admission budget separately from group food, transport/parking and other allowances. Existing saved trip budgets are preserved.
- An unavailable place combination explains missing venue coordinates, missing/stale/out-of-range opening evidence, known closure, incompatible area/age/settings or the absence of nearby compatible stops.
- Web search returns optional place cards derived from explicit structured model output with real search citations attached to each populated field. Uncited details become unknown; names without citations are discarded. The original cited answer remains usable when cards cannot be extracted.
- Cards show city, time and cost summaries, sources and remaining checks. They are references, not confirmed opening, prices, bookings or live routes. They cannot silently become public catalog records or scheduled stops.
- Guests can keep up to 20 candidates in this browser. Signed-in users can keep candidates on the current page only; no account result is written to local storage and account changes clear the in-memory list. This limitation is visible. A new snapshot of the same place requires an explicit Update action, including its search date and retrieval timestamp.

## Data

Nine neighborhood stops and two existing-store venue pins expand the public catalog from 68 to 77 places. Opening hours plus venue-level coordinates increase from 9 to 20 places. New clusters cover San Francisco's Ferry Building, Oakland, downtown San Jose, Larkspur's Marin Country Mart and downtown Redwood City. Source research and coverage evidence are recorded separately.

Recurring hours are source-backed planning evidence. The 2026-10-31 cutoff is BAYLINK's editorial recheck limit, not the venue's promise to remain open through that date. Temporary closures, special programs, exact ticket categories and availability must still be checked. Inter-stop durations remain editable buffers, not Google routing estimates.

## Verification

See output/round4-release-verification.md for final test counts and deployment evidence. No OPUS source, data or tests are changed by this round. The pre-existing OPUS W5 forced-blocker threshold failure is not weakened as part of planner work.
