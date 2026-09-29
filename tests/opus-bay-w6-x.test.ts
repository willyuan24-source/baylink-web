/**
 * Wave 6 · lane X: the Halloween postcards (W6-X2), the Halloween sounds (W6-X3) and the voice table (W6-X4).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');

test('W6-X2 · the four Halloween postcards: every file on disk at its size, bilingual titles and alts, lookup by id', async () => {
  const { HALLOWEEN_POSTCARDS, HALLOWEEN_POSTCARD_IDS, halloweenPostcard } = await import('../src/opus-bay/data/sf/halloweenPostcards');
  assert.equal(HALLOWEEN_POSTCARDS.length, 4);
  assert.deepEqual(HALLOWEEN_POSTCARDS.map(p => p.id), [...HALLOWEEN_POSTCARD_IDS]);
  assert.deepEqual(new Set(HALLOWEEN_POSTCARDS.map(p => p.moment)), new Set(['hunt-end', 'treat', 'night', 'muertos']));
  for (const p of HALLOWEEN_POSTCARDS) {
    for (const [file, w, h] of [[p.large, 1200, 900], [p.small, 600, 450]] as const) {
      const disk = path.join(ROOT, 'public', file);
      assert.ok(fs.existsSync(disk), `${file} exists`);
      const buf = fs.readFileSync(disk);
      assert.equal(buf.toString('ascii', 0, 4), 'RIFF');
      assert.equal(buf.toString('ascii', 8, 12), 'WEBP');
      assert.ok(buf.length < 160_000, `${file} is small (${buf.length} B)`);
      // VP8 (lossy) frame header: the width / height at bytes 26–29
      assert.equal(buf.toString('ascii', 12, 16), 'VP8 ');
      assert.deepEqual([buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff], [w, h], `${file} is ${w} × ${h}`);
    }
    for (const t of [p.title, p.alt]) {
      assert.ok(/[一-鿿]/.test(t.zh) && /[A-Za-z]/.test(t.en), `${p.id} is bilingual`);
    }
    assert.equal(halloweenPostcard(p.id), p);
  }
  assert.equal(halloweenPostcard('nope'), null);
});

/** A recording stand-in for the audio engine: every voice, tone and noise burst the recipes schedule. */
function fakeEngine() {
  const voices: { dur: number; name?: string; gain?: number }[] = [];
  const events: { kind: 'tone' | 'noise'; voice: number; offset: number; end: number; peak: number; freq?: number; type?: string }[] = [];
  const e = {
    now: 0,
    voice(o: { dur: number; name?: string; gain?: number }) { voices.push(o); return { id: voices.length - 1 }; },
    tone(v: { id: number }, o: { freq: number; decay: number; attack?: number; peak?: number; offset?: number; type?: string }) {
      const offset = o.offset ?? 0;
      events.push({ kind: 'tone', voice: v.id, offset, end: offset + (o.attack ?? 0) + o.decay, peak: o.peak ?? 1, freq: o.freq, type: o.type });
    },
    noiseBurst(v: { id: number }, o: { decay: number; attack?: number; peak?: number; offset?: number }) {
      const offset = o.offset ?? 0;
      events.push({ kind: 'noise', voice: v.id, offset, end: offset + (o.attack ?? 0) + o.decay, peak: o.peak ?? 1 });
    },
  };
  return { e, voices, events };
}

test('W6-X3 · halloweenSound: treat, pumpkin, costume on / off, the big night only', async () => {
  const { halloweenSound } = await import('../src/opus-bay/audio/halloween');
  assert.equal(halloweenSound({ what: 'treat', id: 'door:3' }), 'treat');
  assert.equal(halloweenSound({ what: 'pumpkin', id: 'pumpkin:12' }), 'pumpkin');
  assert.equal(halloweenSound({ what: 'costume', id: 'costume-witch-hat' }), 'costume-on');
  assert.equal(halloweenSound({ what: 'costume', id: '' }), 'costume-off');
  assert.equal(halloweenSound({ what: 'phase', id: 'night' }), 'night-toll');
  for (const id of ['off', 'season', 'muertos']) assert.equal(halloweenSound({ what: 'phase', id }), null);
});

