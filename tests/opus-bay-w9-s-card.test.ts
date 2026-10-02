import assert from 'node:assert/strict';
import test from 'node:test';
import jsQR from 'jsqr';

// Wave 9 · lane S · W9-S4 (review R§5 #8, §8 idea 5): the 「约家人」 card — an event, a place or 我的周末 as a vertical
// picture (date, place, cost, how to get there) with a QR code back into the game at the same spot (`?from=family`),
// in the site's share-card style; the layout keeps every line inside the frame and the rows clear of the QR panel; the
// code decodes (jsQR) at the card's size and box-filtered to 60 %.

const M = await import('../src/opus-bay/ui/shareCardModel');
const D = await import('../src/opus-bay/ui/shareCardDraw');
const P = await import('../src/opus-bay/game/photoCard');

const zh: import('../src/opus-bay/ui/shareCardModel').Tr = z => z;
const en: import('../src/opus-bay/ui/shareCardModel').Tr = (_z, e) => e;

const EVENT = { id: 'sfpl-richmond-lego-oct7-2026', title: '里士满分馆乐高时间', dateLabel: '15:30–16:30', venue: 'Richmond Branch Library', city: 'San Francisco', cost: 'free', costLabel: undefined };

/** A raster of the ctx calls paintCard makes (white = '#ffffff' / the paper; any other fill = dark); text is not drawn. */
function raster(w: number, h: number) {
  const px = new Uint8ClampedArray(w * h * 4).fill(255);
  let v = 255;
  const ctx = {
    strokeStyle: '', lineWidth: 1, font: '', textBaseline: 'alphabetic' as CanvasTextBaseline,
    set fillStyle(c: string) { v = /^#(ffffff|f7f4eb|dce8cc)$/i.test(c) ? 255 : 31; },
    get fillStyle() { return v === 255 ? '#ffffff' : '#000000'; },
    beginPath() {}, fill() {}, moveTo() {}, bezierCurveTo() {}, stroke() {}, fillText() {},
    fillRect(x: number, y: number, rw: number, rh: number) {
      for (let yy = Math.max(0, Math.round(y)); yy < Math.min(h, Math.round(y + rh)); yy++) {
        for (let xx = Math.max(0, Math.round(x)); xx < Math.min(w, Math.round(x + rw)); xx++) { const i = (yy * w + xx) * 4; px[i] = v; px[i + 1] = v; px[i + 2] = v; px[i + 3] = 255; }
      }
    },
  };
  return { px, ctx };
}
function downscale(px: Uint8ClampedArray, w: number, h: number, k: number) {
  const W = Math.floor(w * k), H = Math.floor(h * k), out = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let s = 0, n = 0;
    for (let yy = Math.floor(y / k); yy < Math.min(h, Math.floor((y + 1) / k)); yy++) for (let xx = Math.floor(x / k); xx < Math.min(w, Math.floor((x + 1) / k)); xx++) { s += px[(yy * w + xx) * 4]; n++; }
    const c = n ? s / n : 255, i = (y * W + x) * 4; out[i] = c; out[i + 1] = c; out[i + 2] = c; out[i + 3] = 255;
  }
  return { out, W, H };
}

test('cardDay: an absolute short day in each language (never 今天 / 明天); anything else is kept as is', () => {
  assert.equal(M.cardDay('2026-10-03', zh), '10月3日 · 周六');
  assert.equal(M.cardDay('2026-10-03', en), 'Sat, Oct 3');
  assert.equal(M.cardDay('2026-10-31', zh), '10月31日 · 周六');
  assert.equal(M.cardDay('soon', zh), 'soon');
});

test('eventCard: date (+ the editors\' line), place, cost, how to get there; the code goes to the event\'s spot with from=family', () => {
  const card = M.eventCard(EVENT, { t: zh, next: '2026-10-07', spot: { x: -812.4, z: 233.6 }, how: ['N 线 · 某站 · 步行约 5 分钟'] });
  assert.equal(card.kicker, '约家人 · 一起去');
  assert.equal(card.title, EVENT.title);
  assert.deepEqual(card.rows.map(r => r.label), ['日期', '地点', '费用', '怎么去']);
  assert.equal(card.rows[0].text, '10月7日 · 周三 · 15:30–16:30');
  assert.equal(card.rows[1].text, 'Richmond Branch Library · San Francisco');
  assert.equal(card.rows[2].text, '免费');
  assert.equal(card.url, 'https://www.baylink.us/opus-bay?at=xz:-812,234&from=family');
  assert.equal(card.file, 'baylink-sfpl-richmond-lego-oct7-2026.png');
  // English; no spot (a venue outside the game's San Francisco): the code opens the game's start, still from=family
  const e = M.eventCard({ ...EVENT, costLabel: '$5' }, { t: en, next: null });
  assert.deepEqual(e.rows.map(r => r.label), ['When', 'Where', 'Cost']);
  assert.equal(e.rows[0].text, '15:30–16:30');
  assert.equal(e.rows[2].text, '$5');
  assert.equal(e.url, 'https://www.baylink.us/opus-bay?from=family');
  for (const c of [card, e]) assert.ok(!/opus bay/i.test(JSON.stringify({ ...c, url: '' })), 'no user-visible "Opus Bay"');
});

