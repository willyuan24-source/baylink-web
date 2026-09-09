import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_SAVED_POSTS, parseSavedPosts, savedPostsKey, toggleSavedPost } from '../src/lib/savedPosts';

function storage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}
const post = { id: 'p1', title: '示例房源', city: '东湾', category: '租屋', budget: '$1900' };

test('saved posts isolate accounts and persist only public display fields', () => {
  const store = storage();
  const privatePost = { ...post, author: { email: 'private@example.test' }, contactInfo: 'private-contact', token: 'private-token' };
  assert.deepEqual(toggleSavedPost(store, 'one', privatePost, 100), { saved: true, error: null });
  assert.deepEqual(parseSavedPosts(store.getItem(savedPostsKey('one'))), [{ ...post, savedAt: 100 }]);
  assert.deepEqual(parseSavedPosts(store.getItem(savedPostsKey('two'))), []);
  assert.deepEqual(parseSavedPosts(store.getItem(savedPostsKey())), []);
  assert.equal(store.getItem(savedPostsKey('one'))?.includes('private'), false);
  assert.deepEqual(toggleSavedPost(store, 'one', post), { saved: false, error: null });
  assert.deepEqual(parseSavedPosts(store.getItem(savedPostsKey('one'))), []);
});

test('corrupt storage and duplicate entries cannot break the saved list', () => {
  assert.deepEqual(parseSavedPosts('{broken'), []);
  assert.deepEqual(parseSavedPosts('{"id":"not-an-array"}'), []);
  assert.deepEqual(parseSavedPosts(JSON.stringify([null, { id: 1 }, { ...post, savedAt: 50 }, post])), [{ ...post, savedAt: 50 }]);
});

test('storage denial reports failure, and a full list never silently evicts a saved post', () => {
  const denied = { getItem: () => null, setItem: () => { throw new Error('quota exceeded'); } };
  assert.ok(toggleSavedPost(denied, 'one', post).error);
  const store = storage();
  store.setItem(savedPostsKey('one'), JSON.stringify(Array.from({ length: MAX_SAVED_POSTS }, (_, index) => ({ ...post, id: `saved-${index}`, savedAt: index }))));
  const before = store.getItem(savedPostsKey('one'));
  assert.ok(toggleSavedPost(store, 'one', post).error);
  assert.equal(store.getItem(savedPostsKey('one')), before);
  assert.equal(toggleSavedPost(store, 'one', { ...post, id: 'saved-0' }).error, null);
  assert.equal(parseSavedPosts(store.getItem(savedPostsKey('one'))).length, MAX_SAVED_POSTS - 1);
});
