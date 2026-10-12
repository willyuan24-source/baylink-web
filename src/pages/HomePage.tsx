import { Suspense, useEffect, useRef, useState } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { ChevronRight, Compass, RotateCw } from 'lucide-react';
import { useApp } from '../app/context';
import { HomeDiscovery } from '../components/HomeDiscovery';
import { loadSearchConversion } from '../i18n/locale';
import type { CommunityBoardProps } from './CommunityBoard';
import { communityBoardFailure, loadCommunityBoard, LoadedCommunityBoard } from './community-board-loader';

// The homepage (/) and the shell of category pages, /?q= searches and the /posts/:id, /users/:id deep links. The
// community board itself is a separate chunk (CommunityBoard.tsx, WEB-HOMEPREP): the homepage's first load does not
// download it; it loads when the board is shown.

/** The 繁→简 search dictionaries are not part of this page's load (WEB-HOMEPREP), but the next page that searches, the
 * search dialog and BayBay wait for them (about 300 ms on a slow phone). Once the page has loaded — or 2 s after it
 * rendered, whichever comes first: on a slow phone the photos hold the load event back for many seconds — and the
 * browser is idle, fetch them, so they are already in when the reader moves on. Not with Save-Data, and not offline: a
 * browser keeps a failed chunk request for the life of the page, so a load attempted offline could not succeed later. A
 * failure is handled as when a page loads them: search matches exact characters, and (online) the app's chunk recovery
 * reloads the page once, as for any chunk that fails (lib/chunk-recovery.ts). */
function useWarmSearchDictionaries() {
  useEffect(() => {
    if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return;
    let idle: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const warm = () => {
      if (navigator.onLine) loadSearchConversion().catch(() => { /* search keeps working on exact characters */ });
    };
    const settled = () => {
      window.removeEventListener('load', settled);
      clearTimeout(timer);
      if (typeof window.requestIdleCallback === 'function') idle = window.requestIdleCallback(warm, { timeout: 2000 });
      else warm();
    };
    if (document.readyState === 'complete') settled();
    else {
      window.addEventListener('load', settled);
      timer = setTimeout(settled, 2000);
    }
    return () => {
      window.removeEventListener('load', settled);
      clearTimeout(timer);
      if (idle !== undefined) window.cancelIdleCallback(idle);
    };
  }, []);
}

/** A direct load of a board URL waits for the board together with this page (main.tsx awaits the page module before
 * the first render), so the prerendered page is replaced once, by the finished board, as before the split. Where the
 * board is the page (a category, a search) and it does not load, this page fails to load with it, as a page chunk that
 * does not load: main.tsx then keeps the useful prerendered page instead of replacing it with the error page. */
const boardIsPage = ({ pathname, search }: Location) => /^(?:\/(?:en|zh-Hant))?\/category\//u.test(pathname)
  || !!new URLSearchParams(search).get('q');
if (typeof window !== 'undefined' && (boardIsPage(window.location) || window.location.hash === '#home-feed-section')) {
  await loadCommunityBoard();
  const failure = communityBoardFailure();
  if (failure !== undefined && boardIsPage(window.location)) throw failure;
}

/** 重新加载 on the board's "could not load" state. A page keeps a chunk request that failed: asking for the same chunk
 * again gets the same failure without a new request (Chrome 154 does, see the lane's retry-probe), so online it reloads
 * the page at the neighborhood anchor, where the board loads before the first render and the page opens on it (as the
 * app's chunk recovery reloads a page). Offline a reload would show the browser's offline page: it tries in place. */
function reloadBoard(retryInPlace: () => void) {
  if (!navigator.onLine) { retryInPlace(); return; }
  const { pathname, search } = window.location;
  window.history.replaceState(window.history.state, '', `${pathname}${search}#home-feed-section`);
  window.location.reload();
}

/** The board's own "could not load" state, in its place; like the board, it scrolls into view when the reader asks for
 * the board (查看邻里信息 sits far above it). */
