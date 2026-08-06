// 首页 feed 的 sessionStorage 缓存：回访/刷新时先渲染上次内容，再后台刷新
// 只缓存默认视图（无关键词、无筛选）的第一批结果；帖子图片是 base64 时可能超配额，写入失败静默忽略
import type { PostData, PostType } from './types';

const FEED_CACHE_PREFIX = 'baylink:feed:';
const FEED_CACHE_TTL = 30 * 60_000;
const FEED_CACHE_MAX_POSTS = 10;

export const readFeedCache = (type: PostType): PostData[] => {
  try {
    const raw = sessionStorage.getItem(FEED_CACHE_PREFIX + type);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.posts)) return [];
    if (typeof parsed.ts !== 'number' || Date.now() - parsed.ts > FEED_CACHE_TTL) return [];
    return parsed.posts;
  } catch {
    return [];
  }
};

export const writeFeedCache = (type: PostType, posts: PostData[]) => {
  try {
    sessionStorage.setItem(
      FEED_CACHE_PREFIX + type,
      JSON.stringify({ ts: Date.now(), posts: posts.slice(0, FEED_CACHE_MAX_POSTS) }),
    );
  } catch {
    // 配额不足（base64 图片较大时）或隐私模式：跳过缓存即可
  }
};
