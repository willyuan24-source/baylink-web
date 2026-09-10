import assert from 'node:assert/strict';
import test from 'node:test';
import { getStoredUser, parseStoredUser, removeStoredUser, SESSION_KEY } from '../src/lib/session';

test('session parser rejects malformed JSON, invalid identities and non-object values', () => {
  for (const raw of [null, '', '{broken', 'null', 'true', '42', '[]', '{}', '{"id": "u"}',
    '{"id":"u","token":123}', '{"id":"   ","token":"token"}', '{"id":"u","token":"  "}']) {
    assert.equal(parseStoredUser(raw), null, `should reject ${raw}`);
  }
});

test('session parser preserves a valid session without interpreting the token', () => {
  const stored = { id: 'neighbor-1', token: 'opaque-token', nickname: '湾区邻居', role: 'user', profileTags: ['搬家'], socialLinks: { instagram: 'neighbor' } };
  assert.deepEqual(parseStoredUser(JSON.stringify(stored)), stored);
});

test('session parser rejects malformed renderable profile fields rather than returning a crashable user', () => {
  const session = { id: 'u', token: 'opaque-token' };
  for (const fields of [{ nickname: {} }, { profileTags: 'tag' }, { interests: [{}] },
    { socialLinks: { instagram: {} } }, { officialVerification: { rejectionReason: {} } },
    { profileTheme: {} }, { statusText: [] }, { coverImage: {} }]) {
    assert.equal(parseStoredUser(JSON.stringify({ ...session, ...fields })), null);
  }
});

test('reading a corrupted session clears only that key and restricted storage remains safe', () => {
  const entries = new Map([[SESSION_KEY, '{broken'], ['unrelated', 'keep']]);
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
      getItem: (key: string) => entries.get(key) ?? null,
      removeItem: (key: string) => entries.delete(key),
    } });
    assert.equal(getStoredUser(), null);
    assert.equal(entries.has(SESSION_KEY), false);
    assert.equal(entries.get('unrelated'), 'keep');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { throw new Error('storage unavailable'); } });
    assert.equal(getStoredUser(), null);
    assert.doesNotThrow(removeStoredUser);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
