/**
 * W7-Q1 · the iPhone audio unlock inside the Start tap (audio/unlock.ts, audio/audio.ts createContext / onGesture).
 * A WebKit stand-in: its AudioContext starts only inside a gesture's handler; once a gesture has started it, later
 * resume() calls work without one (WebKit lifts RequireUserGestureForAudioStartRestriction for that context).
 */
import assert from 'node:assert/strict';
import test from 'node:test';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';

function webkitAudio(ua = IPHONE, search = '') {
  let inGesture = false;
  const log: string[] = [];
  const param = () => ({ value: 0, setValueAtTime() {}, setTargetAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} });
  const node = (): Record<string, unknown> => {
    const target: Record<string, unknown> = { connect: (next: unknown) => next, disconnect() {}, start() {}, stop() {}, setPeriodicWave() {}, addEventListener() {}, buffer: null, onended: null, type: '', loop: false };
    return new Proxy(target, { get: (t, k: string) => (k in t ? t[k] : (t[k] = param())) });
  };
  class WkContext {
    static made = 0;
    state: 'suspended' | 'running' | 'closed' = 'suspended';
    lifted = false;
    sampleRate = 48000;
    currentTime = 0;
    destination = node();
    constructor() { WkContext.made++; log.push('new'); }
    createBuffer(channels: number, frames: number) {
      const data = Array.from({ length: channels }, () => new Float32Array(frames));
      return { numberOfChannels: channels, length: frames, sampleRate: this.sampleRate, duration: frames / this.sampleRate, getChannelData: (c: number) => data[c] };
    }
    resume() {
      log.push(inGesture ? 'resume(gesture)' : 'resume');
      if (inGesture || this.lifted) { this.lifted = true; this.state = 'running'; return Promise.resolve(); }
      return Promise.reject(new Error('NotAllowedError: not processing a user gesture'));
    }
    suspend() { log.push('suspend'); this.state = 'suspended'; return Promise.resolve(); }
    close() { this.state = 'closed'; return Promise.resolve(); }
    addEventListener() {}
    createGain() { return node(); }
    createBiquadFilter() { return node(); }
    createDynamicsCompressor() { return node(); }
    createConvolver() { return node(); }
    createStereoPanner() { return node(); }
    createOscillator() { log.push('osc'); return node(); }
    createBufferSource() { log.push('bufferSource'); return node(); }
    createPeriodicWave() { return {}; }
  }
  const listeners = new Map<string, ((ev?: unknown) => void)[]>();
  const on = (type: string, fn: (ev?: unknown) => void) => { listeners.set(type, [...(listeners.get(type) ?? []), fn]); };
  const win = {
    AudioContext: WkContext,
    navigator: { userAgent: ua, maxTouchPoints: 5 },
    location: { search },
    addEventListener: on, removeEventListener() {},
    setTimeout, clearTimeout, setInterval, clearInterval,
  };
  const doc = { visibilityState: 'visible', addEventListener: on, removeEventListener() {} };
  const gesture = (fn: () => void) => { inGesture = true; try { fn(); } finally { inGesture = false; } };
  const fire = (type: string) => (listeners.get(type) ?? []).forEach(fn => fn({}));
  return { WkContext, win, doc, gesture, fire, log };
}

const tick = (ms = 5) => new Promise(r => setTimeout(r, ms));

async function withWindow<T>(fake: ReturnType<typeof webkitAudio>, fn: () => Promise<T>): Promise<T> {
  const g = globalThis as unknown as Record<string, unknown>;
  const saved = { window: g.window, document: g.document };
  g.window = fake.win;
  g.document = fake.doc;
  const { resetUnlockForTests } = await import('../src/opus-bay/audio/unlock');
  resetUnlockForTests();
  try { return await fn(); } finally { g.window = saved.window; g.document = saved.document; resetUnlockForTests(); }
}

/** startAudio, then wait for the idle preparation to have made (or adopted) the context and built the rig */
async function startPrepared(fake: ReturnType<typeof webkitAudio>) {
  const { startAudio } = await import('../src/opus-bay/audio/audio');
  const { audioProbe } = await import('../src/opus-bay/audio/unlock');
  const stop = startAudio();
  // done when the rig exists (the ambience starts its streetcar whine oscillator)
  for (let i = 0; i < 1000 && !fake.log.includes('osc'); i++) await tick();
  assert.ok(audioProbe.ctx, 'the context exists');
  return stop;
}

test('W7-Q1 gestureUnlockNeeded: every iOS browser and desktop Safari; not Chromium, Gecko or Android', async () => {
  const { gestureUnlockNeeded } = await import('../src/opus-bay/audio/unlock');
  const yes = [
    IPHONE,
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.49(0x18003137) NetType/WIFI Language/zh_CN',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  ];
  const no = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0',
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0',
  ];
  for (const ua of yes) assert.equal(gestureUnlockNeeded({ navigator: { userAgent: ua } }), true, ua);
  for (const ua of no) assert.equal(gestureUnlockNeeded({ navigator: { userAgent: ua } }), false, ua);
  // iPadOS asks for the desktop site: a Macintosh with a touch screen
  assert.equal(gestureUnlockNeeded({ navigator: { userAgent: yes[3], maxTouchPoints: 5 } }), true);
  // QA switches
  assert.equal(gestureUnlockNeeded({ navigator: { userAgent: no[0] }, location: { search: '?world=city&unlock=1' } }), true);
  assert.equal(gestureUnlockNeeded({ navigator: { userAgent: IPHONE }, location: { search: '?unlock=0' } }), false);
});

