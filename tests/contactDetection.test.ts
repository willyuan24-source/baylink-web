import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeContactsInText, detectContactsInText } from '../src/utils/contactDetection';

test('generic contact labels do not invent a WeChat account from a phone or email', () => {
  const result = detectContactsInText('联系方式：415-555-0123，邮箱：neighbor@example.com');
  assert.equal(result.filter((item) => item.type === 'phone').length, 1);
  assert.equal(result.filter((item) => item.type === 'email').length, 1);
  assert.equal(result.some((item) => item.type === 'wechat'), false);
});

test('an explicitly labeled WeChat account is extracted and removed from public text', () => {
  const result = analyzeContactsInText('周末搬家需要两位帮手。微信：baylink_neighbor');
  assert.equal(result.detectedMethods[0].type, 'wechat');
  assert.equal(result.detectedMethods[0].value, 'baylink_neighbor');
  assert.equal(result.cleanedText, '周末搬家需要两位帮手。');
  assert.equal(result.removedFromText, true);
});

test('vague contact wording stays intact instead of pretending it was removed', () => {
  const text = '请通过站内私信联系，不公开联系方式。';
  const result = analyzeContactsInText(text);
  assert.equal(result.cleanedText, text);
  assert.equal(result.keywordOnly, true);
  assert.equal(result.removedFromText, false);
});

test('ordinary text has no removed-contact claim and an email is not partially parsed as WeChat', () => {
  assert.equal(analyzeContactsInText('周末两小时搬家，起点在南湾。').removedFromText, false);
  assert.equal(detectContactsInText('wechat: person@example.com').some((item) => item.type === 'wechat'), false);
});
