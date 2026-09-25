# Continuous Bay immersion verification

## Functional checks

- 680 automated tests pass, including 8 city geography/presence cases, 12 discovery cases, and 8 real-HUD navigation cases.
- City previews preserve the character position and cannot award visits. City arrival follows physical presence with a dwell interval and boundary buffer. Search includes 30 cities/communities and the existing 68 attractions.
- All 9 discoveries are reachable from their attraction route endpoints. Remote previews, overview mode, unconfirmed arrival, incorrect choices and incomplete light sequences cannot collect a keepsake.
- Discovery progress is isolated by account, filters malformed saved values, retains first collection time, and falls back to session-only state when browser storage is unavailable.
- Full ESLint: 0 errors, 48 existing repository warnings. TypeScript and production build pass. Build prerenders 263 pages. Share-card verification validates 238 PNGs and independently decodes their QR destinations.

## Browser review

Desktop Chrome and the in-app browser were used separately. The in-app browser was checked at 390×844, 844×390 and 320×740. These are responsive viewport checks, not physical-phone performance measurements; coarse-pointer selection and joystick behavior retain the existing input tests.

Verified whole-bay labels, city preview, search, close landmark framing, full-screen controls, camera tools, notebook scrolling, navigation, nearby interaction and collection. The Tech flow was played with an intentionally wrong light input followed by Wave → Leaf → Sun, confirming reset then completion. Stanford's observation flow was also completed. Traditional Chinese city and HUD labels were checked in-browser. Local test saves did not write production visits or memories.

## Bugs found and fixed during review

- Changing Canvas between active and demand rendering resets its clock. Three elapsed-time throttles retained their previous timestamps, leaving location reports, map labels and scenery detail temporarily frozen after opening a dialog. Independent delta accumulators now keep their cadence through pause/resume.
- The South Bay overview label was hidden by an overly broad bottom-control exclusion. The exclusion now preserves room for the regional label without placing it on the buttons.
- A discovery post stood directly on the automatic route endpoint. Its visual geometry is now offset beside the stopping point within the interaction radius, while navigation and collection coordinates remain unchanged.
- Three's removed soft-shadow mode was replaced with its supported PCF mode. System reduced-motion changes now reach the scene, freezing decorative animation and removing camera smoothing while preserving player controls.

Higgsfield capability research used no paid generations: **0 credits**. Reference sources and implementation rationale are in `bay-immersion-references-2026-09-25.md`.
