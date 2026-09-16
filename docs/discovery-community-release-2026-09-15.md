# Bay Area discovery and community update — September 15, 2026

The monthly edition now contains 55 official events, 33 offers and 11 opening reports. This second pass adds 14 events, seven offers and five businesses. There are 38 October events, including confirmed late-month activities through October 31. Source notes and eligibility details are in the accompanying event and offer/opening research files.

## Finding useful information

The page places events first, then offers, new openings and local guides. Six event cards appear initially; each expansion adds up to 12. Date, region, category, admission, personal interest and public buddy filters combine in the URL. Date order is the default; popularity uses actual server counts. Limited offers preview in expiration order. Six recently verified open businesses appear before announcements; an announcement never becomes “open” just because its forecast date passes.

## Sharing and returning

Each event, offer and opening has a permanent detail page with conditions, official sources and routes back to the monthly edition. The 99 detail pages and 62 guides have individual BAYLINK social preview cards. Cards use the site's green palette, logo, title, date, summary when space permits and a QR code that opens that exact item. Text sharing includes brand, conditions and a language-aware detail URL. Supported devices can use native sharing; clipboard and downloadable PNG controls provide fallbacks. Cancelling a native share does not copy automatically. Unavailable images never produce a false download-success message.

The 161 PNGs are generated during the build from licensed, bundled Noto Sans SC fonts. Generated assets are not stored in Git. `npm run verify:share-cards` independently decodes every PNG's QR code and checks its dimensions and destination. `npm run check` performs this verification after building; unit tests do not require generated assets on a clean checkout.

## Participation and privacy

Authenticated “Interested” selections are saved against the member and event, with a unique database index and explicit idempotent updates. Public counts include eligible, distinct members. Loading and failed requests show an unavailable state, never fabricated counts. “My interested events” restores saved plans.

“Go together” has a separate, explicit public opt-in. The sheet explains that nickname, avatar and city become visible. Leaving the public list retains private interest; cancelling interest also removes public membership. Existing private messages, profiles, blocking and reporting are reused. Merely reading or joining the list never sends a message. Expired events reject new participation but retain a cancellation path. Backend cancellation retains a historical row; this behavior and the account-data contact path are disclosed in the privacy page.

The companion backend change is commit `b9d2babf129db089920bf32cb81c2a073752355d` in `baylink-api`. Deploy that API before the frontend. Its catalog is exported with `npm run export:events -- ../baylink-backend/data/event-catalog.json`; guide catalogs are exported separately. Counts and public buddy lists were checked against the deployed API without creating production participation or messages.

## Validation

- Backend: 101 passing tests, including duplicate prevention, account eligibility, public-profile projection, block filtering, expiry, catalog validation and real Mongoose update validation with a mocked collection.
- Frontend: full suite passed with 369 tests before one additional route-classification case; the expanded 11-case detail suite also passed separately. Sharing, auth transitions, delayed responses, consent, exit/cancellation and error states are covered.
- TypeScript and production build passed; 181 public pages and sitemap entries were prerendered without fetching private or live member data.
- ESLint: no errors; 38 pre-existing warnings. Existing large-bundle warnings remain visible.
- All 161 PNG dimensions and direct-link QR codes passed independent decoding. Desktop share-sheet and 390-pixel mobile details were visually checked; English editorial content and category navigation were checked.

Social apps decide how they present link previews. The branded downloadable image is also available for sharing the site's appearance directly. The generated card edition is Chinese; the text and destination interface support the site's languages.
