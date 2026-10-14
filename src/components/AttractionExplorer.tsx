import { useEffect, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, Check, Clock3, Compass, Copy, MapPin, Plus, Rotate3d, Search, Share2, Sparkles, Ticket, X } from 'lucide-react';
import { ATTRACTIONS, ATTRACTION_COSTS, ATTRACTION_REGIONS, ATTRACTION_THEMES, type Attraction } from '../data/attractions';
import { getGuideBySlug } from '../data/guides';
import { getGuideMedia, type GuideImage } from '../data/guide-media';
import { SCENE3D_POSTCARD_FOR, SCENE3D_POSTCARD_IMAGES } from '../data/scene3d-postcards';
import { attractionMapUrl, filterAttractions, loadOuting, MAX_OUTING_STOPS, outingShareUrl, outingText, parseSharedOuting, saveOuting } from '../lib/attraction-plan';
import { getCover } from '../lib/cover';
import { getBayAreaToday } from '../lib/monthly';
import { translateText, useLocale } from '../i18n/locale';
import { ATTRACTION_REGION_INTROS } from '../data/attraction-region-intros';
import { CITY_EXPLORATION_SLUG } from '../data/city-exploration-types';
import { OPUS_BAY_ATTRACTION_ENTRIES, opusBayAttractionEntry } from '../lib/opus-bay-attraction-entry';
import { Button } from './ui/Button';
import { ChipRow, FilterChip } from './ui/Chip';
import { Cover } from './ui/Cover';
import { EmptyState } from './ui/States';
import { PageContainer, PageHeader } from './ui/HeroCard';
import { TypeCover } from './ui/TypeCover';

const available = ATTRACTIONS.filter(item => getGuideBySlug(item.slug));
/**
 * The 3D city is a separate full-page app. Every link into it from /explore says `from=explore` (H36, FCC-11): the
 * "在 3D 旧金山里先看看" module and the place cards' 3D links alike (the cards used to carry the guide entry's `from=guide`,
 * which counted /explore starts as guide starts). Until the Opus session adds `explore` to its ENTRY_SOURCES
 * (src/opus-bay/ui/entrySource.ts, game/metricNames.ts; read-only here), the game files these starts under `direct`.
 */
const fromExplore = (href: string) => {
  const url = new URL(href, 'https://www.baylink.us');
  url.searchParams.set('from', 'explore');
  return url.pathname + url.search;
};
/** SF places with both a published 3D arrival and a 3D postcard: the "在 3D 旧金山里先看看" rail. */
const SCENE3D_RAIL = Object.keys(OPUS_BAY_ATTRACTION_ENTRIES).flatMap(id => {
  const key = SCENE3D_POSTCARD_FOR[id];
  return key && SCENE3D_POSTCARD_IMAGES[key] ? [{ id, key, card: SCENE3D_POSTCARD_IMAGES[key] }] : [];
});
/** After this many cards the 3D module takes one full row of the grid (design.md §4.4: one module every 6–8 cards). */
const MODULE_AFTER = 6;

