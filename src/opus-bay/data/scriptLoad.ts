import * as SCRIPT from './script';
import { registerScript } from './scriptSlot';
import { DISTRICT_POSTCARD_TEXTS } from './postcardTexts';
import { fillPostcardTexts } from './postcards';

/**
 * W7-P3 · loaded with the play layer's chunk (ui/playParts.tsx imports this): points data/scriptSlot.ts's bindings at the
 * dialogue script before GameRoot lets Start through.
 */
registerScript(SCRIPT);
/** W8-P4 · and fills the district postcards' words (data/postcardTexts.ts) in place, before Start as well. */
fillPostcardTexts(DISTRICT_POSTCARD_TEXTS);
