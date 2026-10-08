import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React, { useState } from 'react';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, MutationObserver: dom.window.MutationObserver, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
// jsdom has no layout. Expose connected, visible controls to the modal focus trap.
dom.window.HTMLElement.prototype.getClientRects = function () {
  return (this.isConnected && !this.hidden ? [{ width: 1, height: 1 }] : []) as unknown as DOMRectList;
};
const cssHook = registerHooks({ load(url, context, nextLoad) {
  if (url.endsWith('/components/ui/ui.css')) return { format: 'module', shortCircuit: true, source: 'export {};' };
  return nextLoad(url, context);
} });
const { render, cleanup, fireEvent, act, within } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const ui = await import('../src/components/ui');
cssHook.deregister();
const { setLocale } = await import('../src/i18n/locale');

afterEach(async () => { cleanup(); localStorage.clear(); document.body.innerHTML = ''; await setLocale('zh-Hans', false); });
const wrap = (node: React.ReactNode) => render(<MemoryRouter>{node}</MemoryRouter>);

test('buttons: one element per variant, router links for `to`, and icon buttons always have a name', () => {
  const view = wrap(<>
    <ui.Button variant="primary" onClick={() => {}}>显示 23 场</ui.Button>
    <ui.Button variant="text" to="/events">看全部</ui.Button>
    <ui.Button href="https://example.org/official">官方页</ui.Button>
    <ui.IconButton label="搜索"><svg /></ui.IconButton>
  </>);
  const primary = view.getByRole('button', { name: '显示 23 场' });
  assert.equal(primary.getAttribute('type'), 'button');
  assert.equal(primary.getAttribute('data-variant'), 'primary');
  assert.equal(view.getByRole('link', { name: '看全部' }).getAttribute('href'), '/events');
  assert.equal(view.getByRole('link', { name: '官方页' }).getAttribute('href'), 'https://example.org/official');
  assert.ok(view.getByRole('button', { name: '搜索' }).classList.contains('ui-icon-button'));
});

test('filter chips toggle with aria-pressed and show a count; status chips are not controls', () => {
  function Chips() {
    const [free, setFree] = useState(false);
    return <ui.ChipRow label="筛选"><ui.FilterChip selected={free} count={26} onClick={() => setFree(value => !value)}>免费</ui.FilterChip><ui.StatusChip tone="success">即将开始</ui.StatusChip></ui.ChipRow>;
  }
  const view = wrap(<Chips />);
  const chip = view.getByRole('button', { name: '免费 26' });
  assert.equal(chip.getAttribute('aria-pressed'), 'false');
  fireEvent.click(chip);
  assert.equal(chip.getAttribute('aria-pressed'), 'true');
  assert.equal(view.getByRole('group', { name: '筛选' }).querySelectorAll('button').length, 1, 'the status chip is a span');
});

test('a feed card is one link; ♡ is a separate pressed-state button, never nested in the link', () => {
  function Card() {
    const [saved, setSaved] = useState(false);
    return <ui.FeedCard title="Fleet Week 蓝天使航展" to="/events/fleet-week" cover={<div data-cover="type" />} meta={<>San Francisco · <strong>免费</strong></>} trust="官网核对 10/7"
      save={<ui.SaveButton saved={saved} title="Fleet Week 蓝天使航展" onToggle={() => setSaved(value => !value)} />} />;
  }
  const view = wrap(<Card />);
  const article = view.container.querySelector('article')!;
  const links = within(article).getAllByRole('link');
  assert.equal(links.length, 1);
  assert.equal(links[0].getAttribute('href'), '/events/fleet-week');
  assert.equal(view.getByRole('heading', { level: 3 }).textContent, 'Fleet Week 蓝天使航展');
  const save = view.getByRole('button', { name: '收藏：Fleet Week 蓝天使航展' });
  assert.equal(links[0].contains(save), false);
  fireEvent.click(save);
  assert.equal(view.getByRole('button', { name: '取消收藏：Fleet Week 蓝天使航展' }).getAttribute('aria-pressed'), 'true');
  const external = wrap(<ui.RowCard title="官方活动" href="https://example.org/e" thumb={<span />} date="周六 10/10" meta="Berkeley" />);
  const row = external.getByRole('link', { name: '官方活动' });
  assert.equal(row.getAttribute('target'), '_blank');
  assert.equal(row.getAttribute('rel'), 'noopener noreferrer');
});

