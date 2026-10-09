import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Bookmark, CalendarDays, Check, Compass, Heart, LockKeyhole, MapPin, SlidersHorizontal } from 'lucide-react';
import { usePlannerLibrary } from '../../lib/planner-library';
import type { Preferences } from '../../lib/planner';
import type { UserData } from '../../lib/types';
import { translateText, useLocale } from '../../i18n/locale';
import { profileExplorationSteps } from './profile-exploration';

const REGIONS = [{ id: 'sf', label: '旧金山' }, { id: 'east-bay', label: '东湾' }, { id: 'peninsula', label: '半岛' }, { id: 'south-bay', label: '南湾' }, { id: 'north-bay', label: '北湾' }];
const INTERESTS = [{ id: 'food', label: '美食' }, { id: 'outdoors', label: '户外' }, { id: 'culture', label: '文化' }, { id: 'family', label: '亲子' }];
const STEPS = {
  introduce: { title: '用一句话认识你', description: '近况、兴趣或想一起做的事，选一种就好。', action: '编辑名片', icon: Heart },
  preferences: { title: '找到自己的节奏', description: '选择常去地区、喜欢的活动或出行方式。', action: '设置偏好', icon: SlidersHorizontal },
  save: { title: '留住一个好去处', description: '把活动、景点或攻略收藏到“我的这周”。', action: '去找灵感', icon: Bookmark },
  plan: { title: '把期待排成一天', description: '从一站开始，保存一份自己的出游计划。', action: '开始安排', icon: CalendarDays },
};

type PlannerLibraryState = ReturnType<typeof usePlannerLibrary>;
type PersonalSpaceProps = { user: UserData; onEdit: () => void };

/** /me passes the library it already reads for the My Week count, so the account is read once per visit. */
export function ProfilePersonalSpace({ library, ...props }: PersonalSpaceProps & { library?: PlannerLibraryState }) {
  return library ? <PersonalSpace {...props} library={library} /> : <OwnLibraryPersonalSpace {...props} />;
}
function OwnLibraryPersonalSpace(props: PersonalSpaceProps) {
  return <PersonalSpace {...props} library={usePlannerLibrary(props.user.id)} />;
}

