# Connected Little Bay — September 25, 2026

## Scope

- San Francisco now has 32 landmarks, including UCSF Parnassus and Mission Bay, SF State, Exploratorium, Stonestown, City Hall, Salesforce Tower and Park, Transamerica Pyramid and Oracle Park.
- Three additional playable regions contain 12 places each: Peninsula, South Bay and East Bay. All four regions share the travel atlas, an in-scene region picker and the same getaway ticket. Regional travel stations provide another way to change regions.
- The 68 landmark anchors follow geographic reference coordinates. Regional coastlines, terrain, roads and buildings are deliberately simplified and enlarged for play. Region changes load a separate scene; this is not seamless street navigation or a real transit itinerary.
- BAYBAY walking and free driving share camera-relative keyboard movement, click-to-walk, touch joystick detection, orbit and view controls. One region renders at a time. Regional scenes stop continuous rendering when paused, hidden or viewing a place panel.
- Real venue photos have captions, archival dates, authors, source links and license links. New regional photos are registered independently of guide covers so a shared guide cannot accidentally supply the wrong venue photo.

## Discoveries

The San Francisco journal now contains 21 virtual memory stamps and five short routes. The new untimed games are the Exploratorium light beacon, SF State campus symbol sequence and City Hall skyline puzzle. Solving a game unlocks a memory choice; only collecting it records the journal stamp. Solved state remains visually consistent after switching journal tabs. Collected discoveries leave small corresponding objects in the scene.

The shared journey stores virtual arrival history separately from journal memories. It recognizes 68 known IDs, ignores malformed or unknown entries, migrates prior SF stamps and isolates guest/account storage. It does not claim physical attendance or award eligibility. Existing Golden Gate Park treasure behavior is retained.

## Visual and interaction review

- Actual desktop inspection of all nine new SF landmarks at 1365 × 900. Corrected Salesforce floor-line placement, Transamerica facade alignment, Salesforce camera spacing and generic scenery obstructing the Exploratorium arrival area.
- Actual 390 × 844 browser viewport review of SF and regional scenes. Corrected regional spawn obstruction, mobile header overlap and missing direct photo access. Region switching remains available inside the game view.
- Exploratorium real photo, enlargement, source/license and place notes reviewed. RGB game played through to a saved stamp, followed by region travel with the saved journal/atlas progress retained.
- The Tech: ground-click walking triggered an arrival and incremented the regional counter once. Selecting a landmark alone did not increment progress.
- Stanford: added the linked real place to the getaway ticket and changed to East Bay; the itinerary remained intact. The regional UI derives its added state from the actual ticket rather than assuming a successful callback.
- East Bay: reviewed USS Hornet and camera rotation, with no captured browser console errors. Keyboard and responsive viewport testing complement automated joystick tests; no claim of a physical-device touch test.
- Final review corrected arrival updates being overwritten on initial mount/account changes, isolated transient journal state by account, and preserved keyboard focus during partial skyline puzzles. Added regression tests reproduce the two timing/focus failures.
- Final model polish adds a dock, gangway and small harbor basin at USS Hornet, The Tech's gray-purple dome and Google Visitor Experience's folded canopy roofs. The harbor and its real photograph were rechecked in the mobile-size view.

## Sources and cost

SF source review is in `mini-sf-civic-landmarks-2026-09-25.md`. Each regional place retains its official visitor URL in `regional-world.ts`; image sources and licenses are in the two landmark photo registries.

Higgsfield tools were considered for generated models. This release uses editable procedural Three.js geometry to retain the existing BAYLINK style and control scene cost. Paid generations submitted: **0**. Higgsfield credits used: **0 / 500 authorized**.

## Verification

- Repository ESLint: no errors; pre-existing warnings remain.
- Full pre-release test run: 626 passing tests before the final regional photo tests were added.
- Final targeted regression/image run: 12 tests passed, including three full-coverage regional photo tests, account-effect arrival timing and skyline focus retention. The suite now contains 631 tests.
- Production build and TypeScript passed. Prerendered 263 public pages; generated and independently verified all 238 share-card QR codes.
- Final changed-file ESLint passed without warnings. Existing repository bundle-size/advisory warnings remain; regional scenes and photo panels load lazily.