test('the sheet is a labelled modal dialog: focus moves in, Esc and the close button close it', async () => {
  function Host() {
    const [open, setOpen] = useState(false);
    return <><button onClick={() => setOpen(true)}>筛选</button>
      <ui.Sheet open={open} onClose={() => setOpen(false)} title="筛选活动" status="显示 23 场" footer={<ui.Button variant="primary" onClick={() => setOpen(false)}>显示 23 场</ui.Button>}>
        <ui.FilterChip selected={false}>亲子</ui.FilterChip>
      </ui.Sheet></>;
  }
  document.body.innerHTML = '<div id="root"></div>';
  const view = render(<MemoryRouter><Host /></MemoryRouter>, { container: document.getElementById('root')! });
  const opener = view.getByRole('button', { name: '筛选' });
  opener.focus();
  fireEvent.click(opener);
  const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
  assert.ok(dialog);
  assert.equal(dialog.getAttribute('aria-modal'), 'true');
  assert.equal(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent, '筛选活动');
  assert.ok(dialog.contains(document.activeElement), 'focus moves into the sheet');
  assert.equal(within(dialog).getByRole('status').textContent, '显示 23 场');
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
  assert.equal(document.querySelector('[role="dialog"]'), null);
  assert.equal(document.activeElement, opener, 'focus returns to the opener');
  fireEvent.click(opener);
  fireEvent.click(within(document.querySelector('[role="dialog"]') as HTMLElement).getByRole('button', { name: '关闭' }));
  assert.equal(document.querySelector('[role="dialog"]'), null);
});

test('segmented tabs: route links carry aria-current; in-page tabs and the day toggle follow arrow keys', () => {
  const items = [{ id: 'weekend', label: '本周末', to: '/events' }, { id: 'calendar', label: '日历·地图', to: '/calendar' }];
  const routes = wrap(<ui.SegmentedTabs label="活动栏目" items={items} value="weekend" />);
  assert.equal(routes.getByRole('link', { name: '本周末' }).getAttribute('aria-current'), 'page');
  assert.equal(routes.getByRole('link', { name: '日历·地图' }).hasAttribute('aria-current'), false);
  cleanup();
  function Tabs() {
    const [value, setValue] = useState('sat');
    return <><ui.SegmentedTabs label="视图" items={[{ id: 'list', label: '列表' }, { id: 'map', label: '地图' }]} value={value === 'map' ? 'map' : 'list'} onChange={id => setValue(id === 'map' ? 'map' : 'sat')} panelId="panel" />
      <ui.SegmentedControl label="哪一天" items={[{ id: 'sat', label: '周六 10/10' }, { id: 'sun', label: '周日 10/11' }, { id: 'all', label: '整个周末' }]} value={value} onChange={setValue} /></>;
  }
  const view = wrap(<Tabs />);
  const list = view.getByRole('tab', { name: '列表' });
  assert.equal(list.getAttribute('aria-selected'), 'true');
  assert.equal(list.getAttribute('aria-controls'), 'panel');
  assert.equal(view.getByRole('tab', { name: '地图' }).getAttribute('tabindex'), '-1');
  list.focus();
  fireEvent.keyDown(list, { key: 'ArrowRight' });
  assert.equal(view.getByRole('tab', { name: '地图' }).getAttribute('aria-selected'), 'true');
  assert.equal(document.activeElement, view.getByRole('tab', { name: '地图' }));
  const sat = view.getByRole('radio', { name: '周六 10/10' });
  fireEvent.keyDown(sat, { key: 'ArrowLeft' });
  assert.equal(view.getByRole('radio', { name: '整个周末' }).getAttribute('aria-checked'), 'true', 'arrows wrap around');
  assert.equal(view.getByRole('radiogroup', { name: '哪一天' }).querySelectorAll('[tabindex="0"]').length, 1, 'one tab stop');
});