function BoardUnavailable({ onScrollToFeed, scrollRequest }: CommunityBoardProps) {
  const notice = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!scrollRequest) return;
    const frame = requestAnimationFrame(() => notice.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }));
    return () => cancelAnimationFrame(frame);
  }, [scrollRequest]);
  return <div ref={notice} className="bay-feed-empty" id="home-feed-section" role="status"><Compass size={34} /><h3>连接暂时慢了一点</h3><p>信息未能加载，请稍后重试。</p><button type="button" onClick={() => reloadBoard(onScrollToFeed)} className="bay-button-dark">重新加载<RotateCw size={16} /></button></div>;
}

/** The board once its chunk is in (suspends until then). After a failed load: the error boundary where the board is the
 * page (as for a failed route chunk); on the discovery view, nothing until the reader asks for the board, then the
 * board's own "could not load" state, with 重新加载. */
function CommunityBoardSlot({ required, asked, ...props }: CommunityBoardProps & { required: boolean; asked: boolean }) {
  if (LoadedCommunityBoard) return <LoadedCommunityBoard {...props} />;
  const failure = communityBoardFailure();
  if (failure === undefined) throw loadCommunityBoard();
  if (required) throw failure;
  return asked ? <BoardUnavailable {...props} /> : null;
}

export default function HomePage() {
  const location = useLocation();
  const { categorySlug } = useParams();
  const [loadedAt] = useState(Date.now);
  const [communityExpanded, setCommunityExpanded] = useState(false);
  const [feedScrollRequest, setFeedScrollRequest] = useState(0);
  const { posts, keyword, openBayBay, openSearch } = useApp();
  useWarmSearchDictionaries();
  const scrollToFeed = () => {
    // After the board's chunk failed to load, asking for the board imports it again and the slot suspends on that load:
    // the board, or its "could not load" state. Only an engine that refetches a failed module can succeed here (Node does);
    // Chrome answers from its module map without a request, which is why the notice's 重新加载 reloads the page.
    if (communityBoardFailure() !== undefined) void loadCommunityBoard();
    setCommunityExpanded(true);
    setFeedScrollRequest(request => request + 1);
  };
  const isDiscovery = !keyword && !categorySlug;
  const recentLoadedCount = posts.filter(post => post.createdAt >= loadedAt - 30 * 24 * 60 * 60 * 1000).length;
  // The home shows the board itself only once it has at least four posts from the past 30 days (1007 §4.2 ⑨, HOMEIA-02);
  // until then 邻里信息（测试中）· 去看看 (in HomeDiscovery) opens it, with its own empty, loading and could-not-load states.
  const showBoard = !isDiscovery || recentLoadedCount >= 4 || communityExpanded || location.hash === '#home-feed-section';
  // Where the board is the page (a category, a search), wait for it here: a navigation keeps the previous page on
  // screen meanwhile, as while a route chunk loads, instead of showing this page without its board.
  if (!isDiscovery && !LoadedCommunityBoard && communityBoardFailure() === undefined) throw loadCommunityBoard();

  return (
    <div className={`bay-home${isDiscovery ? ' bay-home-editorial' : ''}`}>
      {isDiscovery && <HomeDiscovery onAskBayBay={openBayBay} onBrowseCommunity={scrollToFeed} onSearch={openSearch} />}
      {showBoard && <Suspense fallback={null}><CommunityBoardSlot required={!isDiscovery} asked={communityExpanded || location.hash === '#home-feed-section'} onScrollToFeed={scrollToFeed} scrollRequest={feedScrollRequest} /></Suspense>}
      {/* The site footer (SiteChrome) closes the home page; the board views keep their community links. */}
      {!isDiscovery && <footer className="bay-home-footer"><span>BAYLINK<span>湾区去哪、怎么办 · 有来源的中文答案</span></span><nav aria-label="关于与帮助"><Link to="/about">认识 BAYLINK<ChevronRight size={14} /></Link><Link to="/guides/baylink-safety-guide">社区安全指南<ChevronRight size={14} /></Link><Link to="/archive">已发布内容目录<ChevronRight size={14} /></Link></nav></footer>}
    </div>
  );
}
