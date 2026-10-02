import { useId, useState, type ReactNode } from 'react';
import { setGlideUnlocked } from '../actors/moveApi';
import { clearSave } from '../data/save';
import { ALargeSmall, Accessibility, AudioLines, Flag, Gauge, Keyboard, Languages, LogOut, MicOff, Moon, Music, Pause, RotateCcw, SlidersHorizontal, Sun, Sunrise, Sunset, Volume2, ZoomIn } from 'lucide-react';
import { setEffectsVolume, setMusicVolume, setVoiceMuted, setVoiceVolume, useAudioLevels } from '../audio/levels';
import { emit } from '../core/events';
import { runtime } from '../core/runtime';
import { game, useGame, type GameState, type Quality } from '../core/store';
import { homeUrl } from '../data/links';
import { clearProgress, keepSetting } from '../data/wishlist';
import { closePanel, restartOnboarding } from '../game/flow';
import { setLandmarkFlagsPref, useLandmarkFlagsPref } from '../game/guidePrefs';
import { useT } from '../i18n';
import { Keycap, Sheet } from './common';
import { LangPills } from './LangPills';
import { useDevice } from './hooks';
import { TEXT_SIZES, setTextSize, useTextSize } from './textSize';
import { SILENT_HINT, isIOS } from './shareFile';
import { importRetry } from '../game/importRetry';

type Settings = GameState['settings'];
const setSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
  keepSetting(key); // an explicit choice is saved (even over a URL- or auto-applied value)
  game.set(s => ({ settings: { ...s.settings, [key]: value } }));
  emit({ type: 'ui', action: 'select' });
};

/**
 * G2 w3 review 8 · a progress reset also forgets which of BAYBAY's once-only lines she has said (first bike, first
 * glide, the zone greetings …). A dynamic import: baybayLines stays in its city chunk (the P7 guard walks static imports).
 */
function resetLineMemory() {
  void importRetry(() => import('../game/baybayLines')).then(m => m.clearLineMemory(), () => { /* chunk offline: the memory stays */ });
}

