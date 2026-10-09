import assert from 'node:assert/strict';
import test from 'node:test';
import { getImageProvenance, typeCoverProvenance } from '../src/lib/image-provenance';
import { GUIDE_IMAGES } from '../src/data/guide-media';

test('provenance labels distinguish archive years, official media and AI without claiming the pictured event is current', () => {
  const archive = { kind: 'photo' as const, credit: 'Example photographer · CC BY-SA', caption: '2018 年的资料照片，不能代表今年活动现场。' };
  assert.equal(getImageProvenance(archive), '资料图 · 2018');
  assert.equal(getImageProvenance(archive, true), 'Archive photo · 2018');
  assert.equal(getImageProvenance({ ...archive, kind: 'illustration', credit: 'BAYLINK' }), 'AI 插图');
  assert.equal(getImageProvenance({ ...archive, kind: 'poster', credit: 'Official organizer' }), '官方图');
  assert.equal(getImageProvenance({ ...archive, caption: '地点环境，出发前请确认开放情况。' }), '照片');
});

test('third-party photos read as a dated photo, with the year taken from the caption and never from the credit', () => {
  const photo = { kind: 'photo' as const, credit: 'Example photographer · CC BY 2.0', caption: '唐人街街口，2023 年摄。' };
  assert.equal(getImageProvenance(photo), '照片 · 2023');
  assert.equal(getImageProvenance(photo, true), 'Photo · 2023');
  assert.equal(getImageProvenance({ kind: 'photo', credit: 'Runner1928 · CC BY-SA 3.0', caption: 'Half Moon Bay State Beach，2014 年实景。' }), '照片 · 2014');
  assert.equal(getImageProvenance({ kind: 'photo', credit: 'Runner1928 · CC BY-SA 3.0', caption: '海滩入口实景。' }), '照片', 'a username with digits is not a capture year');
});

test('BAYLINK 实拍 needs an own shot; 3D postcards and coded covers have their own labels; structured rights decide 官方图', () => {
  const own = { kind: 'photo' as const, credit: 'BAYLINK', caption: '2026 年摄', ownShot: true, shotAt: '2026-10-10' };
  assert.equal(getImageProvenance(own, false, '2026-10-12'), 'BAYLINK 实拍 · 10/10');
  assert.equal(getImageProvenance(own, true, '2026-10-12'), 'BAYLINK photo · 10/10');
  assert.equal(getImageProvenance(own, false, '2027-01-02'), 'BAYLINK 实拍 · 2026/10/10', 'another year is spelled out');
  assert.equal(getImageProvenance({ ...own, shotAt: undefined }), 'BAYLINK 实拍');
  assert.equal(getImageProvenance({ kind: 'illustration', credit: 'BAYLINK', caption: '3D 明信片', scene3d: true }), '3D 场景插图');
  assert.equal(getImageProvenance({ kind: 'illustration', credit: 'BAYLINK', caption: '3D', scene3d: true }, true), '3D scene illustration');
  assert.equal(getImageProvenance({ kind: 'photo', credit: 'Organiser', caption: '2025 年活动现场', rights: { basis: 'press-kit' } }), '官方图');
  assert.equal(getImageProvenance({ kind: 'photo', credit: 'Organiser', caption: '2025 年', rights: 'CC BY 4.0 as stated' }), '照片 · 2025', 'prose rights never make an image official');
  assert.equal(typeCoverProvenance(), 'BAYLINK 信息卡');
  assert.equal(typeCoverProvenance(true), 'Info card');
});

test('no registered image is labelled as BAYLINK’s own on-location shot', () => {
  for (const [key, image] of Object.entries(GUIDE_IMAGES)) {
    for (const label of [getImageProvenance(image), getImageProvenance(image, true)]) {
      assert.doesNotMatch(label, /实拍|实景/, key);
      const year = label.match(/ · (\d{4})$/)?.[1];
      if (year) assert.ok(image.caption.includes(year), `${key}: the label year ${year} must come from the caption`);
    }
  }
});