test('placeCard: the area in San Francisco, hours and cost as the card has them; the code to the place (or its at id)', () => {
  const spec = { kind: 'place' as const, name: { zh: '科伊特塔', en: 'Coit Tower' }, zone: { zh: '电报山', en: 'Telegraph Hill' }, hours: { zh: '约 10:00–17:00', en: 'About 10:00–17:00' }, x: 310.2, z: -1204.9 };
  const card = M.placeCard(spec, { t: zh });
  assert.deepEqual(card.rows, [{ label: '地点', text: '电报山 · 旧金山' }, { label: '开放', text: '约 10:00–17:00' }]);
  assert.equal(card.url, 'https://www.baylink.us/opus-bay?at=xz:310,-1205&from=family');
  assert.equal(card.file, 'baylink-coit-tower.png');
  assert.equal(M.placeCard({ ...spec, at: 'coit-tower', zone: undefined }, { t: en }).url, 'https://www.baylink.us/opus-bay?at=coit-tower&from=family');
  assert.deepEqual(M.placeCard({ ...spec, zone: undefined }, { t: en }).rows[0], { label: 'Where', text: 'San Francisco' });
});

test('weekendCard: the days, each saved event on its day with venue and cost, the places; ≤ 5 rows + 「还有 n 个」; the code to the first spot', () => {
  const items = Array.from({ length: 5 }, (_, i) => ({ event: { ...EVENT, id: `e${i}`, title: `活动${i}` }, on: ['2026-10-03'], spot: i === 1 ? { x: 1, z: 2 } : null }));
  const card = M.weekendCard(items, ['渔人码头', '金门公园'], { t: zh, days: ['2026-10-03', '2026-10-04'] });
  assert.equal(card.title, '这个周末，一起去？');
  assert.deepEqual(card.rows[0], { label: '日期', text: '10月3日 · 周六、10月4日 · 周日' });
  assert.equal(card.rows.length, 1 + M.WEEKEND_ROWS + 1);
  assert.equal(card.rows[1].text, '活动0 · Richmond Branch Library · 免费');
  assert.equal(M.weekendCard([{ event: { ...EVENT, cost: 'paid', costLabel: '$30 起' }, on: ['2026-10-03'] }], [], { t: zh, days: [] }).rows[0].text, `${EVENT.title} · Richmond Branch Library`, 'the list names a cost only when it is free');
  assert.equal(card.rows.at(-1)?.text, '还有 2 个');
  assert.equal(card.url, 'https://www.baylink.us/opus-bay?at=xz:1,2&from=family');
  assert.equal(M.weekendCard([], ['渔人码头'], { t: en, days: [] }).rows[0].label, 'Saved');
});

test('howLines: the two nearest real lines with the stop and the walk', () => {
  const near = [{ line: { name: { zh: 'N 线', en: 'N Judah' } }, stop: { name: { zh: '第九大道', en: '9th Ave' } }, walkMin: 4 }, { line: { name: { zh: '7 路', en: '7 Haight' } }, stop: { name: { zh: '某站', en: 'Some St' } }, walkMin: 9 }, { line: { name: { zh: 'x', en: 'x' } }, stop: { name: { zh: 'y', en: 'y' } }, walkMin: 1 }];
  assert.deepEqual(M.howLines(near, zh), ['N 线 · 第九大道 · 步行约 4 分钟', '7 路 · 某站 · 步行约 9 分钟']);
  assert.equal(M.howLines(near, en)[0], 'N Judah · 9th Ave · ~4 min walk');
});

