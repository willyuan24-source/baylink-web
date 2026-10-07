import { Languages, Loader2 } from 'lucide-react';
import type { usePostTranslation } from './usePostTranslation';

export function PostTranslationNotice({ reading }: { reading: ReturnType<typeof usePostTranslation> }) {
  if (reading.status === 'original') return null;
  if (reading.status === 'converted') return <div className="post-translation" translate="no" lang="zh-Hant">
    <span><Languages size={13} aria-hidden="true" />{reading.showOriginal ? '作者原文' : '已轉為繁體顯示'}</span>
    <button type="button" onClick={event => { event.stopPropagation(); reading.toggleOriginal(); }}>{reading.showOriginal ? '顯示繁體' : '查看原文'}</button>
  </div>;
  return <div className="post-translation" translate="no" lang="en">
    {reading.status === 'loading' ? <span role="status"><Loader2 size={13} className="animate-spin" aria-hidden="true" />Translating…</span>
      : reading.status === 'unavailable' ? <><span>Translation unavailable · Showing original</span><button type="button" onClick={event => { event.stopPropagation(); reading.retry(); }}>Retry translation</button></>
        : <><span><Languages size={13} aria-hidden="true" />{reading.showOriginal ? 'Original text' : 'Automatically translated'}</span><button type="button" onClick={event => { event.stopPropagation(); reading.toggleOriginal(); }}>{reading.showOriginal ? 'Show translation' : 'Show original'}</button></>}
  </div>;
}
