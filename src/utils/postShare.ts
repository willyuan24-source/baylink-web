export type ShareablePost = {
  id: string;
  title: string;
  city?: string;
  category?: string;
  budget?: string;
  timeInfo?: string;
};

const RENT_CATEGORIES = new Set(['租屋', '租房']);
const USED_CATEGORIES = new Set(['闲置', '二手']);
const SERVICE_CATEGORIES = new Set(['搬家', '清洁', '维修', '接送', '翻译', '兼职', '其他']);

const line = (label: string, value?: string) => (value?.trim() ? `${label}：${value.trim()}` : '');

export const buildPostShareUrl = (post: Pick<ShareablePost, 'id'>): string => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/posts/${post.id}`;
  }
  return `/posts/${post.id}`;
};

export const buildPostShareText = (post: ShareablePost): string => {
  const url = buildPostShareUrl(post);
  const area = post.city?.trim() || '湾区';
  const title = post.title?.trim() || '本地信息';
  const category = post.category?.trim() || '';
  const budget = post.budget?.trim();
  const timeInfo = post.timeInfo?.trim();

  if (RENT_CATEGORIES.has(category)) {
    return [
      '我在 BAYLINK 看到一个湾区租房信息：',
      '',
      `【${title}】`,
      ...[line('地区', area), line('预算/价格', budget), line('时间', timeInfo)].filter(Boolean),
      '',
      '详情：',
      url,
      '',
      'BAYLINK｜湾区生活信息站',
    ].join('\n');
  }

  if (USED_CATEGORIES.has(category)) {
    return [
      '我在 BAYLINK 看到一个湾区二手信息：',
      '',
      `【${title}】`,
      ...[line('地区', area), line('价格', budget)].filter(Boolean),
      '',
      '详情：',
      url,
      '',
      'BAYLINK｜湾区生活信息站',
    ].join('\n');
  }

  if (SERVICE_CATEGORIES.has(category)) {
    return [
      '我在 BAYLINK 看到一个湾区本地服务信息：',
      '',
      `【${title}】`,
      ...[line('地区', area), line('预算/价格', budget)].filter(Boolean),
      '',
      '详情：',
      url,
      '',
      'BAYLINK｜湾区生活信息站',
    ].join('\n');
  }

  return [
    '我在 BAYLINK 看到一条湾区本地信息：',
    '',
    `【${title}】`,
    ...[line('地区', area), line('分类', category)].filter(Boolean),
    '',
    '详情：',
    url,
    '',
    'BAYLINK｜湾区生活信息站',
  ].join('\n');
};

export const canUseNativeShare = () =>
  typeof navigator !== 'undefined' && typeof navigator.share === 'function';

const copyText = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
};

export const copyPostShareText = (post: ShareablePost) => copyText(buildPostShareText(post));
export const copyPostShareUrl = (post: ShareablePost) => copyText(buildPostShareUrl(post));

export async function sharePost(
  post: ShareablePost,
): Promise<{ method: 'native' | 'clipboard' | 'failed' | 'cancelled' }> {
  const text = buildPostShareText(post);
  const url = buildPostShareUrl(post);
  const title = post.title?.trim() || 'BAYLINK 帖子';

  if (canUseNativeShare()) {
    try {
      await navigator.share({ title, text, url });
      return { method: 'native' };
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') {
        return { method: 'cancelled' };
      }
    }
  }

  const copied = await copyText(text);
  return copied ? { method: 'clipboard' } : { method: 'failed' };
};
