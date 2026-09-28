import { bayParts } from '../game/bayNow';
import { serviceRow } from '../data/sf/serviceHours';
import { useT } from '../i18n';
import { LINE_STYLES } from './mapLines';

/**
 * (W5-T7) What the real lines at this station do (data/sf/serviceHours.ts: SFMTA's route pages, with the date they were
 * read): one short row per line, 现在有车 / 现在收车了 by the Bay clock. The game's own cars run round the clock; the
 * rows never change a ride. The sightseeing loop is the game's own line: no row.
 */
export function ServiceRows({ lines }: { lines: readonly string[] }) {
  const { t } = useT();
  const now = bayParts();
  const rows = lines.map(id => serviceRow(id, now)).filter((r): r is NonNullable<typeof r> => !!r);
  if (!rows.length) return null;
  const off = rows.some(r => !r.running);
  const date = rows[0].verifiedAt;
  return (
    <div className="ob-svc" role="group" aria-label={t('现实中的班次', 'Real-world service')}>
      <p className="ob-svc-head">{t('现实中的班次', 'Real-world service')}</p>
      <ul>
        {rows.map(r => (
          <li key={r.line}>
            <i style={{ background: LINE_STYLES[r.line]?.color ?? '#6f5f47' }} aria-hidden />
            <span>{t(r.text)}</span>
            <em className={r.running ? 'is-on' : 'is-off'}>{t(r.state)}</em>
          </li>
        ))}
      </ul>
      <p className="ob-svc-src">{t({
        zh: `来源：SFMTA 线路页（${date} 核对）${off ? ' · 游戏里的车一直开' : ''} · 出门前再查一下`,
        en: `Source: SFMTA route pages (checked ${date})${off ? ' · in the game they always run' : ''} · check before you go`,
      })}</p>
    </div>
  );
}
