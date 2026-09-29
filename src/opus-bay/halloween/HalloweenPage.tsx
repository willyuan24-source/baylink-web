import { useState, useSyncExternalStore } from 'react';
import { Check, MapPin } from 'lucide-react';
import type { Bilingual } from '../core/types';
import type { WearSlot } from '../data/playSave';
import { itemById } from '../economy/items';
import { isPaid, ledgerVersion, subscribeLedger } from '../economy/ledger';
import { openShop } from '../economy/shopRun';
import { owns, wornItem } from '../economy/wallet';
import { goTo } from '../game/goTo';
import { useT } from '../i18n';
import { CostumeArt } from './costumeArt';
import { pumpkinsFound, pumpkinTotal } from './hunt';
import { halloweenGoals } from './progress';
import { halloweenPhase, type HalloweenPhase } from './season';
import { candyCount, doorsKnocked, pageSourceOf, streetGoOffered } from './treat';
import { TREAT_DOORS } from './treatDoors';
import { KNOCK_OUT, TREAT_SOURCES, TREAT_STREETS } from './treatStreets';
import './halloween.css';

/**
 * Wave 6 · lane G (W6-G4) · the 万圣节 page of the Journal (ui/slots registerJournalTab 'halloween', shown in the season):
 * the season's three goals (敲开 5 户人家的门 · 找到 10 个南瓜灯 · 穿上一套万圣节服装), the candy bag and the six
 * trick-or-treat streets (how many doors knocked, 带我去 the next one), the pumpkins found, the four costumes (worn /
 * owned / in the 小铺). Everything is read from the ledger (a Settings reset empties it).
 */

const PHASE_LINE: Readonly<Record<HalloweenPhase, Bilingual>> = {
  season: { zh: '10 月 1–30 日：敲门讨糖、找南瓜灯；天黑后门廊灯更亮。', en: '1–30 October: trick-or-treat and hunt for jack-o’-lanterns; the porch lights glow brighter after dark.' },
  night: { zh: '今晚是万圣节大夜晚：每家都开门，糖果加倍！', en: 'Tonight is Halloween: every door answers, and the treats are doubled!' },
  muertos: { zh: '11 月 1–2 日是亡灵节：万圣节讨糖结束啦。', en: '1–2 November is Día de los Muertos: trick-or-treating is over for the year.' },
  off: { zh: '万圣节是每年 10 月。', en: 'Halloween comes every October.' },
};

const COSTUMES = ['hat-witch', 'hat-pumpkin', 'my-cat-ears', 'my-ghost'];