export function AttractionExplorer({ onAsk }: { onAsk?: (question: string) => void }) {
  const locale = useLocale();
  const english = locale === 'en';
  const t = (zh: string, en: string) => english ? en : translateText(zh, locale);
  const [params, setParams] = useSearchParams();
  const [plan, setPlan] = useState(() => params.has('plan') ? parseSharedOuting(params.get('plan')) : loadOuting());
  const [shared, setShared] = useState(() => params.has('plan'));
  const [notice, setNotice] = useState('');
  const [fallback, setFallback] = useState('');
  const [page, setPage] = useState({ key: '', count: 12 });
  const sharedParam = params.get('plan');
  useEffect(() => {
    setPlan(sharedParam !== null ? parseSharedOuting(sharedParam) : loadOuting());
    setShared(sharedParam !== null);
    setFallback('');
  }, [sharedParam]);
  const today = getBayAreaToday();
  const region = ATTRACTION_REGIONS.some(item => item.id === params.get('region')) ? params.get('region')! : 'all';
  const theme = ATTRACTION_THEMES.some(item => item.id === params.get('theme')) ? params.get('theme')! : 'all';
  const cost = ATTRACTION_COSTS.some(item => item.id === params.get('cost')) ? params.get('cost')! : 'all';
  const query = (params.get('q') || '').slice(0, 150);
  const filtered = filterAttractions(available, { region, theme, cost, query, locale });
  const resultKey = JSON.stringify([region, theme, cost, query]);
  const visibleCount = page.key === resultKey ? page.count : 12;
  const visible = filtered.slice(0, visibleCount);
  const regionIntro = ATTRACTION_REGION_INTROS[region as keyof typeof ATTRACTION_REGION_INTROS];
  const selections = plan.map(id => ATTRACTIONS.find(item => item.id === id)!);
  const show3d = SCENE3D_RAIL.length > 0 && visible.some(item => item.region === 'sf');
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

  const outingPanel = (
    <section id="outing-plan" className="xp-outing-plan" aria-labelledby="outing-plan-title">
      <div className="xp-outing-heading"><h2 id="outing-plan-title">我的出游清单</h2><span>{plan.length} / {MAX_OUTING_STOPS}</span></div>
      <p>最多收藏 6 处，按自己的节奏排序。建议一天先选同一区域的 1–3 处。</p>
      {shared && <div className="xp-outing-shared"><p>正在查看分享的计划；修改后会保存到此浏览器。</p><button type="button" onClick={() => { setPlan(loadOuting()); setShared(false); updateFilter('plan', ''); setNotice('已恢复此浏览器原有的出游清单。'); setFallback(''); }}>恢复本机清单</button></div>}
      {selections.length ? <div className="xp-outing-list"><ol className="xp-outing-stops">{selections.map((item, index) => <li key={item.id}><span className="xp-outing-number">{index + 1}</span><div className="xp-outing-stop-text"><Link to={`/guides/${item.slug}`}>{item.title}</Link><small>{item.city} · {item.duration}</small><a href={attractionMapUrl(item)} target="_blank" rel="noopener noreferrer"><MapPin size={16} aria-hidden="true" />起点地图</a></div><div className="xp-outing-stop-buttons"><button type="button" disabled={index === 0} aria-label={`上移：${item.title}`} onClick={() => move(index, -1)}><ArrowUp size={18} /></button><button type="button" disabled={index === selections.length - 1} aria-label={`下移：${item.title}`} onClick={() => move(index, 1)}><ArrowDown size={18} /></button><button type="button" aria-label={`移除：${item.title}`} onClick={() => toggle(item.id)}><X size={18} /></button></div></li>)}</ol>
        <div className="xp-outing-actions"><Button variant="primary" onClick={share} icon={<Share2 size={18} aria-hidden="true" />}>分享出游清单</Button><Button variant="secondary" onClick={() => copy(outingText(plan, locale), '计划文字、攻略和地图链接已复制。')} icon={<Copy size={18} aria-hidden="true" />}>复制计划文字</Button>{onAsk && <Button variant="secondary" onClick={() => onAsk((translateText('我想安排这些地方的出游：', locale) + selections.map(item => translateText(item.title, locale)).join(', ') + translateText('。请先问我出发地、日期、出行方式和同行人，再结合本站攻略帮我取舍、排序和确认预约事项。不要假定一天都能去完。', locale)).slice(0, 500))} icon={<Sparkles size={18} aria-hidden="true" />}>让 BayBay 帮我取舍</Button>}</div>
        <p>按自己的时间取舍；停留时长不含往返交通，出发前查看预约和开放公告。</p>
      </div> : <p className="xp-outing-empty"><MapPin size={20} aria-hidden="true" /><span>看到喜欢的地方，点「加入清单」。攻略、地图和分享入口会一起留在这里。</span></p>}
      <p>无需登录，仅保存在当前浏览器；跨设备请分享清单链接。</p>
      {notice && <p className="xp-outing-status" role="status">{notice}</p>}
      {fallback && <label className="xp-outing-fallback">手动复制<textarea value={fallback} readOnly rows={4} onFocus={event => event.currentTarget.select()} /></label>}
    </section>
  );
  const planDisclosure = <details className="xp-plan" open={plan.length > 0 || shared}><summary>{'我的出游清单'} · {plan.length}/{MAX_OUTING_STOPS}</summary>{outingPanel}</details>;
  const planOnTop = plan.length > 0 || shared;

  const card = (item: Attraction): ReactNode => {
    const guide = getGuideBySlug(item.slug)!;
    const image = getGuideMedia(guide).cover;
    const cover = getCover({ kind: 'place', id: item.id, imageKey: 'guide', postcardKey: SCENE3D_POSTCARD_FOR[item.id] }, {
      images: key => key === 'guide' ? image : SCENE3D_POSTCARD_IMAGES[key], today,
    });
    const added = plan.includes(item.id);
    const worldEntry = opusBayAttractionEntry(item.id, locale);
    const regionLabel = ATTRACTION_REGIONS.find(entry => entry.id === item.region)!.label;
    return <article key={item.id} className="attraction-card">
      <div className="xp-card__media">
        <Cover cover={cover} ratio="3:2" ratioLock decorative sizes="(max-width: 639px) calc(100vw - 32px), (max-width: 1023px) calc(50vw - 36px), 380px"
          fallback={<TypeCover tone="outdoors" family="guide" label={translateText(regionLabel, locale)} title={translateText(item.title, locale)} ratio="3:2" ratioLock ariaHidden />} />
        <div className="xp-card__caption"><h3><Link to={`/guides/${item.slug}`}>{item.title}</Link></h3><p><MapPin size={16} aria-hidden="true" /><span>{english && translateText(regionLabel, locale) === item.city ? item.city : `${item.city} · ${regionLabel}`}</span></p></div>
      </div>
      <div className="xp-card__body">
        <p className="xp-card__facts"><span><Clock3 size={16} aria-hidden="true" />{item.duration}</span><span><Ticket size={16} aria-hidden="true" />{ATTRACTION_COSTS.find(entry => entry.id === item.cost)!.label}</span></p>
        <p className="xp-card__note">{item.note}</p>
        <div className="xp-card__actions">
          <Button variant="tonal" className="xp-add" aria-pressed={added} aria-label={`${added ? '移出清单' : '加入清单'}：${item.title}`} disabled={!added && plan.length >= MAX_OUTING_STOPS} onClick={() => toggle(item.id)} icon={added ? <Check size={18} aria-hidden="true" /> : <Plus size={18} aria-hidden="true" />}>{added ? '已加入' : '加入清单'}</Button>
          <Link className="xp-text-link" to={`/guides/${item.slug}`}>读完整攻略</Link>
          {worldEntry && <Link className="xp-text-link xp-3d-link" to={fromExplore(worldEntry.href)} reloadDocument><Rotate3d size={18} aria-hidden="true" />{translateText(worldEntry.label, locale)}</Link>}
        </div>
        {cover.tier !== 'type' && <details className="attraction-credit"><summary>{cover.tier === 'scene3d' ? t('图片说明', 'About this picture') : '照片来源'}</summary><p>{cover.image.caption}</p>{cover.image.creditUrl ? <a href={cover.image.creditUrl} target="_blank" rel="noopener noreferrer">{cover.image.credit}</a> : <p>{cover.image.credit}</p>}{cover.image.licenseUrl && <a href={cover.image.licenseUrl} target="_blank" rel="noopener noreferrer">授权说明</a>}</details>}
      </div>
    </article>;
  };

  const scene3dModule = <section key="scene3d" className="xp-3d" aria-labelledby="xp-3d-title">
    <div className="xp-3d__head">
      <div><h2 id="xp-3d-title">{t('在 3D 旧金山里先看看', 'Look around in 3D San Francisco first')}</h2>
        <p>{t('独立的 3D 体验，约 8MB，建议用 Wi-Fi 打开。下面是 3D 场景插图（AI 生成、人工挑选），不是实景照片。', 'A separate 3D experience, about 8 MB, best opened on Wi-Fi. The pictures below are 3D scene illustrations (AI-generated, hand-picked), not photos.')}</p></div>
      <Button variant="tonal" href={fromExplore('/opus-bay')}>{t('打开 3D 旧金山', 'Open 3D San Francisco')}</Button>
    </div>
    <ul className="xp-3d__rail">
      {SCENE3D_RAIL.map(({ id, key, card: postcard }) => {
        const entry = opusBayAttractionEntry(id, locale)!;
        const asset: GuideImage = english ? { ...postcard, alt: postcard.en.alt, caption: postcard.en.caption, credit: postcard.en.credit } : postcard;
        const cover = getCover({ kind: 'place', id, postcardKey: key }, { images: { [key]: asset }, today });
        return <li key={id}><Link className="xp-3d__item" to={fromExplore(entry.href)} reloadDocument>
          <Cover cover={cover} ratio="3:2" ratioLock decorative sizes="(max-width: 639px) 70vw, 220px" fallback={null} />
          <span className="xp-3d__name">{english ? postcard.subject.en : translateText(postcard.subject.zh, locale)}</span>
          <span className="xp-3d__go">{translateText(entry.label, locale)}</span>
        </Link></li>;
      })}
    </ul>
  </section>;

  const cards: ReactNode[] = visible.map(card);
  if (show3d) cards.splice(Math.min(MODULE_AFTER, cards.length), 0, scene3dModule);

  return <PageContainer className="xp-page">
    <PageHeader title={t('湾区景点探索', 'Explore the Bay Area')} lede={t('按地区、兴趣或门票筛选；收藏想去的地方，排成一天的出游清单。', 'Filter by area, interest or admission, save the places you like and line them up for a day out.')} />
    <section className="xp-filters" aria-label="筛选湾区景点">
      <ChipRow label="选择地区">{ATTRACTION_REGIONS.map(item => <FilterChip key={item.id} selected={region === item.id} onClick={() => updateFilter('region', item.id)}>{item.label}</FilterChip>)}</ChipRow>
      <div className="xp-filter-row">
        <label className="xp-search"><Search size={18} aria-hidden="true" /><span className="sr-only">搜索景点</span><input type="search" value={query} maxLength={150} placeholder="搜索景点、城市或兴趣" onChange={event => updateFilter('q', event.target.value)} /></label>
        <label className="xp-select"><span className="sr-only">选择兴趣</span><select value={theme} onChange={event => updateFilter('theme', event.target.value)}>{ATTRACTION_THEMES.map(item => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
        <label className="xp-select"><span className="sr-only">门票条件</span><select value={cost} onChange={event => updateFilter('cost', event.target.value)}>{ATTRACTION_COSTS.map(item => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
      </div>
      <details className="xp-note"><summary>{t('费用与时长说明', 'About costs and visit times')}</summary><p>「主体免费」不含交通、停车、餐饮或额外项目。停留时长是编辑建议，不含往返交通。</p></details>
    </section>
    {planOnTop && planDisclosure}
    {regionIntro && <section className="attraction-region-intro" aria-labelledby="attraction-region-title">
      <h2 id="attraction-region-title">{regionIntro.title}</h2>
      <p>{regionIntro.text}</p>
      <p><strong>安排这一区</strong> · {regionIntro.planning}</p>
    </section>}
    <div className="xp-results-heading"><h2>选一个想去的地方</h2><span role="status">{english ? `${filtered.length} ${filtered.length === 1 ? 'place' : 'places'} to explore` : `${filtered.length} ${translateText('处可探索', locale)}`}</span></div>
    {plan.length >= MAX_OUTING_STOPS && <p className="xp-cap-note">清单最多放 6 处。先移除一处，或把剩下的留给下次。</p>}
    {filtered.length ? <div className="xp-grid">{cards}</div>
      : <EmptyState icon={Compass} title={'换个范围，可能就有新发现。'} body={'试试减少条件，或用城市、景点的中英文名称搜索。'}
        actions={<Button variant="primary" onClick={resetFilters}>{'重置景点筛选'}</Button>} />}
    {filtered.length > visibleCount && <div className="xp-more-row"><Button variant="tonal" onClick={() => setPage({ key: resultKey, count: visibleCount + 12 })}>{english ? `Show more places (${visibleCount}/${filtered.length})` : `继续发现更多（${visibleCount}/${filtered.length}）`}</Button></div>}
    {!planOnTop && planDisclosure}
    <details className="xp-plan xp-more">
      <summary>{t('更多安排：城市攻略、计划与搭子', 'More: city guides, plans and groups')}</summary>
      <nav className="xp-more-links" aria-label={t('继续安排出游', 'Continue planning your outing')}>
        <Link to={`/plan?places=${plan.join(',')}`}><Sparkles size={18} aria-hidden="true" />{plan.length ? t('在地图里安排完整清单', 'Arrange all saved stops on the map') : '让 BayBay 帮我排一天'}</Link>
        <Link to={`/guides/${CITY_EXPLORATION_SLUG}${locale === 'zh-Hans' ? '' : `?lang=${locale}`}`}><Compass size={18} aria-hidden="true" />{'按城市探索：九县 101 城景点与生活指南'}</Link>
        <Link to="/my-week">{'我的这周'}</Link>
        <Link to="/together">{t('找搭子，一起出门', 'Go together')}</Link>
      </nav>
    </details>
    <nav className="xp-next" aria-label={t('顺路看看', 'Also worth a look')}><Link to="/events">{t('本周末活动', 'This weekend')}</Link><Link to="/guides">{'全部生活指南'}</Link><Link to="/tools?tool=split">{'出游费用分账'}</Link></nav>
  </PageContainer>;
}
