/**
 * Photos whose subject is a close-up of identifiable faces (owner rule, UI-9 DECISIONS 15: such a photo never leads a page).
 * An image here can still be a feed or row cover; it only never takes a lead slot: the /events lead and the calendar day's
 * lead (features/events/weekend-lead.ts canLead) and the home lead, where scripts/generate-home-catalog.ts leaves the image
 * out so the 16:9 lead frame shows the event's type cover (captain 10-20). Checked by eye on 10-20 on every image that
 * could lead from 10/20 to 11/9: the home leads, the /events weekend leads and each day's /calendar lead in every region
 * (the acceptance review found the Ferry Plaza vendor leading /calendar). It is editorial image data kept in code until
 * the image registry carries the flag (an owner / data task); the owner may release an entry.
 */
export const CLOSE_UP_FACE_IMAGES: ReadonlySet<string> = new Set([
  'official-r2-petaluma-lumafest-20261024', // LumaFest 10/24: four volunteers posing at a booth, faces sharp and centred
  'official-ferry-plaza-farmers-market-2026-autumn', // Ferry Plaza: one vendor, waist up, looking at the camera, centred
  'official-sausalito-goblin-jamboree-2026', // Goblin Jamboree: two women and four costumed girls posing close up
  'official-nov2026-presidio-dia-muertos-diwali', // Presidio Día de los Muertos: seven staff posing side by side
  'official-pacl-rinconada-tai-chi-2026', // Rinconada tai chi: one man in full figure, face sharp, centred (kept off to be safe)
  'official-chsa-lily-qi-book-talk-nov8-2026', // CHSA book talk poster: the speaker's head-and-shoulders portrait is half of it
]);

/**
 * The image a lead slot may show: none (the item's type cover) for a close-up of faces. A page whose candidates all have
 * one (a day where only such an event runs) still leads with that event, in its type cover.
 */
export const leadImageKey = (imageKey: string | undefined): string | undefined =>
  imageKey && CLOSE_UP_FACE_IMAGES.has(imageKey) ? undefined : imageKey;
