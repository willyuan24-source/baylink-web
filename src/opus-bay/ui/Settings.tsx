import { useState, type ReactNode } from 'react';
import { Accessibility, Gauge, Keyboard, LogOut, Moon, Music, Pause, RotateCcw, Sun, Sunrise, Sunset, Volume2, ZoomIn } from 'lucide-react';
import { emit } from '../core/events';
import { runtime } from '../core/runtime';
import { game, useGame, type GameState, type Quality } from '../core/store';
import { homeUrl } from '../data/links';
import { clearProgress, keepSetting } from '../data/wishlist';
import { closePanel, restartOnboarding } from '../game/flow';
import { useT } from '../i18n';
import { Keycap, Sheet } from './common';

type Settings = GameState['settings'];
const setSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
  keepSetting(key); // an explicit choice is saved (even over a URL- or auto-applied value)
  game.set(s => ({ settings: { ...s.settings, [key]: value } }));
  emit({ type: 'ui', action: 'select' });
};

/** Pause + settings (Esc). */
export function SettingsPanel() {
  const { t, locale } = useT();
  const settings = useGame(s => s.settings);
  const [confirmReset, setConfirmReset] = useState(false);
  const times: { value: Settings['timeOfDay']; label: string; icon: ReactNode }[] = [
    { value: 'auto', label: t('跟随湾区时间', 'Bay clock'), icon: <Gauge size={15} aria-hidden /> },
    { value: 'morning', label: t('清晨', 'Morning'), icon: <Sunrise size={15} aria-hidden /> },
    { value: 'day', label: t('白天', 'Day'), icon: <Sun size={15} aria-hidden /> },
    { value: 'golden', label: t('黄昏', 'Golden'), icon: <Sunset size={15} aria-hidden /> },
    { value: 'night', label: t('夜晚', 'Night'), icon: <Moon size={15} aria-hidden /> },
  ];
  const qualities: { value: Quality; label: string }[] = [
    { value: 'low', label: t('省电', 'Low') },
    { value: 'mid', label: t('均衡', 'Balanced') },
    { value: 'high', label: t('精美', 'High') },
  ];

  return (
    <Sheet eyebrow={<><Pause size={14} aria-hidden />{t('已暂停', 'Paused')}</>} title={t('设置', 'Settings')} onClose={closePanel} className="ob-settings">
      <div className="ob-setting-group">
        <Toggle icon={<Volume2 size={18} aria-hidden />} label={t('音效', 'Sound effects')} on={settings.sound} onChange={v => setSetting('sound', v)} />
        <Toggle icon={<Music size={18} aria-hidden />} label={t('音乐', 'Music')} on={settings.music} onChange={v => setSetting('music', v)} />
        <Toggle icon={<Accessibility size={18} aria-hidden />} label={t('减少动态效果', 'Reduce motion')} hint={t('关闭镜头晃动、景深和长动画', 'No camera shake, depth of field or long animations')} on={settings.reducedMotion} onChange={v => setSetting('reducedMotion', v)} />
      </div>

      <fieldset className="ob-setting">
        <legend><Gauge size={16} aria-hidden />{t('画质', 'Quality')}</legend>
        <div className="ob-seg" role="radiogroup">
          {qualities.map(q => <button key={q.value} type="button" role="radio" aria-checked={settings.quality === q.value} className={settings.quality === q.value ? 'is-on' : ''} onClick={() => setSetting('quality', q.value)}>{q.label}</button>)}
        </div>
      </fieldset>

      <fieldset className="ob-setting">
        <legend><Sun size={16} aria-hidden />{t('时间', 'Time of day')}</legend>
        <div className="ob-seg is-wrap" role="radiogroup">
          {times.map(item => <button key={item.value} type="button" role="radio" aria-checked={settings.timeOfDay === item.value} className={settings.timeOfDay === item.value ? 'is-on' : ''} onClick={() => setSetting('timeOfDay', item.value)}>{item.icon}{item.label}</button>)}
        </div>
      </fieldset>

      <label className="ob-setting ob-range">
        <span className="ob-range-label"><ZoomIn size={16} aria-hidden />{t('镜头距离', 'Camera distance')}<output>{Math.round(settings.cameraDistance)}</output></span>
        <input type="range" min={7} max={30} step={1} value={settings.cameraDistance} onChange={e => { const v = Number(e.target.value); setSetting('cameraDistance', v); runtime.camera.distance = v; }} />
      </label>

      <details className="ob-controls">
        <summary><Keyboard size={16} aria-hidden />{t('操作说明', 'Controls')}</summary>
        <dl>
          <div><dt><Keycap>W</Keycap><Keycap>A</Keycap><Keycap>S</Keycap><Keycap>D</Keycap></dt><dd>{t('移动（按住 Shift 跑）', 'Move (hold Shift to run)')}</dd></div>
          <div><dt><Keycap>E</Keycap></dt><dd>{t('互动 / 继续对话', 'Interact / continue')}</dd></div>
          <div><dt><Keycap>Q</Keycap></dt><dd>{t('问 BAYBAY（叫她过来）', 'Ask BAYBAY (call her over)')}</dd></div>
          <div><dt><Keycap>Space</Keycap></dt><dd>{t('跳', 'Jump')}</dd></div>
          <div><dt><Keycap>M</Keycap> <Keycap>J</Keycap> <Keycap>P</Keycap></dt><dd>{t('地图 · 旅行本 · 拍照', 'Map · journal · photo')}</dd></div>
          <div><dt><Keycap>R</Keycap></dt><dd>{t('重置镜头 / 卡住时脱困', 'Reset camera / get unstuck')}</dd></div>
          <div><dt>{t('鼠标', 'Mouse')}</dt><dd>{t('点地面走过去，右键拖动转视角，滚轮缩放', 'Click to walk, right-drag to turn, wheel to zoom')}</dd></div>
          <div><dt>{t('触屏', 'Touch')}</dt><dd>{t('点地面走路，双指旋转/缩放', 'Tap to walk, two fingers to turn/zoom')}</dd></div>
        </dl>
      </details>

      <div className="ob-setting-actions">
        <button type="button" className="ob-btn ob-btn-soft" onClick={restartOnboarding}><RotateCcw size={17} aria-hidden /><span>{t('让 BAYBAY 重新打招呼', 'Replay the welcome')}</span></button>
        {confirmReset ? (
          <button type="button" className="ob-btn ob-btn-danger" onClick={() => { clearProgress(); game.set({ postcards: [], goalsDone: [], viewpointUnlocked: false, tour: { active: false, stop: 0, completed: [] } }); setConfirmReset(false); restartOnboarding(); }}>
            {t('确定清空明信片和进度？', 'Really clear postcards & progress?')}
          </button>
        ) : (
          <button type="button" className="ob-btn ob-btn-ghost" onClick={() => setConfirmReset(true)}>{t('重置游戏进度', 'Reset progress')}</button>
        )}
        <a className="ob-btn ob-btn-ghost" href={homeUrl(locale)}><LogOut size={17} aria-hidden /><span>{t('回到 BAYLINK', 'Back to BAYLINK')}</span></a>
      </div>
      <p className="ob-muted ob-center">{t('旅行本（明信片、目标、想去）只存在这台设备上。', 'Your journal (postcards, goals, saves) is stored on this device only.')}</p>
    </Sheet>
  );
}

function Toggle({ icon, label, hint, on, onChange }: { icon: ReactNode; label: string; hint?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} className={`ob-toggle ${on ? 'is-on' : ''}`} onClick={() => onChange(!on)}>
      {icon}
      <span className="ob-toggle-text"><span>{label}</span>{hint && <small>{hint}</small>}</span>
      <span className="ob-switch" aria-hidden><i /></span>
    </button>
  );
}