test('W6-X3 · every Halloween recipe fits its voice: scheduled inside `dur`, one voice each, sane peaks', async () => {
  const { HALLOWEEN_DUR, playHalloween } = await import('../src/opus-bay/audio/halloween');
  for (const sound of Object.keys(HALLOWEEN_DUR) as (keyof typeof HALLOWEEN_DUR)[]) {
    const { e, voices, events } = fakeEngine();
    playHalloween(e as never, sound);
    assert.equal(voices.length, 1, `${sound}: one voice`);
    assert.ok(events.length >= 2, `${sound}: something plays`);
    const end = Math.max(...events.map(x => x.end));
    assert.ok(end <= voices[0].dur + 1e-9, `${sound}: ends at ${end.toFixed(2)} s ≤ dur ${voices[0].dur}`);
    assert.ok(events.every(x => x.peak > 0 && x.peak <= 1), `${sound}: peaks in (0, 1]`);
    assert.ok(events.every(x => x.freq === undefined || (x.freq >= 40 && x.freq <= 12000)), `${sound}: audible frequencies`);
  }
});

test('W6-X3 · the trick-or-treat vignette: three knocks, then the creak, then the candies, then the chime', async () => {
  const { playHalloween } = await import('../src/opus-bay/audio/halloween');
  const { e, events } = fakeEngine();
  playHalloween(e as never, 'treat');
  const knocks = [...new Set(events.filter(x => x.kind === 'tone' && x.type === 'sine' && (x.freq ?? 0) < 160).map(x => x.offset))];
  assert.equal(knocks.length, 3);
  const creak = events.filter(x => x.type === 'sawtooth').map(x => x.offset);
  const chime = events.filter(x => x.type === 'triangle').map(x => x.offset);
  assert.ok(Math.min(...creak) > Math.max(...knocks), 'the door opens after the knocks');
  assert.ok(Math.min(...chime) > Math.min(...creak), 'the chime comes last');
});

test('W6-X3 · the big night tolls once a session; audio.ts loads the sounds lazily (not in the main graph)', async () => {
  const { playHalloween } = await import('../src/opus-bay/audio/halloween');
  const a = fakeEngine();
  playHalloween(a.e as never, 'night-toll');
  const b = fakeEngine();
  playHalloween(b.e as never, 'night-toll');
  // (the recipe test above may have tolled already in this process: at most one toll in all)
  assert.ok(a.voices.length <= 1);
  assert.equal(b.voices.length, 0);
  const src = fs.readFileSync(path.join(ROOT, 'src/opus-bay/audio/audio.ts'), 'utf8');
  assert.ok(!/^import .*'\.\/halloween'/m.test(src), 'no static import of ./halloween');
  assert.match(src, /import\('\.\/halloween'\)/);
  assert.match(src, /case 'halloween': halloweenSfx\(e, ev\)/);
});

