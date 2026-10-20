/**
 * Photos whose subject is a close-up of identifiable faces (owner rule, UI-9 DECISIONS 15: such a photo never leads a page).
 * Checked by eye on the weekend picks' images; an image here can still be a feed or row cover, it only never takes a lead
 * slot: the /events lead and the calendar day's lead (features/events/weekend-lead.ts canLead) and the home lead, where
 * scripts/generate-home-catalog.ts leaves the image out so the 16:9 lead frame shows the event's type cover (captain 10-20).
 * It is editorial image data kept in code until the image registry carries the flag (an owner / data task).
 */
export const CLOSE_UP_FACE_IMAGES: ReadonlySet<string> = new Set([
  'official-r2-petaluma-lumafest-20261024', // LumaFest 10/24: four volunteers posing at a booth, faces sharp and centred
]);
