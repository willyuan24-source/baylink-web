import * as SCRIPT from './script';
import { registerScript } from './scriptSlot';

/**
 * W7-P3 · loaded with the play layer's chunk (ui/playParts.tsx imports this): points data/scriptSlot.ts's bindings at the
 * dialogue script before GameRoot lets Start through.
 */
registerScript(SCRIPT);