function PersonalSpace({ user, onEdit, library }: PersonalSpaceProps & { library: PlannerLibraryState }) {
  const locale = useLocale();
  const t = (text: string) => translateText(text, locale);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [journeyOpen, setJourneyOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const steps = profileExplorationSteps(user, library.ready ? library.data : null);
  const complete = steps.filter(step => step.complete === true).length;
  const { preferences } = library.data;
  const disabled = library.busy || !library.ready;
  const save = async (next: Preferences) => {
    setSaveStatus('');
    const saved = await library.savePreferences(next);
    if (saved) setSaveStatus('偏好已保存。');
  };
  const toggle = (field: 'regions' | 'interests', id: string) => void save({ ...preferences,
    [field]: preferences[field].includes(id) ? preferences[field].filter(value => value !== id) : [...preferences[field], id],
  });

  return <div className="profile-personal-space member-profile-wide">
    <section className="profile-exploration" aria-labelledby="profile-exploration-title">
      <header><div><span className="profile-private-label"><LockKeyhole size={13} aria-hidden="true" />{t('仅自己可见')}</span><h2 id="profile-exploration-title">{t('我的探索路线')}</h2><p>{t('一点点认识湾区，按自己的节奏来。')}</p></div><span className="profile-exploration-mark" aria-hidden="true"><Compass size={34} /></span></header>
      <div className="profile-exploration-progress"><span>{t('已准备')}</span><strong>{library.ready ? `${complete} / 4` : '— / 4'}</strong><div className="profile-exploration-track" aria-hidden="true"><span style={{ width: library.ready ? `${complete * 25}%` : '0%' }} /></div></div>
      {library.loading && <p role="status" className="profile-space-notice">{t('正在读取你的收藏与计划…')}</p>}
      {!library.loading && !library.ready && <div role="alert" className="profile-space-notice"><p>{t('暂时无法读取探索进度，已保存的内容不会因此消失。')}</p><button type="button" onClick={() => void library.refresh()}>{t('重新读取')}</button></div>}
      <button type="button" className="profile-exploration-toggle" aria-expanded={journeyOpen} aria-controls="profile-exploration-steps" onClick={() => setJourneyOpen(open => !open)}>{t(journeyOpen ? '收起探索步骤' : '查看探索步骤')}<ChevronRight size={15} aria-hidden="true" /></button>
      {journeyOpen && <ol id="profile-exploration-steps" className="profile-exploration-steps">{steps.map(step => { const item = STEPS[step.id]; const Icon = item.icon;
        return <li key={step.id} data-complete={step.complete === true}><span className="profile-step-icon" aria-hidden="true">{step.complete ? <Check size={18} /> : <Icon size={18} />}</span><div><h3>{t(item.title)}</h3><p>{t(item.description)}</p><small>{t(step.complete === true ? '已准备好' : step.complete === null ? '待读取' : '随时开始')}</small></div>{step.id === 'introduce' ? <button type="button" onClick={onEdit}>{t(item.action)}<ChevronRight size={14} aria-hidden="true" /></button> : step.id === 'preferences' ? <button type="button" onClick={() => { setPreferencesOpen(true); document.getElementById('profile-personal-preferences')?.scrollIntoView?.({ block: 'nearest', behavior: 'auto' }); }}>{t(item.action)}<ChevronRight size={14} aria-hidden="true" /></button> : <Link to={step.complete ? '/my-week' : '/plan'}>{t(step.complete ? '去看看' : item.action)}<ChevronRight size={14} aria-hidden="true" /></Link>}</li>;
      })}</ol>}
      <footer><p>{t('根据当前名片、偏好、收藏与计划显示；不是到访记录或信用等级，也不需要连续打卡。')}</p><Link to="/together">{t('想有人同行？看看一起去')}<ChevronRight size={15} aria-hidden="true" /></Link></footer>
    </section>
    <section id="profile-personal-preferences" className="profile-private-preferences" aria-labelledby="profile-preferences-title">
      <header><div><span className="profile-private-label"><LockKeyhole size={13} aria-hidden="true" />{t('仅自己可见')}</span><h2 id="profile-preferences-title">{t('我的出行偏好')}</h2><p>{t('地区与兴趣用于“我的这周”；交通方式用于新建计划的默认选择。这些偏好不会公开。')}</p></div><button type="button" aria-expanded={preferencesOpen} aria-controls="profile-preferences-controls" onClick={() => setPreferencesOpen(open => !open)}>{t(preferencesOpen ? '收起设置' : '调整偏好')}<SlidersHorizontal size={16} aria-hidden="true" /></button></header>
      {library.ready && !preferencesOpen && <div className="profile-preferences-summary"><MapPin size={14} aria-hidden="true" /><span>{preferences.regions.length ? preferences.regions.map(id => t(REGIONS.find(region => region.id === id)?.label || id)).join(' · ') : t('所有地区都可以')}</span><Link to="/my-week">{t('看看适合这周的活动')}<ChevronRight size={14} aria-hidden="true" /></Link></div>}
      {preferencesOpen && <div id="profile-preferences-controls">
        {library.error && <p role="alert" className="profile-space-notice">{t(library.ready ? '偏好暂未保存，请重试。上次保存的选择仍然保留。' : '请先重新读取资料，再调整偏好。')}</p>}
        <fieldset disabled={disabled}><legend>{t('常去的地区')}</legend><div className="profile-preference-chips">{REGIONS.map(region => <button type="button" key={region.id} aria-pressed={preferences.regions.includes(region.id)} onClick={() => toggle('regions', region.id)}>{t(region.label)}</button>)}</div></fieldset>
        <fieldset disabled={disabled}><legend>{t('喜欢的活动')}</legend><div className="profile-preference-chips">{INTERESTS.map(interest => <button type="button" key={interest.id} aria-pressed={preferences.interests.includes(interest.id)} onClick={() => toggle('interests', interest.id)}>{t(interest.label)}</button>)}</div></fieldset>
        <label className="profile-preference-travel" htmlFor="profile-preference-travel">{t('常用出行方式')}<select id="profile-preference-travel" disabled={disabled} value={preferences.travelMode} onChange={event => void save({ ...preferences, travelMode: event.target.value })}><option value="any">{t('暂未决定')}</option><option value="drive">{t('开车')}</option><option value="transit">{t('公共交通')}</option><option value="walk">{t('步行')}</option></select></label>
        <p className="profile-space-hint">{t('不选地区或活动类型，表示不限。每次修改会自动保存到当前账号。')}</p>
        <p role="status" className="profile-space-status">{library.busy ? t('正在保存偏好…') : t(saveStatus)}</p>
        <Link className="profile-preferences-next" to="/my-week">{t('看看适合这周的活动')}<ChevronRight size={16} aria-hidden="true" /></Link>
      </div>}
    </section>
  </div>;
}