/** Pause + settings (Esc). */
export function SettingsPanel() {
  const { t, locale } = useT();
  const settings = useGame(s => s.settings);
  const city = useGame(s => s.worldMode === 'city');
  // W4-G7 · 显示地标旗: visited attractions keep their flag (a per-device display preference, game/guidePrefs.ts)
  const flags = useLandmarkFlagsPref();
  const [confirmReset, setConfirmReset] = useState(false);
  // W9-A (review R§6 技术: "设置里缺音量滑块、「只关语音」和字号调节；镜头距离滑块没有可访问名称"): lane X's levels
  // (audio/levels.ts, under the 音效 / 音乐 switches) and the text size (ui/textSize.ts)
  const levels = useAudioLevels();
  const text = useTextSize();
  const sizeLabel = (n: number) => (n === 100 ? t('标准', 'Standard') : n === 115 ? t('大', 'Large') : t('特大', 'Larger'));
  // (W7-Q8) the iPhone's silent mode mutes Web Audio: a one-line hint under 音效 on touch iOS (the lead's option a)
  const device = useDevice();
  const silentHint = device === 'touch' && isIOS(typeof navigator !== 'undefined' ? navigator : null) ? t(SILENT_HINT) : undefined;
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
      {/* 语言 / Language: the same three as the title's, switching live (the legend says both words in every edition;
          translate="no": the site's English layer would turn its 语言 into a second "Language") */}
      <fieldset className="ob-setting ob-setting-lang">
        <legend><Languages size={16} aria-hidden /><span translate="no">{t('语言 · Language', 'Language · 语言')}</span></legend>
        <LangPills variant="seg" />
      </fieldset>

      <fieldset className="ob-setting ob-setting-text">
        <legend><ALargeSmall size={16} aria-hidden />{t('文字大小', 'Text size')}</legend>
        <div className="ob-seg" role="radiogroup" aria-label={t('文字大小', 'Text size')}>
          {TEXT_SIZES.map(n => <button key={n} type="button" role="radio" aria-checked={text === n} className={text === n ? 'is-on' : ''} onClick={() => { setTextSize(n); emit({ type: 'ui', action: 'select' }); }}><b>{sizeLabel(n)}</b> <small>{n}%</small></button>)}
        </div>
      </fieldset>

      <div className="ob-setting-group">
        {/* W9-A: the master switch (audio/audio.ts) is 声音, not 音效: the 音效 slider below is the effects alone */}
        <Toggle icon={<Volume2 size={18} aria-hidden />} label={t('声音', 'Sound')} hint={silentHint ?? t('总开关：音乐、音效和 BAYBAY 的语音', 'All of it: music, effects and BAYBAY’s voice')} on={settings.sound} onChange={v => setSetting('sound', v)} />
        <Toggle icon={<Music size={18} aria-hidden />} label={t('音乐', 'Music')} on={settings.music} onChange={v => setSetting('music', v)} />
        <Toggle icon={<MicOff size={18} aria-hidden />} label={t('只关语音', 'Mute voice only')} hint={t('BAYBAY 的配音静音，音乐和音效照常', 'BAYBAY’s voice goes quiet; music and effects play on')} on={levels.voiceMuted} onChange={v => { setVoiceMuted(v); emit({ type: 'ui', action: 'select' }); }} />
        <Toggle icon={<Accessibility size={18} aria-hidden />} label={t('减少动态效果', 'Reduce motion')} hint={t('关闭镜头晃动、景深和长动画', 'No camera shake, depth of field or long animations')} on={settings.reducedMotion} onChange={v => setSetting('reducedMotion', v)} />
        {city && <Toggle icon={<Flag size={18} aria-hidden />} label={t('显示地标旗', 'Landmark flags')} hint={t('去过的大景点也插着小旗', 'Keep the flags over big sights you have visited')} on={flags} onChange={v => { setLandmarkFlagsPref(v); emit({ type: 'ui', action: 'select' }); }} />}
      </div>

      <fieldset className="ob-setting ob-levels">
        <legend><SlidersHorizontal size={16} aria-hidden />{t('音量', 'Volume')}</legend>
        <Level icon={<Music size={16} aria-hidden />} label={t('音乐', 'Music')} name={t('音乐音量', 'Music volume')} value={levels.music} off={!settings.sound || !settings.music} onChange={setMusicVolume} />
        <Level icon={<Volume2 size={16} aria-hidden />} label={t('音效', 'Sound effects')} name={t('音效音量', 'Sound effects volume')} value={levels.effects} off={!settings.sound} onChange={setEffectsVolume} />
        <Level icon={<AudioLines size={16} aria-hidden />} label={t('BAYBAY 的语音', 'BAYBAY’s voice')} name={t('BAYBAY 的语音音量', 'BAYBAY’s voice volume')} value={levels.voice} off={!settings.sound || levels.voiceMuted} onChange={setVoiceVolume} />
      </fieldset>

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
        <span className="ob-range-label"><ZoomIn size={16} aria-hidden />{t('镜头距离', 'Camera distance')}<output aria-hidden>{Math.round(settings.cameraDistance)}</output></span>
        {/* W9-A: the slider's own name (the AX tree read slider "": tech/ax-settings.txt) */}
        <input type="range" min={7} max={30} step={1} value={settings.cameraDistance} aria-label={t('镜头距离', 'Camera distance')} onChange={e => { const v = Number(e.target.value); setSetting('cameraDistance', v); runtime.camera.distance = v; }} />
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
          <div><dt>{t('触屏', 'Touch')}</dt><dd>{t('点地面走过去 · 左边拖动摇杆 · 右边拖动转视角 · 双指缩放', 'Tap the ground to walk · drag left to steer · drag right to look · pinch to zoom')}</dd></div>
        </dl>
      </details>

      <div className="ob-setting-actions">
        <button type="button" className="ob-btn ob-btn-soft" onClick={restartOnboarding}><RotateCcw size={17} aria-hidden /><span>{t('让 BAYBAY 重新打招呼', 'Replay the welcome')}</span></button>
        {confirmReset ? (
          <button type="button" className="ob-btn ob-btn-danger" onClick={() => { clearProgress(); clearSave(); resetLineMemory(); setGlideUnlocked(false); game.set({ postcards: [], goalsDone: [], viewpointUnlocked: false, tour: { active: false, stop: 0, completed: [] } }); setConfirmReset(false); restartOnboarding(); }}>
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

/** W9-A · a volume slider (0–100 %, steps of 5): its own name (`name`: 音乐音量, not the switch's 音乐) and value text; dimmed
 *  while its sound is off. */
function Level({ icon, label, name, value, off, onChange }: { icon: ReactNode; label: string; name: string; value: number; off: boolean; onChange: (v: number) => void }) {
  const id = useId();
  const pct = Math.round(value * 100);
  return (
    <div className={`ob-range ob-level ${off ? 'is-off' : ''}`}>
      <label className="ob-range-label" htmlFor={id}>{icon}{label}<output aria-hidden>{pct}%</output></label>
      <input id={id} type="range" min={0} max={100} step={5} value={pct} aria-label={name} aria-valuetext={`${pct}%`} onChange={e => onChange(Number(e.target.value) / 100)} />
    </div>
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
