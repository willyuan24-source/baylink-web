import assert from 'node:assert/strict';
import test from 'node:test';
import { getImageProvenance } from '../src/lib/image-provenance';

test('provenance labels distinguish archive years, official media and AI without claiming the pictured event is current', () => {
  const archive = { kind: 'photo' as const, credit: 'Example photographer · CC BY-SA', caption: '2018 年的资料照片，不能代表今年活动现场。' };
  assert.equal(getImageProvenance(archive), '资料图 · 2018');
  assert.equal(getImageProvenance(archive, true), 'Archive photo · 2018');
  assert.equal(getImageProvenance({ ...archive, kind: 'illustration', credit: 'BAYLINK' }), 'AI 插图');
  assert.equal(getImageProvenance({ ...archive, kind: 'poster', credit: 'Official organizer' }), '官方图');
  assert.equal(getImageProvenance({ ...archive, caption: '地点环境，出发前请确认开放情况。' }), '实拍');
});
