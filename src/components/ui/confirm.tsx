// 品牌化确认框，替代原生 confirm()/prompt()。
// 任意位置 `await confirmDialog({...})`；<ConfirmHost/> 在 AppLayout 挂载一次负责渲染。
import { Suspense, useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { ChunkBoundary } from '../ChunkBoundary';
import { DialogWait } from './DialogWait';
import { lazyDialog } from './lazy-dialog';

/** How the card's chunk is fetched (a test makes it fail). */
export const confirmChunk = { load: () => import('./ConfirmDialog') };
// The card is a chunk of its own (ConfirmDialog.tsx); the shell keeps only the queue. ConfirmHost warms it once the page is
// idle, so the first confirm (删除计划, 取消收藏) opens at once; one asked before that shows DialogWait until it arrives.
const confirmCard = lazyDialog(() => confirmChunk.load(), m => m.ConfirmDialog);

export type ConfirmOptions = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  /** 危险操作（删除/屏蔽）：确认按钮红色 */
  danger?: boolean;
  /** 带输入框（替代 prompt） */
  input?: { placeholder?: string; defaultValue?: string };
};

type Resolver = (value: boolean | string | null) => void;
type PendingConfirm = { id: number; opts: ConfirmOptions; resolve: Resolver };

let pushRequest: ((req: PendingConfirm) => void) | null = null;
let nextId = 0;

/** 确认框。resolve true=确认 / false=取消。Host 未挂载时退回原生 confirm。 */
export const confirmDialog = (opts: ConfirmOptions | string): Promise<boolean> =>
  new Promise((resolve) => {
    const options: ConfirmOptions = typeof opts === 'string' ? { message: opts } : opts;
    if (!pushRequest) { resolve(window.confirm(options.message)); return; }
    pushRequest({ id: ++nextId, opts: options, resolve: (v) => resolve(v === true) });
  });

/** 带输入框的确认（替代 prompt）。resolve 输入内容 / null=取消。 */
export const promptDialog = (opts: ConfirmOptions): Promise<string | null> =>
  new Promise((resolve) => {
    if (!pushRequest) { resolve(window.prompt(opts.message, opts.input?.defaultValue || '')); return; }
    pushRequest({
      id: ++nextId,
      opts: { ...opts, input: opts.input || {} },
      resolve: (v) => resolve(typeof v === 'string' ? v : null),
    });
  });

export const ConfirmHost = ({ locationKey }: { locationKey?: string }) => {
  const [queue, setQueue] = useState<PendingConfirm[]>([]);
  const firstKeyRef = useRef(true);

  useEffect(() => {
    pushRequest = (req) => setQueue((q) => [...q, req]);
    confirmCard.warm();
    return () => { pushRequest = null; };
  }, []);

  // 还原原生 confirm 的语义：页面导航（浏览器前进/后退）时挂起的确认框视为取消，
  // 避免开启方组件已卸载后仍以过期闭包执行确认动作
  useEffect(() => {
    if (firstKeyRef.current) { firstKeyRef.current = false; return; }
    setQueue((q) => {
      q.forEach((p) => p.resolve(null));
      return [];
    });
  }, [locationKey]);

  const current = queue[0];
  if (!current) return null;

  // The answer resolves at once; the dialog leaves the queue when its exit has played, and the next one opens after it.
  return <ConfirmSlot key={current.id} request={current} onGone={() => setQueue((q) => q.filter((p) => p !== current))} />;
};

/** One confirm: the card (loaded, or loading behind DialogWait); if it cannot load (offline, a stale deploy), the browser's own confirm / prompt answers instead. */
const ConfirmSlot = ({ request, onGone }: { request: PendingConfirm; onGone: () => void }) => {
  const [{ Dialog: Card, waits }] = useState(confirmCard.current);
  return <ChunkBoundary onFail={() => {
    const { message, input } = request.opts;
    request.resolve(input ? window.prompt(message, input.defaultValue || '') : window.confirm(message));
    onGone();
  }}><Suspense fallback={<DialogWait />}><Card opts={request.opts} warning={<AlertTriangle size={18} />} onResolve={request.resolve} onGone={onGone} afterWait={waits} /></Suspense></ChunkBoundary>;
};