test('feed grid: a labelled list in DOM order; the layout choice is remembered and survives broken storage', async () => {
  function Feed() {
    const { layout, effective, setLayout } = ui.useFeedLayout();
    return <><ui.FeedLayoutToggle effective={effective} onChange={setLayout} />
      <ui.FeedGrid label="本周末活动" layout={layout}><ui.FeedItem>a</ui.FeedItem><ui.FeedItem wide>b</ui.FeedItem></ui.FeedGrid></>;
  }
  const view = wrap(<Feed />);
  const list = view.getByRole('list', { name: '本周末活动' });
  assert.equal(list.getAttribute('data-layout'), 'auto');
  assert.ok(list.querySelector('li.ui-feed-grid__wide'));
  assert.equal(view.getByRole('button', { name: '两列' }).getAttribute('aria-pressed'), 'true');
  await act(async () => { document.documentElement.dataset.reading = 'extra-large'; await Promise.resolve(); });
  assert.equal(view.getByRole('button', { name: '单列' }).getAttribute('aria-pressed'), 'true', 'auto follows 特大 text on a phone');
  fireEvent.click(view.getByRole('button', { name: '两列' }));
  assert.equal(list.getAttribute('data-layout'), 'grid');
  assert.equal(localStorage.getItem(ui.FEED_LAYOUT_KEY), 'grid');
  delete document.documentElement.dataset.reading;
  const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } };
  assert.equal(ui.readFeedLayout(broken), 'auto');
  assert.doesNotThrow(() => ui.writeFeedLayout('list', broken));
  assert.equal(ui.readFeedLayout({ getItem: () => 'masonry' }), 'auto');
  assert.equal(ui.automaticLayout('large', true), 'list');
  assert.equal(ui.automaticLayout('large', false), 'grid');
});

test('loading, empty and error states: fixed skeletons, one next step, retry', () => {
  const loading = wrap(<ui.SkeletonFeed count={4} />);
  const busy = loading.container.querySelector('[aria-busy="true"]')!;
  assert.equal(busy.querySelectorAll('.ui-skeleton-card').length, 4);
  assert.equal(within(busy as HTMLElement).getByRole('status').textContent, '正在加载');
  cleanup();
  const empty = wrap(<ui.EmptyState title="还没有新帖" body="邻里信息（测试中）" actions={<ui.Button variant="primary" to="/guides/rental-scam">看租房防骗指南</ui.Button>} />);
  assert.equal(empty.getByRole('heading', { level: 2 }).textContent, '还没有新帖');
  assert.equal(empty.getAllByRole('link').length, 1);
  cleanup();
  let retried = 0;
  const error = wrap(<ui.ErrorState onRetry={() => { retried += 1; }} />);
  assert.ok(error.getByRole('alert'));
  fireEvent.click(error.getByRole('button', { name: '重试' }));
  assert.equal(retried, 1);
  assert.equal(error.getByRole('link', { name: '回到首页' }).getAttribute('href'), '/');
});

test('cover image: srcset and sizes, lazy by default, eager + high priority for the LCP cover, posters letterboxed', () => {
  const image = { src: '/a.webp', srcSet: '/a-small.webp 480w, /a.webp 1200w', alt: '蓝天使飞越金门大桥', width: 1200, height: 800, lqip: 'rgb(200 210 220)' };
  const lazy = wrap(<ui.CoverImage image={image} label="资料图 · 2024" />);
  const img = lazy.getByRole('img', { name: '蓝天使飞越金门大桥' });
  assert.equal(img.getAttribute('loading'), 'lazy');
  assert.equal(img.hasAttribute('fetchpriority'), false);
  assert.ok(img.getAttribute('sizes')?.includes('286px'));
  assert.equal(lazy.container.querySelector('[data-provenance]')?.textContent, '资料图 · 2024');
  assert.match(img.getAttribute('style') || '', /object-position: 50% 40%/);
  cleanup();
  const poster = wrap(<ui.CoverImage image={image} fit="contain" priority decorative />);
  const imgs = poster.container.querySelectorAll('img');
  assert.equal(imgs.length, 2);
  assert.equal(imgs[0].getAttribute('aria-hidden'), 'true', 'the blurred backdrop is decorative');
  assert.equal(imgs[1].getAttribute('alt'), '');
  assert.equal(imgs[1].getAttribute('fetchpriority'), 'high');
  assert.equal(poster.container.querySelector('.ui-cover')?.getAttribute('data-fit'), 'contain');
});

