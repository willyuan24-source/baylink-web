import type { PostData } from './types';

type PostsPage = { posts: PostData[]; hasMore: boolean } | PostData[];

/** Scan bounded public-feed batches; an empty author match is not the end of pagination. */
export async function readOwnPostsBatch({ userId, startPage, fetchPage, maxPages = 4, targetCount = 10 }: {
  userId: string;
  startPage: number;
  fetchPage: (page: number) => Promise<PostsPage>;
  maxPages?: number;
  targetCount?: number;
}) {
  const matched = new Map<string, PostData>();
  let nextPage = startPage;
  let hasMore = true;
  for (let count = 0; count < maxPages && hasMore; count += 1) {
    const result = await fetchPage(nextPage);
    const posts = Array.isArray(result) ? result : result.posts;
    if (!Array.isArray(posts)) throw new Error('帖子列表响应异常');
    for (const post of posts) {
      if (post.authorId === userId && post.id) matched.set(post.id, post);
    }
    hasMore = !Array.isArray(result) && result.hasMore === true;
    nextPage += 1;
    if (matched.size >= targetCount) break;
  }
  return { posts: [...matched.values()], nextPage, hasMore };
}