test('W6-X5 · the city crowd near figure: a face, sleeves and hands; per-walker skin / hair; small; the district figure unchanged', async () => {
  const { cityPersonGeometry, personFarGeometry } = await import('../src/opus-bay/world/sf/crowd');
  const { personGeometry, crowdPeopleMaterial } = await import('../src/opus-bay/world/life');
  const tris = (g: { index: { count: number } | null; getAttribute(n: string): { count: number } }) => (g.index ? g.index.count : g.getAttribute('position').count) / 3;
  const near = cityPersonGeometry(), far = personFarGeometry(), district = personGeometry();
  console.log(`near ${tris(near as never)} · far ${tris(far as never)} · district ${tris(district as never)} triangles`);
  assert.ok(tris(near as never) <= 700, `near figure ${tris(near as never)} ≤ 700 (at most CROWD.nearMax = 18 a frame: ≤ 12.6k)`);
  assert.ok(tris(far as never) <= 100);
  const info = near.getAttribute('aInfo'), pos = near.getAttribute('position'), col = near.getAttribute('color');
  let wave = 0, waveMinX = Infinity, tone = 0, dark = 0, face = 0, legs = 0;
  for (let i = 0; i < info.count; i++) {
    if (info.getZ(i) > 0.5) { wave++; waveMinX = Math.min(waveMinX, pos.getX(i)); }
    if (Math.abs(info.getX(i) - 10) < 0.5) tone++;
    if (Math.abs(info.getY(i)) > 0.5) legs++;
    // the eyes: very dark, unflagged vertices on the head's front
    if (info.getX(i) < 0.5 && pos.getY(i) > 1.1 && pos.getZ(i) > 0.15 && col.getX(i) + col.getY(i) + col.getZ(i) < 0.1) dark++;
    if (pos.getY(i) > 1.1 && pos.getZ(i) > 0.15 && info.getX(i) < 0.5) face++;
  }
  assert.ok(wave > 0 && waveMinX > 0.1, 'one hand (x > 0) waves back, as before');
  assert.ok(tone > 0 && legs > 0 && dark > 0 && face > dark, 'skin / hair channel, swinging legs, eyes and cheeks');
  // the district's promenade figure has no tone channel (its looks unchanged)
  const dInfo = district.getAttribute('aInfo');
  for (let i = 0; i < dInfo.count; i++) assert.ok(dInfo.getX(i) < 9.5, 'the promenade figure is untouched');
  // the shader: the shirt tint only for 9, the tones for 10 (from the walker's phase)
  const shader = { uniforms: {} as Record<string, unknown>, vertexShader: '#include <common>\n#include <color_vertex>\n#include <begin_vertex>', fragmentShader: '' };
  crowdPeopleMaterial().onBeforeCompile(shader as never, undefined as never);
  assert.match(shader.vertexShader, /aInfo\.x > 8\.5 && aInfo\.x < 9\.5\) vColor\.rgb \*= instanceColor\.rgb/);
  assert.match(shader.vertexShader, /aInfo\.x > 9\.5 && aInfo\.x < 10\.5/);
  assert.match(shader.vertexShader, /fract\(sin\(aPhase/);
});

test('W6-X5 · the promenade walkers wear the city figure in city mode only (registered by the city chunk)', async () => {
  const { game } = await import('../src/opus-bay/core/store');
  const { Life, cityPeopleFigure } = await import('../src/opus-bay/world/life');
  await import('../src/opus-bay/world/sf/crowd');
  assert.ok(cityPeopleFigure.make, 'crowd.ts registers the city figure');
  const before = game.get().worldMode;
  const life = new Life([]);
  const people = life.group.getObjectByName('pedestrians') as import('three').InstancedMesh;
  const district = people.geometry;
  const hasTone = (g: import('three').BufferGeometry) => { const a = g.getAttribute('aInfo'); for (let i = 0; i < a.count; i++) if (a.getX(i) > 9.5) return true; return false; };
  assert.equal(hasTone(district), false);
  game.set({ worldMode: 'city' } as never);
  (life as unknown as { pickPeopleFigure(city: boolean): void }).pickPeopleFigure(true);
  assert.notEqual(people.geometry, district);
  assert.ok(hasTone(people.geometry));
  assert.equal(people.geometry.getAttribute('aPhase'), district.getAttribute('aPhase'), 'the same per-walker attributes');
  (life as unknown as { pickPeopleFigure(city: boolean): void }).pickPeopleFigure(false);
  assert.equal(people.geometry, district, 'back in the district: its own figure');
  game.set({ worldMode: before } as never);
  life.dispose();
});

test('W6-X4 · BAYBAY speaks lanes G and H\'s Halloween lines: every line recorded (zh + en files on disk), matched by exact text', async () => {
  const { W6_VOICE_LINES, W6_VOICE_CHECK, W6_VOICE_CLIPS } = await import('../src/opus-bay/data/sf/voiceW6');
  const { HALLOWEEN_LINES } = await import('../src/opus-bay/halloween/lines');
  const { ALL_WORLD_LINES } = await import('../src/opus-bay/halloween/worldLines');
  const { w5VoiceFor } = await import('../src/opus-bay/game/voiceW5');
  const byId = new Map(W6_VOICE_LINES.map(l => [l.id, l]));
  for (const l of [...HALLOWEEN_LINES, ...ALL_WORLD_LINES]) {
    const rec = byId.get(l.id);
    assert.ok(rec, `${l.id} recorded`);
    // a line whose text changed after the recording stays text (the binder matches exact texts): flag it here
    assert.equal(rec!.zh, l.zh, `${l.id} zh unchanged since the recording`);
    assert.equal(rec!.en, l.en, `${l.id} en unchanged since the recording`);
    assert.equal(w5VoiceFor({ zh: l.zh, en: l.en }), l.id);
  }
  for (const [clip, c] of Object.entries(W6_VOICE_CLIPS)) {
    for (const f of [c.m4a, c.ogg]) {
      const disk = path.join(ROOT, 'public', f!);
      assert.ok(fs.existsSync(disk) && fs.statSync(disk).size > 2000, `${clip}: ${f}`);
    }
    assert.ok(c.duration > 0.5 && c.duration < 8, `${clip} ${c.duration} s`);
  }
  assert.ok(W6_VOICE_CHECK.every(c => c in W6_VOICE_CLIPS));
  assert.equal(w5VoiceFor({ zh: '不给糖就捣蛋！', en: 'Trick or treat?' }), null, 'a changed text is not matched');
});

test('W6-X3 · a Halloween moment a lane sounds itself (lane H\'s registered find chime) is left to that lane', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/opus-bay/audio/audio.ts'), 'utf8');
  assert.match(src, /ev\.what === 'pumpkin' && soundRegistered\('halloween:pumpkin'\)\) return;/);
});

