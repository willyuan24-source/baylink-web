import { Suspense, useState } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { ChevronRight, Compass, Plus, RotateCw } from 'lucide-react';
import { useApp } from '../app/context';
import { HomeDiscovery } from '../components/HomeDiscovery';
import type { CommunityBoardProps } from './CommunityBoard';
import { communityBoardFailure, loadCommunityBoard, LoadedCommunityBoard } from './community-board-loader';

// The homepage (/) and the shell of category pages, /?q= searches and the /posts/:id, /users/:id deep links. The
// community board itself is a separate chunk (CommunityBoard.tsx, WEB-HOMEPREP): the homepage's first load does not
// download it; it loads when the board is shown.

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

/** The board once its chunk is in (suspends until then). After a failed load: the error boundary where the board is the
 * page (as for a failed route chunk); on the discovery view, nothing until the reader asks for the board, then the
 * board's own "could not load" state, with 重新加载. */
function CommunityBoardSlot({ required, asked, ...props }: CommunityBoardProps & { required: boolean; asked: boolean }) {
  if (LoadedCommunityBoard) return <LoadedCommunityBoard {...props} />;
  const failure = communityBoardFailure();
  if (failure === undefined) throw loadCommunityBoard();
  if (required) throw failure;
  return asked ? <div className="bay-feed-empty" id="home-feed-section" role="status"><Compass size={34} /><h3>连接暂时慢了一点</h3><p>信息未能加载，请稍后重试。</p><button type="button" onClick={() => reloadBoard(props.onScrollToFeed)} className="bay-button-dark">重新加载<RotateCw size={16} /></button></div> : null;
}

export default function HomePage() {
  const location = useLocation();
  const { categorySlug } = useParams();
  const [loadedAt] = useState(Date.now);
  const [communityExpanded, setCommunityExpanded] = useState(false);
  const [feedScrollRequest, setFeedScrollRequest] = useState(0);
  const { posts, keyword, feedError, isInitialLoading, hasMore, openCreate, openBayBay, openSearch } = useApp();
  const scrollToFeed = () => {
    // After the board's chunk failed to load, asking for the board asks for it again (the slot suspends on that load and
    // shows the board, or its "could not load" state)
    if (communityBoardFailure() !== undefined) void loadCommunityBoard();
    setCommunityExpanded(true);
    setFeedScrollRequest(request => request + 1);
  };
  const isDiscovery = !keyword && !categorySlug;
  const recentLoadedCount = posts.filter(post => post.createdAt >= loadedAt - 30 * 24 * 60 * 60 * 1000).length;
  const communityUnavailable = !!feedError && posts.length === 0 && !isInitialLoading;
  const showBoard = !isDiscovery || recentLoadedCount >= 4 || communityExpanded || location.hash === '#home-feed-section' || communityUnavailable;
  // Where the board is the page (a category, a search), wait for it here: a navigation keeps the previous page on
  // screen meanwhile, as while a route chunk loads, instead of showing this page without its board.
  if (!isDiscovery && !LoadedCommunityBoard && communityBoardFailure() === undefined) throw loadCommunityBoard();

  return (
    <div className={`bay-home${isDiscovery ? ' bay-home-editorial' : ''}`}>
      {isDiscovery && <>
        <HomeDiscovery onAskBayBay={openBayBay} onBrowseCommunity={scrollToFeed} onSearch={openSearch} />
        <div className="bay-community-intro"><div><h2>邻里信息</h2><p>{isInitialLoading ? '正在读取当前邻里信息…' : communityUnavailable ? '邻里信息暂时无法读取，请稍后重试。' : `当前${hasMore ? '已加载' : '筛选结果'} ${posts.length} 条，近 30 天发布 ${recentLoadedCount} 条。`}{recentLoadedCount < 4 && !isInitialLoading && !communityUnavailable && '这里还在起步，旧帖请先联系发布者确认有效。'}</p></div><div><button type="button" onClick={scrollToFeed}>浏览邻里信息</button><button type="button" onClick={() => openCreate('client')}><Plus size={18} />发布需求</button></div></div>
      </>}
      {showBoard && <Suspense fallback={null}><CommunityBoardSlot required={!isDiscovery} asked={communityExpanded || location.hash === '#home-feed-section'} onScrollToFeed={scrollToFeed} scrollRequest={feedScrollRequest} /></Suspense>}
      <footer className="bay-home-footer"><span>BAYLINK<span>让生活的连接，更近一点。</span></span><nav aria-label="关于与帮助"><Link to="/about">认识 BAYLINK<ChevronRight size={14} /></Link><Link to="/guides/baylink-safety-guide">社区安全指南<ChevronRight size={14} /></Link><Link to="/archive">已发布内容目录<ChevronRight size={14} /></Link></nav></footer>
    </div>
  );
}
