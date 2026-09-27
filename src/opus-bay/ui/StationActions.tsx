import { ArrowRight, Clock, Navigation, RotateCw } from 'lucide-react';
import type { Bilingual } from '../core/types';
import { useT } from '../i18n';
import { LINE_ICONS } from './mapIcons';
import { LINE_STYLES, lineStyle, type MapStation } from './mapLines';
import { tripSecondsLabel } from './tripRows';

/** One ride offered at a station: a line to a stop (or a whole lap of the loop). */
export interface StationRide {
  line: string;
  /** the stop to ride to (its TransitStop id + name); a lap ends where it starts */
  to: { stop: string; name: Bilingual };
  /** honest ride seconds (lane T's estimate; waits excluded) */
  seconds?: number | null;
  stops?: number;
  /** a whole lap of the sightseeing loop (坐一圈, BAYBAY narrates) */
  lap?: boolean;
}

/**
 * Wave 4 · the card for a tapped station on the city map (lane P, W4-P7; plan §4.1 "Lines and stations"):
 *   坐 N 线 → 海洋海滩 · 约 2 分钟      (one 48 px row per ride, the ★ stops first as lane T orders them)
 *   带我去车站 · 步行约 1 分钟           (when the player is not at the station)
 *   下一班 约 20 秒                      (the system's ETA)
 * Prop-driven: lane T supplies rides / nextIn, the caller starts the trip (onRide) or the walk (onGo).
 */
export function StationActions({ station, rides, nextIn = null, walkSeconds = null, here = false, onRide, onGo }: {
  station: Pick<MapStation, 'id' | 'name' | 'lines' | 'underground'>;
  rides: readonly StationRide[];
  nextIn?: number | null;
  walkSeconds?: number | null;
  here?: boolean;
  onRide: (r: StationRide) => void;
  onGo: () => void;
}) {
  const { t } = useT();
  const discs: { key: string; text: Bilingual; color: string }[] = [];
  for (const id of station.lines) {
    const st = LINE_STYLES[id];
    if (st && !discs.some(d => d.text.zh === st.disc.zh)) discs.push({ key: id, text: st.disc, color: st.color });
  }
  return (
    <div className="mw-station" role="group" aria-label={t(station.name)}>
      <div className="mw-station-head">
        <span className="mw-discs" aria-hidden>{discs.map(d => <i key={d.key} style={{ background: d.color }}>{t(d.text)}</i>)}</span>
        <strong>{t(station.name)}</strong>
        {nextIn !== null && nextIn !== undefined && (
          <span className="mw-next"><Clock size={13} aria-hidden />{t({ zh: `下一班 ${tripSecondsLabel(nextIn).zh}`, en: `Next ${tripSecondsLabel(nextIn).en}` })}</span>
        )}
      </div>
      {station.underground && <p className="mw-station-note">{t('地下站：从路边的入口进站', 'Underground: in through the street entrance')}</p>}
      <ul className="mw-trip">
        {rides.map(r => {
          const st = LINE_STYLES[r.line] ?? lineStyle({ id: r.line, kind: 'bus', name: { zh: r.line, en: r.line }, color: '#6f5f47' });
          const Icon = r.lap ? RotateCw : LINE_ICONS[st.glyph];
          const time = r.seconds ? tripSecondsLabel(r.seconds) : null;
          const text: Bilingual = r.lap
            ? { zh: `坐一圈${time ? `（${time.zh}，BAYBAY 讲解）` : '（BAYBAY 讲解）'}`, en: `Ride the whole loop${time ? ` (${time.en}, BAYBAY narrates)` : ' (BAYBAY narrates)'}` }
            : { zh: `坐 ${st.ride.zh} → ${r.to.name.zh}`, en: `${st.ride.en} → ${r.to.name.en}` };
          return (
            <li key={`${r.line}:${r.to.stop}:${r.lap ? 'lap' : ''}`}>
              <button type="button" className="mw-trip-row" onClick={() => onRide(r)}>
                <span className="mw-trip-ico" style={{ background: st.color, color: '#fff' }} aria-hidden><Icon size={18} strokeWidth={2.3} /></span>
                <span className="mw-trip-text">
                  <strong>{t(text)}</strong>
                  {!r.lap && r.stops ? <small>{t({ zh: `${r.stops} 站`, en: `${r.stops} stop${r.stops === 1 ? '' : 's'}` })}</small> : null}
                </span>
                {time && !r.lap ? <span className="mw-trip-time">{t(time)}</span> : <ArrowRight size={16} aria-hidden className="mw-trip-go" />}
              </button>
            </li>
          );
        })}
        {!here && (
          <li>
            <button type="button" className="mw-trip-row is-go" onClick={onGo}>
              <span className="mw-trip-ico m-walk" aria-hidden><Navigation size={18} strokeWidth={2.3} /></span>
              <span className="mw-trip-text"><strong>{t('带我去车站', 'Take me to the stop')}</strong></span>
              {walkSeconds ? <span className="mw-trip-time">{t({ zh: `步行${tripSecondsLabel(walkSeconds).zh}`, en: `walk ${tripSecondsLabel(walkSeconds).en}` })}</span> : null}
            </button>
          </li>
        )}
      </ul>
    </div>
  );
}
