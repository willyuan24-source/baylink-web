/**
 * W8-P1 · the city-only GLSL of the shared materials and the sky, out of GameRoot's chunk (lane P; sf-w8-lead.md §3 row P:
 * GameRoot ≤ 255 KB gzip). These blocks run only on what the streamed city draws — district mode never sets their
 * inputs — so they ride with the city's data chunk (`data/sf/cityDataChunk.ts`, fetched in city mode only, awaited
 * before GameRoot's modules evaluate) and `world/cityShaderSlot.ts` hands them to `world/materials.ts` /
 * `world/environment.ts`, which splice them in where they were (the city's programs are byte for byte what they were
 * before the move; district mode compiles the same programs without the never-taken branches: the same pixels).
 *
 *   groundTown        GROUND pattern 9 (the far town of the satellite boards, world/sf/boards.ts) — an `else if` arm
 *   groundStreetGlow  GROUND: the night street glow of the city's main streets (lane C2-9; aInfo.w > 1.05: city ground)
 *   toyFacades        TOY window styles 9 / 10 (the pre-war downtown and Chinatown façades, W7-X: world/recipes/city.ts)
 *   skyPuffs          the sky: the city's day-sky cloud puffs (W7-X; a function before main)
 *   skyCityDay        the sky: the city's day-sky blend (uCityDay is 0 in district mode)
 *   toyCanopy         TOY (W8-K5, lane K): the street trees' leaves (aInfo.x 11) thin round the player (uCanopy.w)
 *
 * The LOOK inside the strings stays lane X's (and the materials' owners'): edit it here. No imports (the data chunk shares
 * no module with GameRoot's graph: tests/opus-bay-sf-budget.test.ts "W5-V3" / "W8-P1").
 */
