import { useEffect, useId, useState } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, BookOpen, CalendarDays, Check, Compass, MapPin, Sparkles, Ticket } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BRAND } from '../brandAssets';
import { getGuideBySlug, guides, type Guide } from '../data/guides';
import { getGuideMedia, GUIDE_IMAGES, type GuideImage } from '../data/guide-media';
import { MONTHLY_EDITION, MONTHLY_EVENTS } from '../data/monthly-edition';
import { getBayAreaToday, getEventStatus, isEditionCurrent } from '../lib/monthly';
import { useLocale } from '../i18n/locale';

const discoveries = [
  {
    id: 'weekend', label: '周末出门', eyebrow: 'LEAVE A LITTLE ROOM FOR WANDERING',
    note: '海岸、红杉和城市散步，挑一篇就能开始安排。',
    hero: ['golden-gate-park-free-car-free-day-guide', 'half-moon-bay-coastal-half-day-guide'],
    picks: [['reinhardt-redwood-first-walk-guide'], ['bay-area-farmers-market-shopping-guide'], ['palo-alto-baylands-family-walk-guide', 'presidio-picnic-day-guide']],
    question: '我想在湾区安排一个轻松的半日出游。请先问我从哪里出发、是否开车和同行人，再推荐适合的散步、亲子或无车路线。',
    placeholder: '例如：从 San Mateo 出发，带孩子玩半天',
  },
  {
    id: 'everyday', label: '日常少麻烦', eyebrow: 'MAKE THE EVERYDAY A LITTLE EASIER',
    note: '借书、出行、买菜和报修，把常用的事慢慢理顺。',
    hero: ['bay-area-library-starter-guide'],
    picks: [['bay-area-without-car-guide'], ['bay-area-repair-request-guide'], ['bay-area-farmers-market-shopping-guide']],
    question: '我想把湾区日常生活安排得更方便。请先问我住在哪个城市、最想解决什么，再结合图书馆、公共交通和生活指南给出具体步骤。',
    placeholder: '例如：刚搬到 Fremont，想办借书证',
  },
  {
    id: 'newcomer', label: '新来先安顿', eyebrow: 'A NEW PLACE, ONE SMALL STEP AT A TIME',
    note: '从落地到通勤，先找到与你的第一周有关的答案。',
    hero: ['bay-area-airport-arrival-guide'],
    picks: [['bay-area-where-to-live-first-month'], ['bay-area-commute-guide'], ['san-jose-guide']],
    question: '我刚来湾区，想安排好第一个月。请先问我工作或学校地点、预算和出行方式，再结合本站指南整理落地、住处与通勤的优先清单。',
    placeholder: '例如：下周到 SFO，要去 Sunnyvale 安顿',
  },
] as const;

const findGuide = (slugs: readonly string[]) => slugs.map(getGuideBySlug).find((guide): guide is Guide => !!guide);
const imageLabel = (image: GuideImage) => image.kind === 'illustration' ? 'AI 原创插图'
  : image.kind === 'poster' ? '官方宣传图'
    : image.credit.includes('官方') ? '官方宣传照片'
      : /资料|往届/.test(image.caption) ? '资料照片' : '实景照片';

function DiscoveryImage({ image, hero = false }: { image: GuideImage; hero?: boolean }) {
  return <div className={`home-discovery-image${image.kind === 'poster' || image.fullFrame ? ' home-discovery-image--full' : ''}`}>
    <img src={image.src} srcSet={image.srcSet} sizes={hero ? '(max-width: 767px) 100vw, (max-width: 1279px) 64vw, 820px' : '(max-width: 639px) 180px, 300px'} alt={image.alt} width={image.width} height={image.height} loading={hero ? 'eager' : 'lazy'} decoding="async" {...(hero ? { fetchpriority: 'high' } : {})} />
    <span className="home-discovery-image-label">{imageLabel(image)}</span>
  </div>;
}

function DiscoveryCredits({ images }: { images: GuideImage[] }) {
  const unique = [...new Map(images.map(image => [image.src, image])).values()];
  return <details className="home-discovery-credits"><summary>本组图片与来源 <ArrowDownRight size={12} aria-hidden="true" /></summary>
    <ul>{unique.map(image => <li key={image.src}><span>{image.caption}</span><small>{image.creditUrl ? <a href={image.creditUrl} target="_blank" rel="noopener noreferrer">{image.credit}<ArrowUpRight size={11} aria-hidden="true" /></a> : image.credit}{image.licenseUrl && <a href={image.licenseUrl} target="_blank" rel="noopener noreferrer">授权说明</a>}</small></li>)}</ul>
  </details>;
}

