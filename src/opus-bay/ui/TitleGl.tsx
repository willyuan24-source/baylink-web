import { ArrowRight, CalendarDays, Sparkles } from 'lucide-react';
import { thisMonthUrl, withLang } from '../data/links';
import { useT } from '../i18n';

/**
 * W9-P2 (lane P; the review's R§6 tech row: no WebGL = the site's generic error page, software GL = 5 fps and no word) ·
 * the title's note when the WebGL probe (game/warmReady.ts probeGl) said
 *   'none'      no 3D on this device / browser: no Start (the game never mounts); this month and the calendar (the title
 *               keeps its own 直接看攻略 link)
 *   'software'  3D only in software (SwiftShader, WARP, llvmpipe): the visit starts at 省电 / Low, Start stays
 * Plain DOM in the page's chunk with the title's own classes (no new CSS).
 */
export function TitleGlNote({ kind }: { kind: 'none' | 'software' }) {
  const { t, locale } = useT();
  if (kind === 'software') {
    return (
      <p className="ob-title-silent" role="note">
        {t('这台设备在用软件模式显示 3D（没有用到显卡），会比较卡，已经换成「省电」画质。也可以先直接看攻略。', 'This device draws the 3D world in software (no graphics card), so it may run slowly — the quality is set to Low. You can also just read the guides.')}
      </p>
    );
  }
  return (
    <div className="ob-title-nogl" role="alert" style={{ display: 'grid', gap: 6 }}>
      <p className="ob-title-silent" style={{ fontSize: 15 }}>{t('这台设备打不开 3D 画面', 'This device can’t show the 3D world')}</p>
      {/* (W9-P-review, P-RP-5) its own line: .ob-title-hint is hidden by the title in short windows and short landscape phones */}
      <p className="ob-title-nogl-why" style={{ margin: 0, fontSize: 13, lineHeight: 1.45, color: 'var(--ob-ink-2)' }}>
        {t('可能是浏览器关掉了硬件加速，或者正在远程桌面里。不玩游戏，也能看到同样的地方和活动：', 'Hardware acceleration may be off in this browser, or you’re on a remote desktop. The same places and events are all here without the game:')}
      </p>
      <a className="ob-title-link" href={thisMonthUrl(locale)}><Sparkles size={16} aria-hidden />{t('这个月湾区有什么', 'This month in the Bay')}<ArrowRight size={15} aria-hidden /></a>
      <a className="ob-title-link" href={withLang('/calendar', locale)}><CalendarDays size={16} aria-hidden />{t('活动日历', 'Event calendar')}<ArrowRight size={15} aria-hidden /></a>
    </div>
  );
}