test('W7-Q1 the bug (unlock off): the Start tap on the title leaves the context suspended; the later start cannot resume it', async () => {
  const fake = webkitAudio(IPHONE, '?unlock=0');
  await withWindow(fake, async () => {
    const { game } = await import('../src/opus-bay/core/store');
    const { emit } = await import('../src/opus-bay/core/events');
    game.set({ phase: 'title' } as never);
    const stop = await startPrepared(fake);
    try {
      assert.equal(fake.WkContext.made, 1, 'the idle slice made the context');
      fake.gesture(() => fake.fire('touchend')); // the Start tap: onGesture returns while phase === 'title'
      game.set({ phase: 'playing' } as never);
      emit({ type: 'start' }); // seconds later: after the first frame, outside the gesture
      await tick(20);
      const { audioProbe } = await import('../src/opus-bay/audio/unlock');
      assert.equal(audioProbe.ctx?.state, 'suspended', 'silent until a second tap (the wave-6 iPhone bug)');
    } finally { stop(); }
  });
});

test('W7-Q1 the Start tap primes the idle-made context inside the gesture: the later start plays', async () => {
  const fake = webkitAudio();
  await withWindow(fake, async () => {
    const { game } = await import('../src/opus-bay/core/store');
    const { emit } = await import('../src/opus-bay/core/events');
    const { audioProbe, primeAudio } = await import('../src/opus-bay/audio/unlock');
    game.set({ phase: 'title' } as never);
    const stop = await startPrepared(fake);
    try {
      assert.equal(fake.WkContext.made, 1);
      const made = audioProbe.ctx;
      assert.equal(made?.state, 'suspended', 'quiet on the title');
      // OpusBayPage.start inside the click
      fake.gesture(() => { assert.equal(primeAudio({ starting: true }), true); });
      await tick(20);
      assert.equal(fake.WkContext.made, 1, 'no second context');
      assert.equal(audioProbe.ctx, made);
      assert.equal(made?.state, 'running', 'started inside the tap');
      assert.ok(fake.log.includes('resume(gesture)'));
      game.set({ phase: 'playing' } as never);
      emit({ type: 'start' });
      await tick(600);
      assert.equal(made?.state, 'running', 'still running at the arrival (not suspended again)');
      assert.equal(audioProbe.activated, true);
    } finally { stop(); }
  });
});

test('W7-Q1 a tap before the audio chunk: the page makes the context in the tap and audio.ts adopts it', async () => {
  const fake = webkitAudio();
  await withWindow(fake, async () => {
    const { game } = await import('../src/opus-bay/core/store');
    const { emit } = await import('../src/opus-bay/core/events');
    const { audioProbe, primeAudio } = await import('../src/opus-bay/audio/unlock');
    game.set({ phase: 'title' } as never);
    fake.gesture(() => { primeAudio({ starting: true }); });
    await tick(10);
    assert.equal(fake.WkContext.made, 1, 'made inside the tap');
    const made = audioProbe.ctx;
    assert.equal(made?.state, 'running');
    const stop = await startPrepared(fake);
    try {
      assert.equal(fake.WkContext.made, 1, 'audio.ts adopted it: one context for the page');
      assert.equal(audioProbe.adopted, true);
      assert.equal(made?.state, 'running', 'not suspended by createContext (the Start tap left it running)');
      game.set({ phase: 'playing' } as never);
      emit({ type: 'start' });
      await tick(50);
      assert.equal(made?.state, 'running');
    } finally { stop(); }
    assert.equal(audioProbe.ctx, null, 'released when audio.ts closes it');
  });
});

test('W7-Q1 a title tap (not Start) unlocks, then goes quiet; the later start resumes without a gesture', async () => {
  const fake = webkitAudio();
  await withWindow(fake, async () => {
    const { game } = await import('../src/opus-bay/core/store');
    const { emit } = await import('../src/opus-bay/core/events');
    const { audioProbe } = await import('../src/opus-bay/audio/unlock');
    game.set({ phase: 'title' } as never);
    const stop = await startPrepared(fake);
    try {
      const made = audioProbe.ctx!;
      fake.gesture(() => fake.fire('touchend')); // e.g. a language pill
      await tick(20);
      assert.equal(made.state, 'running', 'WebKit saw it start inside the tap');
      assert.equal(audioProbe.unlocked, true);
      await tick(500);
      assert.equal(made.state, 'suspended', 'the title stays quiet');
      game.set({ phase: 'playing' } as never);
      emit({ type: 'start' }); // outside any gesture
      await tick(20);
      assert.equal(made.state, 'running', 'the restriction is lifted for this context');
    } finally { stop(); }
  });
});

test('W7-Q1 Chrome / Android: primeAudio does nothing (sticky activation; no audio device opened inside the tap)', async () => {
  const fake = webkitAudio('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36');
  await withWindow(fake, async () => {
    const { primeAudio, audioProbe } = await import('../src/opus-bay/audio/unlock');
    fake.gesture(() => { assert.equal(primeAudio({ starting: true }), false); });
    assert.equal(fake.WkContext.made, 0);
    assert.equal(audioProbe.ctx, null);
  });
});