test('English pages get English control names without a dictionary entry', async () => {
  await act(async () => { await setLocale('en', false); });
  const view = wrap(<><ui.SaveButton saved={false} title="Fleet Week" onToggle={() => {}} /><ui.ErrorState onRetry={() => {}} /><ui.FeedLayoutToggle effective="grid" onChange={() => {}} /></>);
  assert.ok(view.getByRole('button', { name: 'Save: Fleet Week' }));
  assert.ok(view.getByRole('button', { name: 'Try again' }));
  assert.ok(view.getByRole('link', { name: 'Back to home' }));
  assert.ok(view.getByRole('button', { name: 'Two columns' }));
  assert.doesNotMatch(view.container.textContent || '', /[㐀-鿿]/);
});

test('carousel: labelled slides, a polite counter, arrow keys and edge-aware previous/next; no autoplay', () => {
  const calls: number[] = [];
  const original = dom.window.HTMLElement.prototype.scrollTo;
  dom.window.HTMLElement.prototype.scrollTo = function (options?: ScrollToOptions | number) { calls.push(typeof options === 'object' ? options.left ?? -1 : -1); } as typeof original;
  try {
    const view = wrap(<ui.Carousel label="长者服务图解"><div>一</div><div>二</div><div>三</div></ui.Carousel>);
    const region = view.getByRole('region', { name: '长者服务图解' });
    assert.equal(region.getAttribute('aria-roledescription'), '轮播');
    const slides = view.getAllByRole('group');
    assert.deepEqual(slides.map(slide => slide.getAttribute('aria-label')), ['1 / 3', '2 / 3', '3 / 3']);
    assert.equal(slides[0].getAttribute('aria-roledescription'), '幻灯片');
    const counter = region.querySelector('[aria-live="polite"]')!;
    assert.equal(counter.textContent, '1/3');
    assert.equal(view.getByRole('button', { name: '上一张' }).hasAttribute('disabled'), true);
    const track = region.querySelector('.ui-carousel__track')!;
    fireEvent.keyDown(track, { key: 'ArrowRight' });
    assert.equal(counter.textContent, '2/3');
    fireEvent.click(view.getByRole('button', { name: '下一张' }));
    assert.equal(counter.textContent, '3/3');
    assert.equal(view.getByRole('button', { name: '下一张' }).hasAttribute('disabled'), true);
    fireEvent.keyDown(track, { key: 'ArrowRight' });
    assert.equal(counter.textContent, '3/3', 'stops at the last slide');
    assert.equal(calls.length, 2, 'each real move scrolls the track; a move past the end does nothing');
  } finally {
    dom.window.HTMLElement.prototype.scrollTo = original;
  }
});

test('hero card and page header: one link, one H1, facts only on a photo', () => {
  const photo = wrap(<ui.HeroCard title="Fleet Week 蓝天使航展" to="/events/fleet" overlay cover={<div data-cover="image" />} kicker="San Francisco · 旧金山"
    facts={['10/9–11', '免费观看', '码头人多', '第四条不显示']} reason={{ label: '编辑推荐', text: '一年一次的航展' }} trust="官网核对 10/7" save={<ui.SaveButton saved={false} title="Fleet Week" onToggle={() => {}} />} />);
  const article = photo.container.querySelector('article')!;
  assert.equal(within(article).getAllByRole('link').length, 1);
  assert.equal(photo.getByRole('heading', { level: 2 }).textContent, 'Fleet Week 蓝天使航展');
  assert.deepEqual([...article.querySelectorAll('.ui-hero-card__facts li')].map(item => item.textContent), ['10/9–11', '免费观看', '码头人多']);
  assert.ok(article.querySelector('.ui-hero-card__scrim'));
  cleanup();
  const typed = wrap(<ui.HeroCard title="长者太极" to="/events/taichi" overlay={false} cover={<div data-cover="type" />} kicker="Cupertino" facts={['10/10']} />);
  assert.equal(typed.container.querySelector('.ui-hero-card__scrim'), null, 'a TypeCover already shows its facts');
  assert.equal(typed.container.querySelector('.ui-hero-card__facts'), null);
  cleanup();
  const header = wrap(<ui.PageContainer size="content"><ui.PageHeader title="活动" size="display" lede="63 场 · 26 场免费" actions={<ui.Button variant="primary">问 BayBay</ui.Button>} /></ui.PageContainer>);
  assert.equal(header.getAllByRole('heading', { level: 1 }).length, 1);
  assert.equal(header.container.querySelector('.ui-container')?.getAttribute('data-size'), 'content');
  assert.equal(header.container.querySelector('.ui-page-header')?.getAttribute('data-size'), 'display');
});
