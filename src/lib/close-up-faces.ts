/**
 * Photos whose subject is a close-up of identifiable faces (owner rule, UI-9 DECISIONS 15: such a photo never leads a page).
 * An image here can still be a feed or row cover; it only never takes a lead slot: the /events lead and the calendar day's
 * lead (features/events/weekend-lead.ts canLead) and the home lead: the lead is the next pick with a ① or ② picture
 * (UI9-IMAGES DECISIONS 26, home-weekend-build.ts), never an information card (DECISIONS 21); cover.ts never puts ④ on a
 * lead. The home catalog keeps the photo for the feed and /plan. Checked by eye
 * on 10-20 on every image that could lead from 10/20 to 11/9: the home leads, the /events weekend leads and each day's
 * /calendar lead in every region (the acceptance review found the Ferry Plaza vendor leading /calendar). It is editorial
 * image data kept in code until the image registry carries the flag (an owner / data task); the owner may release an entry.
 */
const FLAGGED_CLOSE_UPS = [
  'official-r2-petaluma-lumafest-20261024', // LumaFest 10/24: four volunteers posing at a booth, faces sharp and centred
  'official-ferry-plaza-farmers-market-2026-autumn', // Ferry Plaza: one vendor, waist up, looking at the camera, centred
  'official-sausalito-goblin-jamboree-2026', // Goblin Jamboree: two women and four costumed girls posing close up
  'official-nov2026-presidio-dia-muertos-diwali', // Presidio Día de los Muertos: seven staff posing side by side
  'official-pacl-rinconada-tai-chi-2026', // Rinconada tai chi: one man in full figure, face sharp, centred (kept off to be safe)
  'official-chsa-lily-qi-book-talk-nov8-2026', // CHSA book talk poster: the speaker's head-and-shoulders portrait is half of it
];

/**
 * Released by the owner in chat on 2026-10-21 09:28 PT: 「圖片全部批准」 (the close-up section of the UI9-IMG-B1a approval
 * page listed these six keys; UI9-IMAGES DECISIONS 26 left the release to the owner). A released key leads like any other
 * photo. The flagged list stays above as the record of what was checked; a new close-up goes there unreleased.
 */
const OWNER_RELEASED: ReadonlySet<string> = new Set([
  'official-r2-petaluma-lumafest-20261024',
  'official-ferry-plaza-farmers-market-2026-autumn',
  'official-sausalito-goblin-jamboree-2026',
  'official-nov2026-presidio-dia-muertos-diwali',
  'official-pacl-rinconada-tai-chi-2026',
  'official-chsa-lily-qi-book-talk-nov8-2026',
]);

/**
 * The close-ups that still never lead: flagged and not released by the owner (none since 2026-10-21). Approved AI covers
 * never lead either, but by the lead rule (lib/lead-rule.ts; cover.ts refuses ④ on a lead, DECISIONS 24), not by this list.
 */
export const CLOSE_UP_FACE_IMAGES: ReadonlySet<string> = new Set(FLAGGED_CLOSE_UPS.filter(key => !OWNER_RELEASED.has(key)));
/** Flagged close-ups the owner released (tests read it). */
export const RELEASED_CLOSE_UPS: ReadonlySet<string> = new Set(FLAGGED_CLOSE_UPS.filter(key => OWNER_RELEASED.has(key)));

/**
 * The image a lead slot may show given the close-ups that still never lead: none of its own for one of them (the slot draws
 * the item's next candidate). Pure, so a test can pass a close-up the owner has not released (the list
 * is empty since 2026-10-21, and the rule still binds the next one flagged).
 */
export const leadImageKeyFor = (imageKey: string | undefined, closeUps: ReadonlySet<string>): string | undefined =>
  imageKey && closeUps.has(imageKey) ? undefined : imageKey;

/**
 * The image a lead slot may show: none of its own for a close-up of faces. A page whose candidates all have one (a day where
 * only such an event runs) still leads with that event, with its next candidate (a ③ category photo).
 */
export const leadImageKey = (imageKey: string | undefined): string | undefined => leadImageKeyFor(imageKey, CLOSE_UP_FACE_IMAGES);
