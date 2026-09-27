import('/src/opus-bay/core/store.ts').then(m => { window.__perfStore = m.game; });
window.__perf = {
  async go(x, z, fx, fz) {
    const ob = window.__opusBay;
    const flow = await import('/src/opus-bay/game/flow.ts');
    const nav = await import('/src/opus-bay/actors/nav.ts');
    const cinema = await import('/src/opus-bay/game/cinema.ts');
    ob.world.clearCam();
    await ob.city.focus(x, z, 150);
    const p = nav.arrivalSpot({ x, z }, 30) ?? { x, z };
    flow.teleportPlayer(p);
    ob.city.focus(null);
    cinema.faceCameraToward(fx, fz);
    return JSON.stringify({ x: +p.x.toFixed(1), z: +p.z.toFixed(1) });
  },
  info() {
    const ob = window.__opusBay, gl = ob.renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
        return JSON.stringify({ gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      multiDraw: !!gl.getExtension('WEBGL_multi_draw'), pool: ob.city?.stats?.().pool?.kind, dpr: window.devicePixelRatio,
      pixelRatio: ob.renderer.getPixelRatio(), canvas: [gl.drawingBufferWidth, gl.drawingBufferHeight], ua: navigator.userAgent.slice(0, 80) });
  },
  frames(ms, walk) {
    return new Promise(done => {
      const key = type => window.dispatchEvent(new KeyboardEvent(type, { code: 'KeyW', key: 'w' }));
      const d = []; let t0 = 0, last = 0;
      if (walk) key('keydown');
      requestAnimationFrame(function f(now) {
        if (!t0) t0 = last = now; else { d.push(now - last); last = now; }
        if (now - t0 < ms) return requestAnimationFrame(f);
        if (walk) key('keyup');
        const s = [...d].sort((a, b) => a - b), q = p => s[Math.min(s.length - 1, Math.floor(p * s.length))];
        const ob = window.__opusBay, i = ob.renderer.info, c = ob.city ? ob.city.stats() : {};
        const mem = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null;
        done(JSON.stringify({ walk, fps: +(1000 * d.length / (last - t0)).toFixed(1), p50: +q(0.5).toFixed(1),
          p95: +q(0.95).toFixed(1), p99: +q(0.99).toFixed(1), over50: d.filter(x => x > 50).length,
          over100: d.filter(x => x > 100).length, calls: i.render.calls, tris: i.render.triangles,
          programs: i.programs.length, geos: i.memory.geometries, tex: i.memory.textures, objects: ob.world.stats().objects,
          l0: c.l0, l1: c.l1, l2: c.l2, queued: c.queued, errors: c.errors, heapMB: mem,
          pixelRatio: ob.renderer.getPixelRatio(), quality: window.__perfStore?.get().settings.quality }));
      });
    });
  },
};
'ok';
