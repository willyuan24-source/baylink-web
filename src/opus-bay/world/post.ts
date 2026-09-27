import * as THREE from 'three';

/**
 * High-tier post pass: the scene renders into an MSAA half-float target; a quarter-resolution bloom chain
 * (bright pass + two separable 9-tap blurs) picks up lamps, windows and bridge lights; one full-screen pass
 * adds the miniature tilt-shift band (focused on the player, or on the pair in a conversation), a vignette,
 * a time-of-day grade with a cool shadow lift and the bloom, before tone mapping.
 */

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const FRAG = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform vec2 uRes;
uniform float uFocus;
uniform float uBand;
uniform float uBlur;
uniform float uVignette;
uniform float uWarm;
uniform float uBloom;
uniform vec3 uShadowTint;
varying vec2 vUv;
void main() {
  vec2 uv = vUv;
  vec3 col = texture2D(tScene, uv).rgb;
  float dy = uv.y - uFocus;
  // tilt-shift: full blur toward the top (distance), lighter toward the bottom (foreground)
  float amt = smoothstep(uBand, uBand + 0.34, abs(dy)) * (dy > 0.0 ? 1.0 : 0.55);
  if (amt > 0.01) {
    vec3 acc = col;
    float wsum = 1.0;
    for (int i = 0; i < 14; i++) {
      float a = float(i) * 2.39996;
      float r = sqrt(float(i) + 0.5) / sqrt(14.0);
      vec2 o = vec2(cos(a), sin(a)) * r * uBlur * amt / uRes;
      acc += texture2D(tScene, uv + o).rgb;
      wsum += 1.0;
    }
    col = acc / wsum;
  }
  col += texture2D(tBloom, uv).rgb * uBloom;
  // cool lift in the shadows, warm/cool grade, vignette
  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, uShadowTint, 0.06 * (1.0 - smoothstep(0.0, 0.45, luma)));
  col *= mix(vec3(1.0), vec3(1.035, 1.0, 0.955), uWarm);
  vec2 q = uv - 0.5;
  col *= 1.0 - dot(q, q) * uVignette;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const BRIGHT = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uThreshold;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb + texture2D(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb
         + texture2D(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb + texture2D(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb;
  c *= 0.25;
  float l = max(max(c.r, c.g), c.b);
  float k = smoothstep(uThreshold, uThreshold + 0.5, l);
  gl_FragColor = vec4(min(c * k, vec3(8.0)), 1.0);
}`;

const BLUR = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uDir;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tSrc, vUv).rgb * 0.2270270270;
  c += (texture2D(tSrc, vUv + uDir * 1.3846153846).rgb + texture2D(tSrc, vUv - uDir * 1.3846153846).rgb) * 0.3162162162;
  c += (texture2D(tSrc, vUv + uDir * 3.2307692308).rgb + texture2D(tSrc, vUv - uDir * 3.2307692308).rgb) * 0.0702702703;
  gl_FragColor = vec4(c, 1.0);
}`;

export interface PostParams {
  /** screen y (0 bottom … 1 top) the tilt-shift keeps sharp */
  focus: number;
  warm: number;
  vignette: number;
  night: number;
}

export class PostFX {
  private rt: THREE.WebGLRenderTarget;
  private bloomA: THREE.WebGLRenderTarget;
  private bloomB: THREE.WebGLRenderTarget;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quad: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;
  private bright: THREE.ShaderMaterial;
  private blur: THREE.ShaderMaterial;
  private size = new THREE.Vector2();

  constructor() {
    this.rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4, depthBuffer: true });
    this.rt.texture.name = 'ob-post';
    const small = () => new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: false });
    this.bloomA = small();
    this.bloomB = small();
    this.material = new THREE.ShaderMaterial({
      name: 'ob-post',
      uniforms: {
        tScene: { value: this.rt.texture },
        tBloom: { value: this.bloomA.texture },
        uRes: { value: new THREE.Vector2(4, 4) },
        uFocus: { value: 0.42 },
        uBand: { value: 0.15 },
        uBlur: { value: 6 },
        uVignette: { value: 0.35 },
        uWarm: { value: 0.25 },
        uBloom: { value: 0.15 },
        uShadowTint: { value: new THREE.Color('#3b4a66') },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthTest: false,
      depthWrite: false,
    });
    this.bright = new THREE.ShaderMaterial({
      name: 'ob-bloom-bright',
      uniforms: { tSrc: { value: this.rt.texture }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 0.9 } },
      vertexShader: VERT, fragmentShader: BRIGHT, depthTest: false, depthWrite: false,
    });
    this.blur = new THREE.ShaderMaterial({
      name: 'ob-bloom-blur',
      uniforms: { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } },
      vertexShader: VERT, fragmentShader: BLUR, depthTest: false, depthWrite: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
  }

  private pass(gl: THREE.WebGLRenderer, material: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = material;
    gl.setRenderTarget(target);
    gl.render(this.scene, this.camera);
  }

  render(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, params: PostParams) {
    gl.getDrawingBufferSize(this.size);
    if (this.rt.width !== this.size.x || this.rt.height !== this.size.y) {
      this.rt.setSize(this.size.x, this.size.y);
      const bw = Math.max(4, Math.round(this.size.x / 4)), bh = Math.max(4, Math.round(this.size.y / 4));
      this.bloomA.setSize(bw, bh);
      this.bloomB.setSize(bw, bh);
      this.material.uniforms.uRes.value.copy(this.size);
      this.bright.uniforms.uTexel.value.set(1 / this.size.x, 1 / this.size.y);
    }
    const u = this.material.uniforms;
    u.uBlur.value = 4.5 * gl.getPixelRatio();
    u.uFocus.value = params.focus;
    u.uWarm.value = params.warm;
    u.uVignette.value = params.vignette;
    u.uBloom.value = 0.15 + 0.5 * params.night;
    gl.setRenderTarget(this.rt);
    gl.render(scene, camera);
    // bloom: bright pass at 1/4 res, then a horizontal + a vertical 9-tap blur
    this.pass(gl, this.bright, this.bloomA);
    this.blur.uniforms.tSrc.value = this.bloomA.texture;
    this.blur.uniforms.uDir.value.set(1.25 / this.bloomA.width, 0);
    this.pass(gl, this.blur, this.bloomB);
    this.blur.uniforms.tSrc.value = this.bloomB.texture;
    this.blur.uniforms.uDir.value.set(0, 1.25 / this.bloomA.height);
    this.pass(gl, this.blur, this.bloomA);
    this.pass(gl, this.material, null);
  }

  dispose() {
    this.rt.dispose();
    this.bloomA.dispose();
    this.bloomB.dispose();
    this.material.dispose();
    this.bright.dispose();
    this.blur.dispose();
    this.quad.geometry.dispose();
  }
}
