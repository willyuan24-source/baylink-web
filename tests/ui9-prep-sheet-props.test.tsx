import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React, { createRef, type ReactNode } from 'react';

// UI9-PREP: the Sheet's optional hooks (className, backdropClassName, header + labelledBy, bodyRef, onBodyScroll,
// bodyClassName) for the lanes that move their dialogs onto it. Unset, the Sheet renders byte for byte what it rendered
// before (compared with a frozen copy of the UI9-F Sheet below).
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, MutationObserver: dom.window.MutationObserver, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
dom.window.HTMLElement.prototype.getClientRects = function () {
  return (this.isConnected && !this.hidden ? [{ width: 1, height: 1 }] : []) as unknown as DOMRectList;
};
registerHooks({ load: (url, context, nextLoad) => url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {};' } : nextLoad(url, context) });
const { render, cleanup, fireEvent, within } = await import('@testing-library/react');
const { X } = await import('lucide-react');
const { Sheet } = await import('../src/components/ui/Sheet');
const { ModalShell } = await import('../src/components/ui/Modal');
const { IconButton } = await import('../src/components/ui/Button');
const { useUiCopy } = await import('../src/components/ui/ui-copy');
const { useExit } = await import('../src/lib/reading-preferences');
const { setLocale } = await import('../src/i18n/locale');

afterEach(async () => { cleanup(); document.body.innerHTML = ''; await setLocale('zh-Hans', false); });

type BaseProps = { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; status?: string; closeOnBackdrop?: boolean };
/** The Sheet as UI9-F shipped it (b4e0ac9), frozen here as the reference for the unset case. */
function BaseSheet({ open, onClose, title, children, footer, status, closeOnBackdrop = true }: BaseProps) {
  const titleId = React.useId();
  const { t } = useUiCopy();
  const shown = useExit(open);
  if (!shown) return null;
  return <ModalShell onClose={onClose} className={open ? 'ui-sheet-backdrop' : 'ui-sheet-backdrop is-closing'} labelledBy={titleId} closeOnBackdrop={closeOnBackdrop}>
    <div className="ui-sheet">
      <div className="ui-sheet__handle" aria-hidden="true" />
      <div className="ui-sheet__header">
        <h2 id={titleId} className="ui-sheet__title">{title}</h2>
        <IconButton label={t('关闭', 'Close')} onClick={onClose}><X aria-hidden="true" strokeWidth={1.75} /></IconButton>
      </div>
      <div className="ui-sheet__body">{children}</div>
      {footer && <div className="ui-sheet__footer">{footer}</div>}
      {status !== undefined && <p className="ui-visually-hidden" role="status" aria-live="polite">{status}</p>}
    </div>
  </ModalShell>;
}

const settle = () => new Promise(resolve => setTimeout(resolve, 30));
/** The dialog's markup, with React's generated ids (and the references to them) replaced by one placeholder. */
const markup = () => {
  const html = document.body.querySelector('[role=dialog]')!.outerHTML;
  const ids = [...html.matchAll(/ id="([^"]+)"/g)].map(match => match[1]);
  return ids.reduce((text, id, index) => text.replaceAll(`"${id}"`, `"ID${index}"`), html);
};

test('unset, the Sheet renders exactly what it rendered before the hooks, in zh-Hans and en', async () => {
  // Each locale with its own words (the /en pages translate leftover Chinese text in the DOM, whenever its dictionary loads).
  const words = { 'zh-Hans': ['筛选活动', '内容', '选择地区', '旧金山', '显示 23 场', '登录', '邮箱'], en: ['Filter events', 'Contents', 'Choose an area', 'San Francisco', 'Show 23', 'Sign in', 'Email'] };
  for (const locale of ['zh-Hans', 'en'] as const) {
    await setLocale(locale, false);
    const [filter, contents, area, city, show, signIn, email] = words[locale];
    const cases: BaseProps[] = [
      { open: true, onClose: () => {}, title: filter, children: <p>{contents}</p> },
      { open: true, onClose: () => {}, title: area, children: <ul><li>{city}</li></ul>, footer: <button type="button">{show}</button>, status: show },
      { open: true, onClose: () => {}, title: signIn, children: <form><input aria-label={email} /></form>, closeOnBackdrop: false },
    ];
    for (const props of cases) {
      render(<BaseSheet {...props} />);
      await settle();
      const before = markup();
      cleanup(); document.body.innerHTML = '';
      render(<Sheet {...props} />);
      await settle();
      assert.equal(markup(), before, `${locale} ${props.title}`);
      cleanup(); document.body.innerHTML = '';
    }
  }
});

test('className, backdropClassName and bodyClassName add one class each to the panel, the backdrop and the body', () => {
  render(<Sheet open onClose={() => {}} title="BayBay" className="bb-panel" backdropClassName="bb-backdrop" bodyClassName="bb-body"><p>hi</p></Sheet>);
  const dialog = document.body.querySelector('[role=dialog]')!;
  assert.equal(dialog.className, 'ui-sheet-backdrop bb-backdrop');
  assert.equal(dialog.querySelector('.ui-sheet')!.className, 'ui-sheet bb-panel');
  assert.equal(dialog.querySelector('.ui-sheet__body')!.className, 'ui-sheet__body bb-body');
  assert.ok(dialog.querySelector('.ui-sheet__header'), 'the default header stays without `header`');
});

test('a custom header replaces the default one and names the dialog through labelledBy; without it, title names it', () => {
  let closed = 0;
  const header = <div className="bb-head"><h2 id="bb-title">问 BayBay</h2><button type="button" aria-label="关闭" onClick={() => { closed++; }}>×</button></div>;
  const view = render(<Sheet open onClose={() => {}} title="BayBay" header={header} labelledBy="bb-title"><p>hi</p></Sheet>);
  const dialog = view.getByRole('dialog', { name: '问 BayBay' });
  assert.equal(dialog.getAttribute('aria-labelledby'), 'bb-title');
  assert.equal(dialog.getAttribute('aria-label'), null);
  assert.equal(dialog.querySelector('.ui-sheet__header'), null, 'no second header');
  assert.equal(within(dialog).getAllByRole('button', { name: '关闭' }).length, 1, 'one close button: the header\'s own');
  fireEvent.click(within(dialog).getByRole('button', { name: '关闭' }));
  assert.equal(closed, 1);
  cleanup(); document.body.innerHTML = '';
  const unnamed = render(<Sheet open onClose={() => {}} title="BayBay 对话" header={<div>BayBay</div>}><p>hi</p></Sheet>);
  const named = unnamed.getByRole('dialog', { name: 'BayBay 对话' });
  assert.equal(named.getAttribute('aria-labelledby'), null);
});

test('bodyRef reaches the scrolling body and onBodyScroll hears it scroll', () => {
  const bodyRef = createRef<HTMLDivElement>();
  let scrolls = 0;
  render(<Sheet open onClose={() => {}} title="BayBay" bodyRef={bodyRef} onBodyScroll={() => { scrolls++; }}><p>hi</p></Sheet>);
  assert.ok(bodyRef.current?.classList.contains('ui-sheet__body'));
  fireEvent.scroll(bodyRef.current!);
  assert.equal(scrolls, 1);
});
