import { Loader } from 'lucide-react';
import type { TripOption } from '../game/tripTypes';
import { useT } from '../i18n';
import { LINE_ICONS, MODE_ICONS } from './mapIcons';
import { optionAria, optionDetail, optionLineGlyph, optionTitle, orderOptions, tripSecondsLabel } from './tripRows';

/**
 * Wave 4 · the ways to get to a place (lane P, W4-P11; plan §4.1 "Phone", §4.2 "带我去 → 跟 BAYBAY 去"): the rows under
 * 其他方式 ▾ in the selected-place card. Prop-driven: lane G's planTrips() gives the options, the caller starts the
 * trip on `onPick` (lane C's startTrip) and closes the sheet. 48 px rows (full width on phones), icon · what · time ·
 * 推荐; a busy state while the planner has not answered.
 */
export function TripOptions({ options, onPick, busy = false, max = 4, picked }: {
  options: readonly TripOption[];
  onPick: (o: TripOption) => void;
  /** the planner is still working (A* time-sliced): show a quiet spinner row */
  busy?: boolean;
  max?: number;
  /** the mode being started (its row shows pressed) */
  picked?: TripOption['mode'] | null;
}) {
  const { t } = useT();
  const rows = orderOptions(options, max);
  return (
    <ul className="mw-trip" aria-label={t('怎么过去', 'Ways to get there')}>
      {rows.map(o => {
        const lineGlyph = optionLineGlyph(o);
        const Icon = lineGlyph ? LINE_ICONS[lineGlyph] : MODE_ICONS[o.mode];
        const detail = optionDetail(o);
        return (
          <li key={`${o.mode}:${o.legs.map(l => (l.via === 'line' ? l.line : l.via)).join('+')}`}>
            <button type="button" className={`mw-trip-row${o.recommended ? ' is-rec' : ''}${picked === o.mode ? ' is-on' : ''}`} onClick={() => onPick(o)} aria-label={t(optionAria(o))}>
              <span className={`mw-trip-ico m-${o.mode}`} aria-hidden><Icon size={20} strokeWidth={2.2} /></span>
              <span className="mw-trip-text">
                <strong>{t(optionTitle(o))}</strong>
                {detail && <small>{t(detail)}</small>}
              </span>
              <span className="mw-trip-time">{t(tripSecondsLabel(o.seconds))}</span>
              {o.recommended && <span className="mw-trip-rec">{t('推荐', 'Best')}</span>}
            </button>
          </li>
        );
      })}
      {busy && (
        <li className="mw-trip-busy" aria-live="polite"><Loader size={16} aria-hidden className="mw-spin" />{t('BAYBAY 在看路线…', 'BAYBAY is checking the way…')}</li>
      )}
      {!rows.length && !busy && <li className="mw-trip-empty">{t('这里暂时去不了', 'No way there right now')}</li>}
    </ul>
  );
}
