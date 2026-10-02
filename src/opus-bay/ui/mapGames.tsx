import { useMemo } from 'react';
import type { Vec2 } from '../core/types';
import { type PlaceTripDest, startPlaceTrip } from '../game/placeTrips';
import { useT } from '../i18n';
import { type MapView, toPx } from './cityMapDraw';
import { PLAY_VIOLET } from './mapFilterRules';
import { MapGoCard } from './MapGoCard';
import { GAME_ICONS } from './gameIcons';
import { useTripOptions } from './PlaceActions';
import './mapGames.css';
import { DEX_GAMES, gamePins, nearestGames, type GamePin } from './playDexData';

/**
 * Wave 9 · lane G · W9-G2 · the map's 玩 layer (review 2026-10-01 R§5 #13: "地图没有「玩」的筛选"): under the 玩 chip
 * (ui/mapFilterRules.ts) every mini-game's spot is a violet pin with the game's icon (ui/playDexData.ts); a tap opens the
 * pinned card — the game, where and the go button (a trip to the game's own prompt). CityMap
 * places them like lane R's event pins (laid out every render: ≈ 37 pins, no memo).
 */

const ALL_PINS: readonly GamePin[] = gamePins();
const pinByKey = new Map(ALL_PINS.map(p => [p.key, p]));
// eslint-disable-next-line react-refresh/only-export-components
export const gamePinByKey = (key: string | null): GamePin | null => (key ? pinByKey.get(key) ?? null : null);

export interface LaidGamePin { pin: GamePin; x: number; y: number }
/** The pins in the frame under the 玩 chip (none under the others). */
// eslint-disable-next-line react-refresh/only-export-components
export function layGamePins(filter: string, view: MapView | null): LaidGamePin[] {
  if (filter !== 'play' || !view) return [];
  const out: LaidGamePin[] = [];
  for (const pin of ALL_PINS) {
    const [x, y] = toPx(view, pin.at.x, pin.at.z);
    if (x > -14 && y > -14 && x < view.w + 14 && y < view.h + 14) out.push({ pin, x, y });
  }
  return out;
}

/** The pin under a tap at frame pixel (x, y) within 18 px (the nearest), else null. */
// eslint-disable-next-line react-refresh/only-export-components
export function hitGamePin(pins: readonly LaidGamePin[], x: number, y: number): GamePin | null {
  let best: { pin: GamePin; d: number } | null = null;
  for (const q of pins) { const d = Math.hypot(q.x - x, q.y - y); if (d <= 18 && (!best || d < best.d)) best = { pin: q.pin, d }; }
  return best?.pin ?? null;
}

/** What picking 玩 frames: the player and the spots of the five games nearest to them (empty: nothing to frame). */
// eslint-disable-next-line react-refresh/only-export-components
export function gameFitPoints(player: Vec2 | null): Vec2[] {
  if (!player || !Number.isFinite(player.x) || !Number.isFinite(player.z)) return ALL_PINS.map(p => p.at);
  return [player, ...nearestGames(player, 5, DEX_GAMES).map(n => n.spot)];
}

export function GamePinsLayer({ pins, sel }: { pins: readonly LaidGamePin[]; sel: string | null }) {
  return (
    <>
      {pins.map(({ pin, x, y }) => {
        const Icon = GAME_ICONS[pin.game.icon];
        return (
          <g key={pin.key} className={`mw-gamepin${sel === pin.key ? ' is-on' : ''}`} transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`}>
            <circle className="mw-gamepin-disc" r={11} fill={PLAY_VIOLET} />
            <Icon x={-6.5} y={-6.5} width={13} height={13} strokeWidth={2.4} color="#fff" />
          </g>
        );
      })}
    </>
  );
}

/** The pinned card of a game pin: its name, where, the go button and ⓘ (the journal's 游乐 tab). */
export function GameGoCard({ pinKey, short, onClose }: { pinKey: string; short: boolean; onClose: () => void }) {
  const { t } = useT();
  const pin = gamePinByKey(pinKey);
  const dest = useMemo((): PlaceTripDest | null => (pin ? { placeId: `game:${pin.game.id}`, x: pin.at.x, z: pin.at.z, name: pin.game.name } : null), [pin]);
  const { options, busy } = useTripOptions(dest);
  if (!pin || !dest) return null;
  const rec = options.find(o => o.recommended) ?? options[0] ?? null;
  return (
    <MapGoCard title={pin.game.name} meta={t(pin.game.where)} option={rec} busy={busy && !rec} short={short}
      onGo={o => { startPlaceTrip(o, dest); }} onClose={onClose} />
  );
}
