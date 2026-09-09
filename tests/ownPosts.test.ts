import assert from 'node:assert/strict';
import test from 'node:test';
import { readOwnPostsBatch } from '../src/lib/ownPosts';
import type { PostData } from '../src/lib/types';

const post = (id: string, authorId = 'someone-else') => ({ id, authorId } as PostData);

test('empty author matches retain continuation and find older posts in the next batch', async () => {
  const pagesRead: number[] = [];
  const fetchPage = async (page: number) => {
    pagesRead.push(page);
    return { posts: [post(String(page), page === 5 ? 'me' : 'someone-else')], hasMore: page < 5 };
  };
  const first = await readOwnPostsBatch({ userId: 'me', startPage: 1, fetchPage });
  assert.deepEqual(first, { posts: [], nextPage: 5, hasMore: true });
  const second = await readOwnPostsBatch({ userId: 'me', startPage: first.nextPage, fetchPage });
  assert.deepEqual(second.posts.map((item) => item.id), ['5']);
  assert.equal(second.hasMore, false);
  assert.deepEqual(pagesRead, [1, 2, 3, 4, 5]);
});

test('overlapping feed pages do not duplicate owned posts or include other authors', async () => {
  const result = await readOwnPostsBatch({ userId: 'me', startPage: 1, fetchPage: async (page) => ({
    posts: page === 1 ? [post('mine', 'me'), post('other')] : [post('mine', 'me'), post('older', 'me')],
    hasMore: page === 1,
  }) });
  assert.deepEqual(result.posts.map((item) => item.id), ['mine', 'older']);
  assert.equal(result.nextPage, 3);
  assert.equal(result.hasMore, false);
});

test('failure partway through a batch rejects so the caller can retry without advancing its cursor', async () => {
  await assert.rejects(readOwnPostsBatch({ userId: 'me', startPage: 7, fetchPage: async (page) => {
    if (page === 8) throw new Error('network unavailable');
    return { posts: [post('a', 'me')], hasMore: true };
  } }), /network unavailable/);
});

test('legacy non-paginated arrays are still filtered and finish in one request', async () => {
  const result = await readOwnPostsBatch({ userId: 'me', startPage: 1, fetchPage: async () => [post('a', 'me'), post('b')] });
  assert.deepEqual(result.posts.map((item) => item.id), ['a']);
  assert.equal(result.hasMore, false);
  assert.equal(result.nextPage, 2);
});
