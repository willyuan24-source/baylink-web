import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HALLOWEEN_LINES, hLine } from '../src/opus-bay/halloween/lines';

test('W6-G1: the Halloween line table — unique ids and texts, VOICE.md lengths, no controls', () => {
  const ids = new Set<string>(), texts = new Set<string>();
  for (const l of HALLOWEEN_LINES) {
    assert.match(l.id, /^w6g-[a-z0-9-]+$/, l.id);
    assert.ok(!ids.has(l.id), `duplicate id ${l.id}`);
    ids.add(l.id);
    const key = `${l.zh}\n${l.en}`;
    assert.ok(!texts.has(key), `duplicate text ${l.id}`);
    texts.add(key);
    assert.ok([...l.zh].length <= 45, `${l.id}: zh ${[...l.zh].length} > 45`);
    assert.ok(l.en.length <= 110, `${l.id}: en ${l.en.length} > 110`);
    assert.equal(l.zh, l.zh.trim());
    assert.equal(l.en, l.en.trim());
    assert.ok(!/按\s*E|press|tap|点击/i.test(l.zh + l.en), `${l.id} names a control`);
    assert.ok(l.when.length > 0);
  }
  assert.deepEqual(hLine('w6g-knock'), { zh: '不给糖就捣蛋！', en: 'Trick or treat!' });
  assert.throws(() => hLine('w6g-nope'));
});
