import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useLocale } from '../../i18n/locale';
import type { PostData } from '../../lib/types';
import {
  postTranslationKey, postTranslationSession, postTranslationText, requestPostTranslation,
  type PostTranslationResult, type PostTranslationText,
} from './postTranslationStore';

const subscribeSession = (notify: () => void) => {
  window.addEventListener('storage', notify);
  window.addEventListener('session-expired', notify);
  return () => {
    window.removeEventListener('storage', notify);
    window.removeEventListener('session-expired', notify);
  };
};
const guestSession = () => '["",""]';

export type PostTranslationState = {
  display: PostTranslationText;
  translated: boolean;
  status: 'original' | 'loading' | 'translated' | 'unavailable';
  showOriginal: boolean;
  toggleOriginal: () => void;
  retry: () => void;
};

export function usePostTranslation(post: PostData, enabled = true): PostTranslationState {
  const locale = useLocale();
  const session = useSyncExternalStore(subscribeSession, postTranslationSession, guestSession);
  const { title, description, budget, timeInfo } = post;
  const source = useMemo(() => postTranslationText({ title, description, budget, timeInfo }), [title, description, budget, timeInfo]);
  const key = postTranslationKey(post.id, source, session);
  const eligible = enabled && locale === 'en' && /\p{Script=Han}/u.test(title + description + budget + timeInfo);
  const [resolved, setResolved] = useState<{ key: string; result: PostTranslationResult } | null>(null);
  const [originalKey, setOriginalKey] = useState<string | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);
  const consumedRetry = useRef(0);

  useEffect(() => {
    if (!eligible) return;
    let subscribed = true;
    const manualRetry = consumedRetry.current !== retryVersion;
    consumedRetry.current = retryVersion;
    setResolved(null);
    void requestPostTranslation(post.id, source, session, manualRetry).then(result => {
      if (subscribed) setResolved({ key, result });
    });
    return () => { subscribed = false; };
  }, [eligible, post.id, source, session, key, retryVersion]);

  const current = eligible && resolved?.key === key ? resolved.result : null;
  const showOriginal = eligible && originalKey === key;
  const translated = current?.status === 'translated' && !showOriginal;
  const toggleOriginal = useCallback(() => { setOriginalKey(previous => previous === key ? null : key); }, [key]);
  // Explicit retries bypass the failure cache, while simultaneous callers still
  // share one request. The server independently rate-limits provider retries.
  const retry = useCallback(() => { setRetryVersion(previous => previous + 1); }, []);

  return {
    display: translated ? current.text : source,
    translated,
    status: !eligible ? 'original' : current?.status || 'loading',
    showOriginal,
    toggleOriginal,
    retry,
  };
}
