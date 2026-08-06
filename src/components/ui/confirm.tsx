// 品牌化确认框，替代原生 confirm()/prompt()。
// 任意位置 `await confirmDialog({...})`；<ConfirmHost/> 在 AppLayout 挂载一次负责渲染。
import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { ModalShell } from './Modal';

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
type PendingConfirm = { opts: ConfirmOptions; resolve: Resolver };

let pushRequest: ((req: PendingConfirm) => void) | null = null;

/** 确认框。resolve true=确认 / false=取消。Host 未挂载时退回原生 confirm。 */
export const confirmDialog = (opts: ConfirmOptions | string): Promise<boolean> =>
  new Promise((resolve) => {
    const options: ConfirmOptions = typeof opts === 'string' ? { message: opts } : opts;
    if (!pushRequest) { resolve(window.confirm(options.message)); return; }
    pushRequest({ opts: options, resolve: (v) => resolve(v === true) });
  });

/** 带输入框的确认（替代 prompt）。resolve 输入内容 / null=取消。 */
export const promptDialog = (opts: ConfirmOptions): Promise<string | null> =>
  new Promise((resolve) => {
    if (!pushRequest) { resolve(window.prompt(opts.message, opts.input?.defaultValue || '')); return; }
    pushRequest({
      opts: { ...opts, input: opts.input || {} },
      resolve: (v) => resolve(typeof v === 'string' ? v : null),
    });
  });

const ConfirmDialog = ({ opts, onResolve }: { opts: ConfirmOptions; onResolve: Resolver }) => {
  const [inputValue, setInputValue] = useState(opts.input?.defaultValue || '');
  const hasInput = !!opts.input;
  const confirm = () => onResolve(hasInput ? inputValue : true);
  const cancel = () => onResolve(hasInput ? null : false);
  return (
    <ModalShell
      onClose={cancel}
      label={opts.title || '确认操作'}
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/45 p-6 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="w-full max-w-xs rounded-[24px] border border-black/[0.04] bg-white p-5 shadow-elevated animate-in zoom-in-95 fade-in duration-150">
        <div className="flex items-start gap-3">
          {opts.danger && (
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500">
              <AlertTriangle size={18} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            {opts.title && <h3 className="text-base font-bold text-baylink-text">{opts.title}</h3>}
            <p className={`whitespace-pre-line text-sm leading-relaxed text-baylink-text-secondary ${opts.title ? 'mt-1.5' : ''}`}>
              {opts.message}
            </p>
          </div>
        </div>
        {hasInput && (
          <input
            autoFocus
            className="mt-3 w-full rounded-xl border border-baylink-border/60 bg-white p-3 text-sm outline-none placeholder:text-baylink-muted focus:border-baylink-green/40 focus:ring-2 focus:ring-baylink-green/15"
            placeholder={opts.input?.placeholder}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && confirm()}
          />
        )}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={cancel}
            className="flex-1 rounded-xl border border-baylink-border/60 bg-white py-2.5 text-sm font-semibold text-baylink-text-secondary transition hover:bg-baylink-section/50 active:scale-[0.98]"
          >
            {opts.cancelText || '取消'}
          </button>
          <button
            type="button"
            onClick={confirm}
            className={`flex-1 rounded-xl py-2.5 text-sm font-bold text-white shadow-rest transition active:scale-[0.98] ${
              opts.danger ? 'bg-red-500 hover:bg-red-600' : 'bg-baylink-green hover:bg-baylink-green-hover'
            }`}
          >
            {opts.confirmText || '确认'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
};

export const ConfirmHost = () => {
  const [queue, setQueue] = useState<PendingConfirm[]>([]);

  useEffect(() => {
    pushRequest = (req) => setQueue((q) => [...q, req]);
    return () => { pushRequest = null; };
  }, []);

  const current = queue[0];
  if (!current) return null;

  const resolveAndNext: Resolver = (v) => {
    current.resolve(v);
    setQueue((q) => q.slice(1));
  };

  return <ConfirmDialog key={queue.length} opts={current.opts} onResolve={resolveAndNext} />;
};