test('wrapLines: CJK by character, Latin by word, \\n starts a line, past max lines the last ends with …', () => {
  const m = D.estimate;
  assert.deepEqual(D.wrapLines('一二三四五六', 100, 30, 400, 5, m), ['一二三', '四五六']);
  assert.deepEqual(D.wrapLines('Golden Gate Park', 200, 30, 400, 5, m), ['Golden Gate', 'Park']);
  assert.deepEqual(D.wrapLines('甲\n乙', 500, 30, 400, 5, m), ['甲', '乙']);
  const cut = D.wrapLines('一二三四五六七八九十', 100, 30, 400, 2, m);
  assert.equal(cut.length, 2);
  assert.ok(cut[1].endsWith('…') && m(cut[1], 30, 400) <= 100, cut[1]);
  assert.deepEqual(D.wrapLines('Supercalifragilistic', 120, 30, 400, 9, m).join(''), 'Supercalifragilistic');
  // kinsoku: 、 。 ） never start a line (seen on the first weekend card: a line began with 「、交通另付」) — they hang
  // (≤ half an em past the line), else the character before goes down with them
  assert.deepEqual(D.wrapLines('一二三、四', 110, 30, 400, 5, m), ['一二三、', '四']);
  assert.deepEqual(D.wrapLines('一二三、四', 90, 30, 400, 5, m), ['一二', '三、四']);
  assert.deepEqual(D.wrapLines('一二三）。四', 90, 30, 400, 5, m), ['一二', '三）。', '四']);
  assert.ok(!D.wrapLines('Ferry Plaza 农夫市集：海边逛一圈 · Ferry Building 外 · Ferry Plaza', 900, 38, 500, 5, m).some(l => l.startsWith('·')), 'a line never starts with ·');
  // an English card draws Latin first (a CJK face draws ’ full-width: 「New Year’ s」 on the first Coit Tower card)
  assert.ok(D.cardFont('en').startsWith('system-ui') && D.cardFont('zh').startsWith('"PingFang SC"'));
});

test('layoutCard: a vertical card (≥ 4:5), every line inside the frame, the rows above the QR panel; a long list is cut at MAX_H', () => {
  const how = ['N 线 · 第九大道 · 步行约 4 分钟', '7 路 · 黑特街与第九大道 · 步行约 9 分钟'];
  const cards = [
    M.eventCard({ ...EVENT, title: '金门公园秋日音乐会：带上野餐垫，和家人一起听一下午的爵士与民谣（免费入场）' }, { t: zh, next: '2026-10-04', spot: { x: 0, z: 0 }, how }),
    M.eventCard(EVENT, { t: en, next: '2026-10-07', how: ['N Judah · 9th Ave · ~4 min walk'] }),
    M.placeCard({ kind: 'place', name: { zh: '科伊特塔', en: 'Coit Tower' }, x: 0, z: 0 }, { t: zh }),
  ];
  for (const card of cards) {
    const L = D.layoutCard(card);
    assert.equal(L.w, D.CARD_W);
    assert.ok(L.h >= D.MIN_H && L.h <= D.MAX_H, `h ${L.h}`);
    assert.ok(!L.rowsCut);
    const texts = L.items.filter((i): i is import('../src/opus-bay/ui/shareCardDraw').TextItem => i.kind === 'text');
    for (const it of texts) assert.ok(it.x >= 40 && it.x + D.estimate(it.text, it.size, it.weight) <= D.CARD_W - 40 && it.y < L.h - 30, `${it.text} at ${it.x},${it.y}`);
    const panelTop = L.qr.y - 40;
    const rowTexts = texts.filter(it => card.rows.some(r => r.text.split('\n').some(line => line.startsWith(it.text.replace(/…$/, '')))));
    assert.ok(rowTexts.length > 0);
    for (const it of rowTexts) assert.ok(it.y < panelTop, `row line ${it.text} at ${it.y} over the QR panel ${panelTop}`);
    assert.ok(L.qr.size >= 300 && L.qr.x >= 40 && L.qr.y + L.qr.size <= L.h - 40);
  }
  const long = M.weekendCard(Array.from({ length: 5 }, (_, i) => ({ event: { ...EVENT, id: `e${i}`, title: '一个名字非常非常长的周末活动，长到要折成好几行才放得下'.repeat(2) }, on: ['2026-10-03', '2026-10-04'] })), ['a', 'b'], { t: zh, days: ['2026-10-03', '2026-10-04'] });
  const L = D.layoutCard(long);
  assert.ok(L.h <= D.MAX_H && L.rowsCut, `h ${L.h}, cut ${L.rowsCut}`);
});

test('paintCard: the QR code on the card decodes to the family link, at the card\'s size and box-filtered to 60 %', async () => {
  const card = M.eventCard(EVENT, { t: zh, next: '2026-10-07', spot: { x: -1234.4, z: 1567.6 } });
  const L = D.layoutCard(card);
  const qr = await P.loadQr(card.url);
  assert.ok(qr, 'the qrcode chunk loads');
  const { px, ctx } = raster(L.w, L.h);
  D.paintCard(ctx as unknown as Parameters<typeof D.paintCard>[0], L, qr);
  const full = jsQR(px, L.w, L.h);
  assert.equal(full?.data, card.url);
  const s = downscale(px, L.w, L.h, 0.6);
  assert.equal(jsQR(s.out, s.W, s.H)?.data, card.url);
  // a lost qrcode chunk: the white box only, nothing throws
  const r2 = raster(L.w, L.h);
  D.paintCard(r2.ctx as unknown as Parameters<typeof D.paintCard>[0], L, null);
  assert.equal(jsQR(r2.px, L.w, L.h), null);
});
