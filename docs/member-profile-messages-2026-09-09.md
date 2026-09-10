# Personal profiles and conversations — 2026-09-09

## Delivered behavior

- Profile cards lead the member page, with four visual themes, a custom photo cover, avatar fallback, status, bio, identity tags, interests, and optional social links. The editor previews public changes live; private contact settings remain separate.
- Public cards show actual shared interests and share a canonical language-specific profile link, with native sharing, clipboard fallback, and manual-copy fallback. Original member text is preserved in every interface language.
- Inbox search covers people, statuses, recent messages and post context. Unread filtering uses server counts. Pins are per-account in this browser.
- Conversations support multi-line composition, IME-safe Enter handling, emoji insertion, text quoting, six reactions, date separators, account-specific drafts, and intentional scrolling to new messages. Contact sharing still requires confirmation.
- Server read state is private to the reader. Only explicitly received message IDs are marked; messages that arrive while the request is running stay unread. Reactions use atomic per-user updates with monotonic versions.

## Validation

Synthetic fixture: scripts/demo-api.mjs, loopback only, no external messaging. Browser checks exercised desktop and 390×844 mobile layouts, profile theme/status save, quoted multi-line messages, reactions, pins and draft reload. English public profile kept member names, status, bio and interests in their original language.

Backend: 73 tests passed, including public-field privacy, image validation/removal, quoted-contact rejection, conversation membership, concurrent reactions and read-arrival races. Backend commit b1fce21db47bbb17c8bed85dccb491afe8464f6d deployed; production public profile returned new fields and no private contact/authentication fields.

Front-end: `npm run check` passed all 284 tests, lint (0 errors, 43 existing warnings), TypeScript, Vite build and 74-page prerender. New messaging tests cover failed-text retention, pending-send recovery, acknowledgement cleanup after closing, storage-denied sending, batches of received message IDs, language controls and account isolation. Explicit sign-out and session expiry clear the current account’s private drafts.

Release uses frontend main → Vercel. The production commit status and current public asset bundle are checked separately before sign-off. Browser write tests used only the loopback fixture, never real member conversations or profile changes.