test('W6-X6 · the title shows the Halloween key art in city mode in the season and on the big night only', async () => {
  const { KEY_ART, KEY_ART_HALLOWEEN, keyArtFor, titleInHalloween, ASSETS } = await import('../src/opus-bay/data/assets');
  const { halloweenPhase } = await import('../src/opus-bay/halloween/season');
  assert.equal(keyArtFor('city', true), KEY_ART_HALLOWEEN);
  assert.equal(keyArtFor('city', false), KEY_ART);
  assert.equal(keyArtFor('district', true), KEY_ART, 'the district never changes');
  // the title's rule agrees with halloween/season.ts on every day of Sep–Nov 2026 and on every preview value
  for (let t = Date.UTC(2026, 8, 1, 19); t < Date.UTC(2026, 11, 1); t += 864e5) {
    const d = new Date(t), phase = halloweenPhase(d, null);
    assert.equal(titleInHalloween(d, null), phase === 'season' || phase === 'night', d.toISOString());
  }
  for (const v of ['1', 'season', 'night', 'muertos', 'off', '0', 'nope']) {
    const phase = halloweenPhase(new Date(Date.UTC(2026, 8, 29, 19)), `?halloween=${v}`);
    assert.equal(titleInHalloween(new Date(Date.UTC(2026, 8, 29, 19)), `?halloween=${v}`), phase === 'season' || phase === 'night', v);
  }
  // node: the district (NODE_WORLD_MODE), so the manifest keeps the shipped art
  assert.equal(ASSETS.keyArt, KEY_ART);
  for (const f of [KEY_ART_HALLOWEEN.wide, KEY_ART_HALLOWEEN.tall, ...KEY_ART_HALLOWEEN.wideSrcSet.split(', ').map(s => s.split(' ')[0]), ...KEY_ART_HALLOWEEN.tallSrcSet.split(', ').map(s => s.split(' ')[0])]) {
    const disk = path.join(ROOT, 'public', f);
    assert.ok(fs.existsSync(disk) && fs.statSync(disk).size < 120_000, f);
  }
  assert.ok(/[一-鿿]/.test(KEY_ART_HALLOWEEN.alt) && /jack-o/.test(KEY_ART_HALLOWEEN.altEn));
});