export const CITY_SHADERS = {
  groundTown: /* glsl */ `  } else if (pat == 9.0) { // far town (the satellite boards, wave 3): blocks of aInfo.z u between streets, one roof tone
    // per block, the grid turned by aInfo.y; the streets glow faintly at night (the flats read as a lit grid)
    vec2 q = obRot(p, vInfo.y) / max(vInfo.z, 4.0);
    vec2 id = floor(q);
    float g = obGrout(q, vec2(0.13)) * (1.0 - obTiny(q));
    float v = mix(0.86, 1.12, obHash(id + 7.7)), h = (obHash(id + 3.1) - 0.5) * 0.12;
    // a quarter of the blocks keep their gardens (a green cast), the streets are grey asphalt
    vec3 roof = vec3(v * (1.0 + h), v, v * (1.0 - h)) * mix(vec3(1.0), vec3(0.84, 0.98, 0.8), step(0.75, obHash(id + 11.3)) * 0.7);
    k = mix(roof, vec3(0.74, 0.75, 0.77), g);
    if (uNight > 0.01) totalEmissiveRadiance += vec3(1.0, 0.64, 0.32) * g * uNight * 0.16;`,
  groundStreetGlow: /* glsl */ `  // night street glow (lane C2-9): city main streets carry their lamp level in aInfo.w (GROUND_CITY + 0.5 … 1), the
  // arc length in aInfo.y and the side (−1 … 1 across the asphalt) in aInfo.z: a warm pool every 9 u on alternate
  // curbs, their mean once the pools shrink below a few pixels (the street reads as a lit ribbon from the hills),
  // fading out within ≈ 45–110 u of the camera, where the real lamps and their light pools take over
  if (pat == 5.0 && vInfo.w > 1.05 && uNight > 0.01) {
    float sq = vInfo.y / 9.0 + (vInfo.z > 0.0 ? 0.0 : 0.5);
    float ds = (fract(sq) - 0.5) * 9.0;
    float unres = smoothstep(0.25, 0.8, fwidth(sq));
    float glow = mix(exp(-ds * ds / 5.0), 0.44, unres) * (0.3 + 0.7 * smoothstep(0.0, 1.0, abs(vInfo.z)));
    float away = smoothstep(45.0, 110.0, distance(vWPos, uCam));
    totalEmissiveRadiance += vec3(1.0, 0.62, 0.3) * glow * (vInfo.w - 1.0) * uNight * away * 0.9;
  }`,
  toyFacades: /* glsl */ `  // W7-X: the streamed city's pre-war downtown (9) and Chinatown (10) façades (world/recipes/city.ts, city mode only; the
  // district never sets these styles). 9: bays of a continuous light pier and a recessed column of paired windows over
  // darker spandrels. 10: walk-up windows with painted iron balcony railings (red / green per building), and on some
  // buildings a black fire escape — platforms, rails and a zig-zag ladder — down one column of the street face
  float obFac = floor(vInfo.x + 0.5);
  if ((obFac == 9.0 || obFac == 10.0) && abs(vWN.y) < 0.4) {
    vec2 tngF = normalize(vec2(-vWN.z, vWN.x) + 1e-5);
    float uF = dot(vWPos.xz, tngF);
    float vF = vWPos.y - vInfo.y;
    float seedF = floor((vInfo.z < 0.0 ? -vInfo.z : obHash(floor(vWPos.xz * 0.08))) * 4096.0 + 0.5) / 4096.0;
    bool pre = obFac == 9.0;
    vec2 cellF = pre ? vec2(1.45, 1.05) : vec2(1.3, 1.2);
    vec2 gF = vec2(uF, vF - (pre ? 0.25 : 0.1)) / cellF;
    vec2 fF = fract(gF);
    vec2 idF = floor(gF);
    vec2 fwF = fwidth(gF);
    vec2 wF = fwF * 0.8 + 1e-4;
    float unresF = smoothstep(0.35, 1.2, max(fwF.x, fwF.y));
    float upper = step(pre ? 1.3 : 1.25, vF);
    #define OB_BAND(a, b, t, w) (smoothstep((a) - (w), (a) + (w), (t)) * (1.0 - smoothstep((b) - (w), (b) + (w), (t))))
    vec3 base = diffuseColor.rgb;
    vec3 glassF = pre ? vec3(0.09, 0.105, 0.12) : vec3(0.11, 0.14, 0.17);
    float winF = 0.0, coverF = 0.0;
    if (pre) {
      // pier 0 … 0.2 lighter, its shadow edge, the recess darker with a spandrel panel under each window pair; two
      // narrow lights 0.3 … 0.84 split by a stone mullion
      float pier = OB_BAND(-0.01, 0.2, fF.x, wF.x);
      float edge = OB_BAND(0.2, 0.25, fF.x, wF.x);
      vec3 facade = mix(base * 0.88, base * 1.08, pier);
      facade = mix(facade, base * 0.68, edge);
      facade = mix(facade, base * 0.78, OB_BAND(0.08, 0.24, fF.y, wF.y) * OB_BAND(0.32, 0.93, fF.x, wF.x)); // the spandrel
      facade = mix(facade, base * 1.06, OB_BAND(0.26, 0.3, fF.y, wF.y) * (1.0 - pier)); // the sill line
      winF = (OB_BAND(0.32, 0.6, fF.x, wF.x) + OB_BAND(0.66, 0.94, fF.x, wF.x)) * OB_BAND(0.32, 0.86, fF.y, wF.y);
      coverF = 0.56 * 0.54;
      diffuseColor.rgb = mix(diffuseColor.rgb, mix(facade, base * 0.95, unresF), upper);
    } else {
      winF = OB_BAND(0.22, 0.78, fF.x, wF.x) * OB_BAND(0.34, 0.88, fF.y, wF.y);
      coverF = 0.56 * 0.54;
    }
    float maskF = mix(winF, coverF, unresF) * upper;
    float hF = obHash(idF + seedF * 97.0);
    vec3 dayF = glassF * (0.8 + 0.5 * hF) + vec3(0.05, 0.06, 0.07) * (1.0 - fF.y);
    dayF = mix(dayF, glassF * 1.1, unresF);
    diffuseColor.rgb = mix(diffuseColor.rgb, dayF, maskF * (1.0 - uNight * 0.6));
    if (!pre) {
      // the balcony (60 % of the upper windows): a slab, a top rail, balusters in the building's railing colour
      float rc = fract(seedF * 5.31);
      vec3 rail = rc < 0.45 ? vec3(0.50, 0.07, 0.05) : rc < 0.9 ? vec3(0.03, 0.22, 0.11) : vec3(0.68, 0.37, 0.05);
      float hasB = step(obHash(idF * 1.3 + seedF * 11.0), 0.6) * step(1.8, vF);
      float band = OB_BAND(0.1, 0.9, fF.x, wF.x) * OB_BAND(0.05, 0.33, fF.y, wF.y);
      float bars = mix(step(0.45, fract(uF * 7.0)), 0.55, smoothstep(0.2, 0.6, fwF.x * 9.1));
      float railM = band * max(max(OB_BAND(0.05, 0.1, fF.y, wF.y), OB_BAND(0.28, 0.33, fF.y, wF.y)), bars);
      // one column in three of every other building carries the fire escape instead (seeded)
      float fe = step(fract(seedF * 3.7), 0.5) * step(abs(mod(idF.x + floor(seedF * 13.0), 3.0)), 0.5) * step(1.8, vF);
      float dir = mod(idF.y, 2.0) < 0.5 ? 1.0 : -1.0;
      float lx = dir > 0.0 ? fF.x : 1.0 - fF.x;
      float ladder = OB_BAND(-0.035, 0.035, fF.y - (0.12 + lx * 0.95), wF.y + 0.01) * OB_BAND(0.12, 0.88, fF.x, wF.x);
      float feM = max(max(OB_BAND(0.03, 0.1, fF.y, wF.y), OB_BAND(0.3, 0.33, fF.y, wF.y) * OB_BAND(0.0, 1.0, fF.x, wF.x)), max(ladder, step(0.93, fract(uF * 2.3)) * OB_BAND(0.03, 0.33, fF.y, wF.y)));
      vec3 iron = vec3(0.035, 0.04, 0.04);
      float feA = fe * mix(feM, 0.35, unresF);
      float railA = (1.0 - fe) * hasB * mix(railM, 0.45 * 0.28, unresF);
      diffuseColor.rgb = mix(diffuseColor.rgb, rail, railA);
      diffuseColor.rgb = mix(diffuseColor.rgb, iron, feA);
      maskF *= 1.0 - max(railA, feA);
    }
    #undef OB_BAND
    // night: the same occupancy and colour temperatures as the other window styles
    float occF = mix(0.4, 0.75, fract(seedF * 7.13));
    float floorOnF = step(0.2, obHash(vec2(idF.y * 1.37, seedF * 53.0)));
    float litF = step(occF, hF) * floorOnF * maskF;
    float hcF = obHash(idF * 1.7 + seedF * 13.0);
    vec3 tempF = hcF < 0.7 ? vec3(1.0, 0.62, 0.3) : hcF < 0.9 ? vec3(1.0, 0.85, 0.65) : vec3(0.55, 0.7, 1.0);
    vec3 litMeanF = vec3(0.955, 0.674, 0.44) * (coverF * upper * (1.0 - occF) * 0.8 * 0.85);
    totalEmissiveRadiance += mix(tempF * litF * (0.5 + 0.7 * obHash(idF * 2.3 + seedF)), litMeanF, unresF) * uNight;
  }`,
  skyPuffs: /* glsl */ `// W7-X (city, by day): toy cloud puffs hung on the dome — a row of cells around the horizon, about one in three holds a
// flat-bottomed cumulus of four round puffs (white top, soft blue-grey belly), drifting slowly east. x = coverage, y = shade
vec2 obPuffs(vec3 d) {
  float el = asin(clamp(d.y, -1.0, 1.0));
  float v = (el - 0.07) / 0.2;
  if (v < 0.0 || v > 2.0) return vec2(0.0);
  float row = floor(v);
  float u = (atan(d.z, d.x) / 6.2832 + 0.5) * 17.0 + uTime * 0.0016 + row * 0.5;
  float cov = 0.0, sh = 1.0;
  for (int i = -1; i <= 1; i++) {
    float cx = floor(u) + float(i);
    vec3 key = vec3(mod(cx, 17.0), row, 0.0);
    float h = h1(key + vec3(0.0, 0.0, 17.0));
    if (h > (row < 0.5 ? 0.42 : 0.26)) continue;
    float s = 0.2 + 0.1 * h1(key + vec3(0.0, 0.0, 8.1)) - row * 0.03;
    vec2 o = vec2(cx + 0.25 + 0.5 * h1(key + vec3(0.0, 0.0, 3.3)), row + 0.35 + 0.2 * h1(key + vec3(0.0, 0.0, 5.7)));
    // local frame in cloud heights (an azimuth cell is ≈ 21°, a row ≈ 11.5°: the aspect keeps the puffs round)
    vec2 q = vec2((u - o.x) * 1.83 * cos(el), v - o.y) / s;
    float w = h1(key + vec3(0.0, 0.0, 9.9));
    float dd = min(min(length(q - vec2(-0.95, -0.05)) - 0.52, length(q - vec2(-0.3, 0.28 + 0.1 * w)) - 0.74),
                   min(length(q - vec2(0.5, 0.12)) - 0.62, length(q - vec2(1.12, -0.08)) - 0.42 - 0.1 * w));
    dd = max(dd, -(q.y + 0.34));
    float aa = fwidth(dd) + 0.02;
    float c = 1.0 - smoothstep(-aa, aa, dd);
    if (c > cov) { cov = c; sh = smoothstep(-0.34, 0.75, q.y); }
  }
  return vec2(cov * smoothstep(0.0, 0.25, v) * 0.96, sh);
}`,
  skyCityDay: /* glsl */ `  if (uCityDay > 0.0 && y > 0.0) {
    // W7-X: the city's day sky — the horizon keeps the haze (= the fog, so far blocks settle into it), a pale blue from a
    // few degrees up and a clear toy blue overhead (the district's palette.ts sky is untouched: uCityDay is 0 there)
    vec3 cs = mix(uHorizon, vec3(0.60, 0.75, 0.86), smoothstep(0.0, 0.13, y));
    cs = mix(cs, vec3(0.17, 0.42, 0.74), pow(smoothstep(0.07, 0.8, y), 0.85));
    vec2 pc = obPuffs(d);
    cs = mix(cs, mix(vec3(0.70, 0.76, 0.84), vec3(0.98, 0.975, 0.96), pc.y), pc.x);
    col = mix(col, cs, uCityDay);
  }`,
  toyCanopy: /* glsl */ `  // W8-K5 (lane K): the street trees' leaves (aInfo.x 11: world/sf/props.ts CANOPY_INFO, the streamed city only) thin
  // to a dither along the camera's last 3.5 u to the player's chest while a canopy hangs over / beside the player
  // (uCanopy.w: CityProps.stepCanopyFade each frame) — the seated Hyde St rider under a kerb tree. Unlike the occlusion
  // fade above there is no L − 1.2 / +0.35 cut-off (the leaves at the rider are the ones in the way); the leaves beside
  // and behind the player stay (a sphere round the chest, tried first, left a bare trunk over a walker)
  if (uCanopy.w > 0.5 && abs(vInfo.x - 11.0) < 0.5) {
    vec3 cd = uCanopy.xyz - uCam;
    float cL = length(cd);
    if (cL > 0.5) {
      vec3 cdir = cd / cL;
      float ct = dot(vWPos - uCam, cdir);
      if (ct > cL - 3.5 && ct < cL + 0.4) {
        float cR = mix(1.0, 2.2, clamp(ct / cL, 0.0, 1.0));
        float cf = 1.0 - smoothstep(cR * 0.55, cR, length(vWPos - (uCam + cdir * ct)));
        if (min(cf, 0.9) > obBayer8(gl_FragCoord.xy)) discard;
      }
    }
  }`,
} as const;

export type CityShaders = { readonly [K in keyof typeof CITY_SHADERS]: string };
