# BAYLINK discovery and everyday tools refresh

Date: 2026-09-09. Continues the user's authorized website improvements and deployment.

## Findings addressed

- Global search only returned guide articles. Added grouped tools, current/upcoming events and attraction results, with corresponding photo thumbnails. The underlying text search still finds passages in guides; identical attraction/guide destinations are deduplicated. Result lists scroll within the dialog, while the search field and keyboard help stay visible. Chinese IME handling remains intact; selecting a suggested query restores input focus.
- The monthly edition had no easy way to plan for a particular weekend. Added today, this weekend and next-seven-days filters, with visible Bay Area calendar dates. URL parameters preserve shareable choices and clearing filters retains language. Tests cover Sunday, DST, leap days, month/year boundaries, combined filters and archived editions.
- Shared bills did not help a diner distinguish tax, service charges and extra tips. Added a dedicated receipt-style dining calculator. Users enter actual tax dollars, choose their own tip percentage and its basis, and see an exact-cent split for 1–100 people. No tax rate is assumed. Service charges and additional tips remain separate. Clipboard denial exposes a selectable manual summary.
- Fresh editorial content was hard to notice. Added two researched guides and corresponding home reading picks, with automatic removal of the cleanup pick after September 19 and pumpkin-season pick after November 15. The user's original monthly illustration remains the leading hero, and Golden Gate Park remains the upper secondary card.
- English header controls could wrap awkwardly on medium desktop widths. Search text now truncates gracefully, action labels stay on one line, and the keyboard hint hides when space is limited.

## Content and imagery

- 54 published guides: new Coastal Cleanup Day and Half Moon Bay pumpkin-season guides.
- 10 monthly activities: new Treasure Island cleanup on September 19, 10 a.m.–noon, with official free participation and advance registration.
- Four distinct licensed photographs, each with its own 480 px variant, about 1 MB total. Captions identify historical photos and never imply current event attendance or current farm arrangements.
- Both guide catalogs are synchronized to the backend for BayBay in Chinese and English. Traditional Chinese remains supported by the editorial conversion layer.
- Sources, inclusion decisions and photo licenses: [fresh-september-sources-2026-09-09.md](fresh-september-sources-2026-09-09.md).

## Validation

- Frontend `npm run check`: 254 tests passed, TypeScript/Vite build passed, 74 public HTML pages prerendered. ESLint has the existing 44 warnings and no errors.
- Backend syntax check and 64 tests passed.
- Browser review at 1280 px and 390 px: Traditional search, grouped photos, English weekend results, Chinese/English calculator, exact example total $114.65 and split ($38.22 × 2 + $38.21), and English new-guide reading with both images. No horizontal overflow or broken images on reviewed pages.
- Production verification scripts in the untracked output directory compare deployed build, both catalogs, new routes, monthly event count and all eight image files. A separate AI request verifies the new pumpkin guide is a cited source in a non-degraded English response.

No posts, account credentials, messages or user drafts were altered by this release.