export default function HalloweenPage() {
  const { t } = useT();
  useSyncExternalStore(subscribeLedger, ledgerVersion, ledgerVersion);
  const [going, setGoing] = useState<string | null>(null);
  const phase = halloweenPhase();
  const goals = halloweenGoals(isPaid);
  const bag = candyCount(isPaid);
  const knocked = doorsKnocked(isPaid);
  const doors = TREAT_DOORS.filter(d => !d.gone);
  // lane H's hunt (halloween/hunt.ts): found this save, and how many there are
  const pumpkins = pumpkinsFound();
  const go = (id: string, x: number, z: number, name: Bilingual) => {
    setGoing(id);
    void goTo({ point: { x, z }, name }, { source: 'halloween:page' }).finally(() => setGoing(null));
  };
  return (
    <div className="ob-hw">
      <div className="ob-nb-head ob-hw-head">
        <p className="ob-nb-today">🎃 {t(PHASE_LINE[phase])}</p>
      </div>

      <h3 className="ob-hw-h">{t('万圣节目标', 'Halloween goals')}</h3>
      <ul className="ob-hw-list">
        {goals.map(g => {
          const done = g.have >= g.need;
          return (
            <li key={g.id} className="ob-hw-card ob-hw-goal" data-done={done ? '' : undefined}>
              <div className="ob-hw-top">
                <span className="ob-hw-check" aria-hidden>{done ? <Check size={14} /> : null}</span>
                <span className="ob-hw-goal-text">{t(g.text)}</span>
                <span className="ob-hw-count">{g.need > 1 ? `${g.have}/${g.need}` : done ? t('完成', 'Done') : ''}</span>
              </div>
              {g.need > 1 && <span className="ob-hw-meter"><span style={{ width: `${Math.round((g.have / g.need) * 100)}%` }} /></span>}
            </li>
          );
        })}
      </ul>

      <h3 className="ob-hw-h">{t(`糖果袋 · ${bag} 颗`, `Candy bag · ${bag}`)}<span className="ob-nb-h-count">{t(`敲开 ${knocked}/${doors.length} 户`, `${knocked}/${doors.length} doors`)}</span></h3>
      <ul className="ob-hw-list">
        {TREAT_STREETS.map(st => {
          const mine = doors.filter(d => d.street === st.id);
          // (W6-G-review: on the big night a street counts tonight's treats; 带我去 only while its doors are dressed)
          const have = mine.filter(d => isPaid(pageSourceOf(phase, d.n))).length;
          const next = mine.find(d => !isPaid(pageSourceOf(phase, d.n))) ?? mine[0];
          const at = next ? { x: next.x + Math.sin(next.f) * KNOCK_OUT, z: next.z + Math.cos(next.f) * KNOCK_OUT } : null;
          return (
            <li key={st.id} className="ob-hw-card ob-hw-street">
              <div className="ob-hw-top">
                <span className="ob-hw-goal-text"><b>{t(st.name)}</b> <span className="ob-muted">· {t(st.area)}</span></span>
                <span className="ob-hw-count">{have}/{mine.length}</span>
                {at && streetGoOffered(phase, have, mine.length) && (
                  <button type="button" className="ob-hw-go" disabled={going !== null} onClick={() => go(st.id, at.x, at.z, st.name)}>
                    <MapPin size={13} aria-hidden /> {going === st.id ? t('出发…', 'Going…') : t('带我去', 'Take me')}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <h3 className="ob-hw-h">{t('南瓜灯', 'Jack-o’-lanterns')}<span className="ob-nb-h-count">{pumpkins}/{pumpkinTotal()}</span></h3>
      <p className="ob-muted ob-hw-note">{t('南瓜灯藏在城里各处，天黑后会发光。', 'They hide all over the city and glow after dark.')}</p>

      <h3 className="ob-hw-h">{t('万圣节服装', 'Costumes')}</h3>
      <ul className="ob-hw-costumes">
        {COSTUMES.map(id => {
          const it = itemById(id);
          if (!it?.costume) return null;
          const worn = it.slot !== 'use' && wornItem(it.slot as WearSlot)?.id === id;
          const owned = owns(id);
          return (
            <li key={id} className="ob-hw-costume" data-on={worn ? '' : undefined}>
              <CostumeArt kind={it.costume} />
              <span className="ob-nb-cap">{t(it.short)}</span>
              <span className="ob-muted ob-hw-state">{worn ? t('穿着', 'Wearing') : owned ? t('已拥有', 'Owned') : t(`${it.price} 金币`, `${it.price} coins`)}</span>
            </li>
          );
        })}
      </ul>
      {phase !== 'off' && <button type="button" className="ob-hw-shop" onClick={() => openShop('more', 'baybay')}>{t('去小铺试穿', 'Try them on in the shop')}</button>}

      <p className="ob-muted ob-hw-src">
        {t('讨糖街资料：', 'Streets: ')}
        <a href={TREAT_SOURCES.realtor.url} target="_blank" rel="noreferrer">rebeccarealtor.com</a> · <a href={TREAT_SOURCES.mommy.url} target="_blank" rel="noreferrer">mommypoppins.com</a>
        {t(`（${TREAT_SOURCES.realtor.verifiedAt} 查证；封街时间以当年公告为准）`, ` (checked ${TREAT_SOURCES.realtor.verifiedAt}; closures change every year)`)}
      </p>
    </div>
  );
}
