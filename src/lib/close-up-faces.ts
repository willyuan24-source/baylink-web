/**
 * Photos whose subject is a close-up of identifiable faces (owner rule, UI-9 DECISIONS 15) and posed group portraits that
 * fill the frame. UI-9 DECISIONS 32 (round 2): such a photo never takes a lead slot (the home lead, the /events lead, each
 * /calendar day's lead, /plan's first pick: lib/lead-rule.ts), released by the owner or not; it stays a feed, row, card
 * and detail picture. A lead goes to the next pick with a photographic ① or ② picture (UI9-IMAGES DECISIONS 26,
 * home-weekend-build.ts, features/events/weekend-lead.ts canLead), never an information card (DECISIONS 21); cover.ts
 * keeps posters, flyers and ④ off a lead by the image's kind. Checked by eye on 10-20 and again on 10-23 on every ① / ②
 * photo that could lead from 10/23 to 11/15 (lanes/UI9-R2-COVER-PICK/tools/lead-photos-*.png). Editorial image data kept
 * in code until the image registry carries the flag (an owner / data task).
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
 * page listed these six keys; UI9-IMAGES DECISIONS 26 left the release to the owner). The release stands (DECISIONS 32):
 * these photos show on their own cards, rows and detail pages. What DECISIONS 32 changed is the arrangement: they still
 * never lead. Never empty this set; a new close-up goes into the flagged list above, unreleased.
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
 * Posed group portraits that fill the frame (DECISIONS 32, round-2 OD4): a stage or booth line-up facing the camera. Fine
 * on a card or a row, never in a lead slot. The four LumaFest volunteers, the Goblin Jamboree families and the seven
 * Presidio staff are on the close-up list above already.
 */
const POSED_GROUPS = [
  'official-sjpl-almaden-sounds-of-south-asia-2026', // Almaden Sounds of South Asia: some thirty musicians and students posing on a stage (home lead 11/9–11/14)
];

/** Every flagged close-up, released or not: none of them takes a lead slot (DECISIONS 32). */
export const CLOSE_UP_FACE_IMAGES: ReadonlySet<string> = new Set(FLAGGED_CLOSE_UPS);
/** Flagged close-ups the owner released for cards, rows and detail pages (tests read it). */
export const RELEASED_CLOSE_UPS: ReadonlySet<string> = new Set(FLAGGED_CLOSE_UPS.filter(key => OWNER_RELEASED.has(key)));
/** Posed group portraits that fill the frame. */
export const POSED_GROUP_IMAGES: ReadonlySet<string> = new Set(POSED_GROUPS);
/**
 * The pictures no lead slot shows (close-ups and posed groups). Posters, flyers and AI pictures are kept off a lead by
 * their kind in cover.ts (a lead takes only a photographic ① or ②), so they are not listed here.
 */
export const NOT_FOR_LEAD: ReadonlySet<string> = new Set([...FLAGGED_CLOSE_UPS, ...POSED_GROUPS]);

/**
 * The image a lead slot may show given the pictures that never lead: none of its own for one of them (the slot draws the
 * item's next candidate). Pure, so a test can pass its own list.
 */
export const leadImageKeyFor = (imageKey: string | undefined, excluded: ReadonlySet<string>): string | undefined =>
  imageKey && excluded.has(imageKey) ? undefined : imageKey;

/**
 * The image a lead slot may show: none of its own for a close-up of faces or a posed group. A page whose candidates all
 * have one (a day where only such an event runs) still leads with that event, with its next candidate (② or ③).
 */
export const leadImageKey = (imageKey: string | undefined): string | undefined => leadImageKeyFor(imageKey, NOT_FOR_LEAD);