export function HomeDiscovery({ onAskBayBay, onBrowseCommunity, today: suppliedToday }: {
  onAskBayBay: (question?: string) => void;
  onBrowseCommunity: () => void;
  today?: string;
}) {
  const locale = useLocale();
  const [intent, setIntent] = useState<(typeof discoveries)[number]['id']>('weekend');
  const [question, setQuestion] = useState('');
  const [localToday, setLocalToday] = useState(getBayAreaToday);
  const panelId = useId();
  useEffect(() => {
    const refresh = () => setLocalToday(getBayAreaToday());
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  const today = suppliedToday || localToday;
  const selection = discoveries.find(item => item.id === intent)!;
  const hero = findGuide(selection.hero);
  const freshCleanup = today >= '2026-09-09' && today <= '2026-09-19';
  const pumpkinSeason = today >= '2026-09-09' && today <= '2026-11-15';
  const pickSlugs = intent === 'weekend' ? [
    freshCleanup ? ['bay-area-coastal-cleanup-2026-guide'] : selection.picks[0],
    pumpkinSeason ? ['half-moon-bay-pumpkin-season-2026-guide'] : selection.picks[1],
    today.slice(0, 7) === '2026-09' ? ['bay-area-new-openings-2026-09'] : selection.picks[2],
  ] : selection.picks;
  const picks = pickSlugs.map(findGuide).filter((guide): guide is Guide => !!guide);
  const currentEdition = isEditionCurrent(today);
  const editionPast = today.slice(0, 7) > MONTHLY_EDITION.month;
  const events = MONTHLY_EVENTS.filter(event => getEventStatus(event, today) !== 'ended');
  const editionImage = GUIDE_IMAGES['september-edition'];
  const deals = getGuideBySlug('bay-area-freebies-deals-2026-09');
  const dealsCurrent = deals?.editionMonth === today.slice(0, 7);
  const dealsPast = !!deals?.editionMonth && deals.editionMonth < today.slice(0, 7);
  const dealsMonthLabel = deals?.editionMonth ? `${deals.editionMonth.slice(0, 4)} 年 ${Number(deals.editionMonth.slice(5, 7))} 月` : '';
  const freebieBlock = deals?.blocks.find(block => block.type === 'freebies');
  const offers = freebieBlock?.type === 'freebies' ? freebieBlock.offers : [];
  const datedOffers = offers.filter(item => item.availability === 'dated' && item.startDate?.startsWith(deals?.editionMonth || '') && (item.endDate || item.startDate) >= today);
  const offer = datedOffers.find(item => GUIDE_IMAGES[item.imageKey]?.kind === 'photo') || datedOffers[0] || offers[0];
  const offerImage = offer ? GUIDE_IMAGES[offer.imageKey] : deals ? getGuideMedia(deals).cover : undefined;
  const heroImage = hero ? getGuideMedia(hero).cover : undefined;
  const images = [editionImage, heroImage, offerImage, ...picks.map(guide => getGuideMedia(guide).cover)].filter((image): image is GuideImage => !!image);
  const month = Number(today.slice(5, 7));
  const dateLabel = locale === 'en'
    ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${today}T12:00:00Z`))
    : `${month} 月 ${Number(today.slice(8, 10))} 日`;

  return <section className="home-discovery" aria-label="湾区阅读与探索">
    <header className="home-discovery-heading">
      <div><span className="home-discovery-eyebrow"><Compass size={14} aria-hidden="true" /> THE BAY, A LITTLE CLOSER</span><h1>湾区的日常，{locale === 'en' ? ' ' : null}<span>也值得期待。</span></h1><p>从一段散步、一份攻略，开始发现这里的生活。</p></div>
      <div className="home-discovery-heading-side"><time dateTime={today}><MapPin size={13} aria-hidden="true" />湾区 · {dateLabel}</time><Link to="/explore">按地区找景点 <ArrowUpRight size={17} aria-hidden="true" /></Link><Link to="/guides">读一篇生活指南 <ArrowUpRight size={17} aria-hidden="true" /></Link><button type="button" onClick={onBrowseCommunity}>找本地信息 <ArrowDownRight size={14} aria-hidden="true" /></button></div>
    </header>

    <div className="home-discovery-intents" role="group" aria-label="你想怎么发现湾区">
      <span>今天想…</span>{discoveries.map(item => <button key={item.id} type="button" aria-pressed={intent === item.id} aria-controls={panelId} onClick={() => setIntent(item.id)}>{intent === item.id && <Check size={14} aria-hidden="true" />}{item.label}</button>)}
      <Link to="/guides" className="home-discovery-count">{guides.length} 篇生活指南<ArrowUpRight size={13} aria-hidden="true" /></Link>
    </div>

    <div id={panelId} className="home-discovery-panel">
      <div className="home-discovery-feature-grid">
        <Link to={editionPast ? '/this-month?includeEnded=1' : '/this-month'} className="home-discovery-feature home-discovery-edition" aria-label={`阅读${MONTHLY_EDITION.label}湾区月刊`}>
          <DiscoveryImage image={editionImage} hero />
          <div className="home-discovery-feature-copy"><span>BAYLINK · THE MONTHLY EDIT</span><h2>{currentEdition ? '给这个月，找一个出门的理由。' : '翻一翻，留些出游灵感。'}</h2><p>{currentEdition ? `${events.length} 场尚未结束的活动，附日期、费用与出发前提醒。` : `${MONTHLY_EDITION.label} 活动与去处记录，最新安排请查主办方。`}</p><div><small><CalendarDays size={14} aria-hidden="true" />{MONTHLY_EDITION.label} · {currentEdition ? '本月月刊' : editionPast ? '往期月刊' : '月刊预告'}</small><strong>{currentEdition ? '打开湾区月刊' : '翻阅这期月刊'}<ArrowUpRight size={17} aria-hidden="true" /></strong></div></div>
        </Link>
        <div className="home-discovery-timely">
          {hero && heroImage && <Link to={`/guides/${hero.slug}`} className="home-discovery-guide" aria-label={`阅读：${hero.title}`}>
            <DiscoveryImage image={heroImage} />
            <div className="home-discovery-timely-copy"><span className="home-discovery-card-kicker"><BookOpen size={13} aria-hidden="true" />{hero.categoryLabel} · {hero.readMinutes} 分钟读完</span><h2>{hero.title}</h2><p>{hero.summary}</p><strong>打开这篇攻略 <ArrowUpRight size={15} aria-hidden="true" /></strong></div>
          </Link>}
          {deals && <Link to={`/guides/${deals.slug}#freebie-board-0`} className="home-discovery-deals" aria-label={`查看${deals.title}的领取图鉴`}>
            {offerImage && <DiscoveryImage image={offerImage} />}
            <div className="home-discovery-timely-copy"><span className="home-discovery-card-kicker"><Ticket size={13} aria-hidden="true" />{dealsMonthLabel} · {dealsCurrent ? '本月福利' : dealsPast ? '往期福利' : '福利预告'}</span><h2>顺路领一份，<br />日常的小惊喜。</h2><p>{dealsPast ? '往期领取条件供回顾，不能当作实时优惠。' : 'Target、亲子手工和会员礼，先看日期、名额与领取条件。'}</p><strong>{dealsPast ? '查看往期领取记录' : '打开免费领取图鉴'}<ArrowUpRight size={15} aria-hidden="true" /></strong></div>
          </Link>}
        </div>
      </div>

      <div className="home-discovery-picks-heading"><p aria-live="polite">{intent === 'weekend' && freshCleanup ? '海边做件小事，农场看看秋天，再找一家想去的新店。' : selection.note}</p><Link to="/guides">继续发现<ArrowRight size={14} aria-hidden="true" /></Link></div>
      <div className="home-discovery-picks">{picks.map(guide => <Link to={`/guides/${guide.slug}`} className="home-discovery-pick" key={guide.slug} aria-label={`阅读：${guide.title}`}><DiscoveryImage image={getGuideMedia(guide).cover} /><div><span>{guide.categoryLabel} · {guide.readMinutes} 分钟</span><h3>{guide.title}</h3><ArrowUpRight size={17} aria-hidden="true" /></div></Link>)}</div>
    </div>

    <form className="home-discovery-ai" onSubmit={event => { event.preventDefault(); onAskBayBay(question.trim() || selection.question); }}>
      <div className="home-discovery-ai-intro"><img src={BRAND.baybayAvatar} alt="" width={46} height={46} loading="lazy" /><div><strong>想法有了，怎么安排？</strong><span>让 BayBay 结合指南，帮你理一理。</span></div></div>
      <label><span className="sr-only">告诉 BayBay 你的生活问题</span><input value={question} onChange={event => setQuestion(event.target.value)} placeholder={selection.placeholder} maxLength={500} onKeyDown={event => { if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault(); }} /></label><button type="submit"><Sparkles size={15} aria-hidden="true" />帮我安排<ArrowRight size={15} aria-hidden="true" /></button>
    </form>
    <DiscoveryCredits images={images} />
  </section>;
}
