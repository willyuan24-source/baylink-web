// The confirm card (confirm.tsx keeps the queue and renders this). A chunk of its own, warmed once the page is idle (or
// loaded with a confirm asked before that), so the shell every page downloads does not carry the card and its classes.
import { useState, type ReactNode } from 'react';
import { ModalShell } from './Modal';
import { useClosing } from './closing';
import type { ConfirmOptions } from './confirm';

type Resolver = (value: boolean | string | null) => void;

// N10 / N11 / N24: the site's one scrim (no blur), the --r-xl card (rounded-3xl), and an exit: the answer goes back at once,
// the card fades and shrinks to 95% over --dur-2 before it unmounts (useClosing; at once under reduced motion and in 简洁显示).
/**
 * `warning` is the danger mark (confirm.tsx passes the shell's AlertTriangle, so pages that draw it get no chunk for it).
 * `afterWait`: DialogWait already painted the scrim while this chunk loaded, so it stays instead of fading in again.
 */
export const ConfirmDialog = ({ opts, warning, onResolve, onGone, afterWait = false }: { opts: ConfirmOptions; warning: ReactNode; onResolve: Resolver; onGone: () => void; afterWait?: boolean }) => {
  const [inputValue, setInputValue] = useState(opts.input?.defaultValue || '');
  const [closing, leave] = useClosing(onGone);
  const hasInput = !!opts.input;
  const answer = (value: boolean | string | null) => { if (closing) return; onResolve(value); leave(); };
  const confirm = () => answer(hasInput ? inputValue : true);
  const cancel = () => answer(hasInput ? null : false);
  const motion = closing ? 'animate-out fade-out fill-mode-forwards ease-in' : 'animate-in fade-in ease-out';
  const scrim = closing || !afterWait ? motion : '';
  return (
    <ModalShell
      onClose={cancel}
      label={opts.title || '确认操作'}
      className={`fixed inset-0 z-[130] flex items-center justify-center bg-[color:var(--scrim)] p-6 duration-150 ${scrim}`}
    >
      <div className={`w-full max-w-xs rounded-3xl border border-black/[0.04] bg-white p-5 shadow-elevated duration-150 ${motion} ${closing ? 'zoom-out-95' : 'zoom-in-95'}`}>
        <div className="flex items-start gap-3">
          {opts.danger && (
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500">
              {warning}
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
            onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && confirm()}
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
