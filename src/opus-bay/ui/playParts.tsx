/**
 * W6-P1 · the play layer's DOM parts as one chunk (lane P, plan MF9 / D16: GameRoot ≤ 265 KB gzip).
 *
 * Everything here renders only once play has begun (the Overlay's `phase !== 'title'` block and the top stack: the
 * HUD, the dialogue box, the goals card and the moments, the POI / event cards, the coach mark, the touch stick, the
 * floating bubble / waypoint / cinematic layer) or shows nothing under the page's title (the toasts, the screen
 * reader's live regions, ?debug's readout: they render from their stores once the chunk is in), so GameRoot does not
 * carry it: `ui/playLayer.tsx` fetches this chunk as soon as GameRoot's own chunk runs (in parallel
 * with the city chunk and the renderer setup) and GameRoot holds a pressed Start until it is in, so the first frame of
 * play has every part exactly as before. Import these only through `ui/playLayer.tsx` (`lazyPart`), never statically
 * from a module GameRoot loads (tests/opus-bay-sf-budget.test.ts "W6-P").
 */
export { Dialogue } from './Dialogue';
export { EventCard } from './EventCard';
export { CinematicLayer, DebugOverlay, LeadChip, LiveRegion, SpeechBubble, TimeOffer, Toasts, Waypoint } from './Floating';
export { CoachMark, TapHint } from './CoachMark';
export { Hud, RideBanner } from './Hud';
export { FishGame, GoalsCard, PhotoMode, PostcardReward, Recap } from './Moments';
export { PoiCard } from './PoiCard';
export { TouchControls } from '../actors/TouchControls';
// W7-P1: the bubble / waypoint placement around the fixed HUD (game/Systems.tsx reads it through game/hudLayoutSlot.ts)
// eslint-disable-next-line react-refresh/only-export-components -- a plain module the play layer carries, not a component
export * as hudLayout from '../game/hudLayout';
