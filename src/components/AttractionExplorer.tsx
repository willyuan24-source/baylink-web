import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowRight, ArrowUp, Check, Clock3, Compass, Copy, MapPin, Plus, Search, Share2, Sparkles, Ticket, X } from 'lucide-react';
import { ATTRACTIONS, ATTRACTION_COSTS, ATTRACTION_REGIONS, ATTRACTION_THEMES } from '../data/attractions';
import { getGuideBySlug } from '../data/guides';
import { getGuideMedia } from '../data/guide-media';
import { attractionMapUrl, filterAttractions, loadOuting, MAX_OUTING_STOPS, outingShareUrl, outingText, parseSharedOuting, saveOuting } from '../lib/attraction-plan';
import { translateText, useLocale } from '../i18n/locale';

const available = ATTRACTIONS.filter(item => getGuideBySlug(item.slug));

export function AttractionExplorer({ onAsk }: { onAsk?: (question: string) => void }) {
  const locale = useLocale();
  const [params, setParams] = useSearchParams();
  const [plan, setPlan] = useState(() => params.has('plan') ? parseSharedOuting(params.get('plan')) : loadOuting());
  const [shared, setShared] = useState(() => params.has('plan'));
  const [notice, setNotice] = useState('');
  const [fallback, setFallback] = useState('');
  const sharedParam = params.get('plan');
  useEffect(() => {
    setPlan(sharedParam !== null ? parseSharedOuting(sharedParam) : loadOuting());
    setShared(sharedParam !== null);
    setFallback('');
  }, [sharedParam]);
  const region = ATTRACTION_REGIONS.some(item => item.id === params.get('region')) ? params.get('region')! : 'all';
  const theme = ATTRACTION_THEMES.some(item => item.id === params.get('theme')) ? params.get('theme')! : 'all';
  const cost = ATTRACTION_COSTS.some(item => item.id === params.get('cost')) ? params.get('cost')! : 'all';
  const query = (params.get('q') || '').slice(0, 150);
  const filtered = filterAttractions(available, { region, theme, cost, query, locale });
  const selections = plan.map(id => ATTRACTIONS.find(item => item.id === id)!);
  const updateFilter = (key: string, value: string) => setParams(current => {
    const next = new URLSearchParams(current);
    if (!value || value === 'all') next.delete(key); else next.set(key, value);
    return next;
  }, { replace: true, preventScrollReset: true });
  const resetFilters = () => setParams(current => {
    const next = new URLSearchParams(current);
    ['region', 'theme', 'cost', 'q'].forEach(key => next.delete(key));
    return next;
  }, { replace: true, preventScrollReset: true });
  const changePlan = (next: string[]) => {
    setPlan(next); setShared(false); setFallback('');
    const persisted = saveOuting(next);
    if (persisted && params.has('plan')) updateFilter('plan', '');
    setNotice(persisted ? '出游清单已保存在此浏览器。' : '浏览器未允许保存，刷新后可能丢失。');
  };
  const toggle = (id: string) => {
    if (plan.includes(id)) changePlan(plan.filter(item => item !== id));
    else if (plan.length < MAX_OUTING_STOPS) changePlan([...plan, id]);
    else setNotice('清单最多放 6 处。先移除一处，或把剩下的留给下次。');
  };
  const move = (index: number, delta: number) => {
    const next = [...plan];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    changePlan(next);
  };
  const copy = async (value: string, message: string) => {
    setFallback('');
    try { await navigator.clipboard.writeText(value); setNotice(message); }
    catch { setFallback(value); setNotice('请复制下方内容。'); }
  };
  const share = async () => {
    setFallback('');
    const url = outingShareUrl(plan, locale);
    if (navigator.share) {
      try { await navigator.share({ title: translateText('我的湾区出游清单', locale), url }); setNotice('分享菜单已完成。'); return; }
      catch (error) { if (error instanceof Error && error.name === 'AbortError') return; }
    }
    await copy(url, '出游清单链接已复制，朋友打开就能看到你的顺序。');
  };

  return <div className="attraction-page">
    <header className="attraction-intro">
      <span className="attraction-eyebrow"><Compass size={16} aria-hidden="true" /> YOUR NEXT BAY AREA DAY</span>
      <div><h1>湾区很大，<br /><em>从喜欢的地方出发。</em></h1><p>看海、逛街、走进花园或博物馆。<br />先找到想去的，再慢慢安排这一天。</p></div>
      <div className="attraction-intro-bottom"><span>{available.length} 个出游灵感 · 5 大地区</span><a href="#outing-plan"><MapPin size={16} aria-hidden="true" />我的出游清单 <strong>{plan.length}</strong><ArrowRight size={15} aria-hidden="true" /></a></div>
    </header>
    <section className="attraction-filters" aria-label="筛选湾区景点">
      <div className="attraction-regions" role="group" aria-label="选择地区">{ATTRACTION_REGIONS.map(item => <button type="button" key={item.id} aria-pressed={region === item.id} onClick={() => updateFilter('region', item.id)}>{item.label}</button>)}</div>
      <div className="attraction-filter-row">
        <label className="attraction-search"><Search size={18} aria-hidden="true" /><span className="sr-only">搜索景点</span><input type="search" value={query} maxLength={150} placeholder="搜索景点、城市或兴趣" onChange={event => updateFilter('q', event.target.value)} /></label>
        <label><span className="sr-only">选择兴趣</span><select value={theme} onChange={event => updateFilter('theme', event.target.value)}>{ATTRACTION_THEMES.map(item => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
        <label><span className="sr-only">门票条件</span><select value={cost} onChange={event => updateFilter('cost', event.target.value)}>{ATTRACTION_COSTS.map(item => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
      </div>
      <p>「主体免费」不含交通、停车、餐饮或额外项目。停留时长是编辑建议，不含往返交通。</p>
    </section>
    <div className="attraction-results-heading"><h2>选一个想去的地方</h2><span role="status">{locale === 'en' ? `${filtered.length} ${filtered.length === 1 ? 'place' : 'places'} to explore` : `${filtered.length} ${translateText('处可探索', locale)}`}</span></div>
    {plan.length >= MAX_OUTING_STOPS && <p className="attraction-cap-note">清单最多放 6 处。先移除一处，或把剩下的留给下次。</p>}
    {filtered.length ? <div className="attraction-grid">{filtered.map(item => {
      const guide = getGuideBySlug(item.slug)!;
      const image = getGuideMedia(guide).cover;
      const added = plan.includes(item.id);
      return <article key={item.id} className="attraction-card">
        <Link className="attraction-photo" to={`/guides/${item.slug}`} aria-label={`阅读攻略：${item.title}`}><img src={image.src} srcSet={image.srcSet} sizes="(max-width: 639px) 95vw, (max-width: 1199px) 46vw, 330px" width={image.width} height={image.height} alt={image.alt} loading="lazy" decoding="async" /><span>{ATTRACTION_REGIONS.find(region => region.id === item.region)!.label}</span></Link>
        <div className="attraction-card-body"><span className="attraction-city"><MapPin size={12} aria-hidden="true" />{item.city}</span><h3><Link to={`/guides/${item.slug}`}>{item.title}</Link></h3><p>{item.note}</p>
          <div className="attraction-facts"><span><Clock3 size={14} aria-hidden="true" />{item.duration}</span><span><Ticket size={14} aria-hidden="true" />{ATTRACTION_COSTS.find(cost => cost.id === item.cost)!.label}</span></div>
          <div className="attraction-card-actions"><Link to={`/guides/${item.slug}`}>读完整攻略<ArrowRight size={14} aria-hidden="true" /></Link><button type="button" aria-pressed={added} aria-label={`${added ? '移出清单' : '加入清单'}：${item.title}`} disabled={!added && plan.length >= MAX_OUTING_STOPS} onClick={() => toggle(item.id)}>{added ? <Check size={15} aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />}{added ? '已加入' : '加入清单'}</button></div>
          <details className="attraction-credit"><summary>照片来源</summary><p>{image.caption}</p><a href={image.creditUrl} target="_blank" rel="noopener noreferrer">{image.credit}</a>{image.licenseUrl && <a href={image.licenseUrl} target="_blank" rel="noopener noreferrer">授权说明</a>}</details>
        </div>
      </article>;
    })}</div> : <div className="attraction-empty"><Compass size={30} aria-hidden="true" /><h3>换个范围，可能就有新发现。</h3><p>试试减少条件，或用城市、景点的中英文名称搜索。</p><button type="button" onClick={resetFilters}>重置景点筛选</button></div>}
    <section id="outing-plan" className="outing-plan" aria-labelledby="outing-plan-title">
      <div className="outing-heading"><div><span className="attraction-eyebrow">A LITTLE PLAN, A GOOD DAY</span><h2 id="outing-plan-title">我的出游清单</h2></div><span>{plan.length} / {MAX_OUTING_STOPS}</span></div>
      <p>最多收藏 6 处，按自己的节奏排序。建议一天先选同一区域的 1–3 处。</p>
      {shared && <div className="outing-shared"><p>正在查看分享的计划；修改后会保存到此浏览器。</p><button type="button" onClick={() => { setPlan(loadOuting()); setShared(false); updateFilter('plan', ''); setNotice('已恢复此浏览器原有的出游清单。'); setFallback(''); }}>恢复本机清单</button></div>}
      {selections.length ? <><ol className="outing-stops">{selections.map((item, index) => <li key={item.id}><span className="outing-number">{index + 1}</span><div className="outing-stop-text"><Link to={`/guides/${item.slug}`}>{item.title}</Link><small>{item.city} · {item.duration}</small><a href={attractionMapUrl(item)} target="_blank" rel="noopener noreferrer"><MapPin size={13} aria-hidden="true" />起点地图</a></div><div className="outing-stop-buttons"><button type="button" disabled={index === 0} aria-label={`上移：${item.title}`} onClick={() => move(index, -1)}><ArrowUp size={16} /></button><button type="button" disabled={index === selections.length - 1} aria-label={`下移：${item.title}`} onClick={() => move(index, 1)}><ArrowDown size={16} /></button><button type="button" aria-label={`移除：${item.title}`} onClick={() => toggle(item.id)}><X size={16} /></button></div></li>)}</ol>
        <div className="outing-actions"><button type="button" onClick={share}><Share2 size={17} aria-hidden="true" />分享出游清单</button><button type="button" onClick={() => copy(outingText(plan, locale), '计划文字、攻略和地图链接已复制。')}><Copy size={16} aria-hidden="true" />复制计划文字</button>{onAsk && <button type="button" onClick={() => onAsk((translateText('我想安排这些地方的出游：', locale) + selections.map(item => translateText(item.title, locale)).join(', ') + translateText('。请先问我出发地、日期、出行方式和同行人，再结合本站攻略帮我取舍、排序和确认预约事项。不要假定一天都能去完。', locale)).slice(0, 500))}><Sparkles size={16} aria-hidden="true" />让 BayBay 帮我取舍</button>}</div>
        <p className="outing-note">按自己的时间取舍；停留时长不含往返交通，出发前查看预约和开放公告。</p>
      </> : <div className="outing-empty"><MapPin size={24} aria-hidden="true" /><p>看到喜欢的地方，点「加入清单」。攻略、地图和分享入口会一起留在这里。</p></div>}
      <p className="outing-local-note">无需登录，仅保存在当前浏览器；跨设备请分享清单链接。</p>
      {notice && <p className="outing-status" role="status">{notice}</p>}
      {fallback && <label className="outing-fallback">手动复制<textarea value={fallback} readOnly rows={4} onFocus={event => event.currentTarget.select()} /></label>}
    </section>
    <div className="attraction-next"><span>还有一些生活灵感，值得顺路看看。</span><Link to="/this-month">当月活动<ArrowRight size={15} /></Link><Link to="/guides">全部生活指南<ArrowRight size={15} /></Link><Link to="/tools?tool=split">出游费用分账<ArrowRight size={15} /></Link></div>
  </div>;
}
