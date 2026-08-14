/* Shared Desk liquid glass — PATH A port. Archive proto uses this; resume keeps its inline copy. */
/* Liquid glass layer — port of sdegenaar/liquid_glass_widgets lightweight_glass.frag PATH A
   (MIT). One shared wallpaper + one shader pass for every platter. Do not nest glass. */
(() => {
  const wall = document.getElementById('wall');
  const lg = document.getElementById('lg');
  const reducedT = matchMedia('(prefers-reduced-transparency: reduce)').matches;
  if (reducedT) { document.body.classList.add('no-gl'); return; }

  const w2d = wall.getContext('2d');
  const gl = lg.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: true });
  if (!gl) { document.body.classList.add('no-gl'); return; }

  const VS = `
    attribute vec2 a_pos;
    void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }
  `;
  const FS = `
    precision highp float;
    uniform vec2 u_canvas;      // css size
    uniform float u_dpr;
    uniform vec4 u_rect;        // css x,y,w,h
    uniform float u_radius;
    uniform float u_thickness;
    uniform vec2 u_light;
    uniform float u_glow;
    uniform float u_density;
    uniform sampler2D u_bg;

    const vec3 LUMA = vec3(0.299, 0.587, 0.114);
    const vec4 uGlassColor = vec4(1.0, 1.0, 1.0, 0.12);
    const float uLightIntensity = 0.7;
    const float uAmbient = 0.4;
    const float uSaturation = 1.2;
    const float uIOR = 0.15;
    const float uCA = 0.06;
    const float uBackdropLuma = 0.85;

    vec3 applyGlassColor(vec3 liquidColor, vec4 glassColor) {
      float backdropLuminance = dot(liquidColor, LUMA);
      float glassLuminance = dot(glassColor.rgb, LUMA);
      vec3 tinted = clamp(glassColor.rgb + (backdropLuminance - glassLuminance), 0.0, 1.0);
      float chroma = max(max(glassColor.r, glassColor.g), glassColor.b)
                   - min(min(glassColor.r, glassColor.g), glassColor.b);
      float chromaWeight = clamp(chroma * 8.0, 0.0, 1.0);
      vec3 directMix = mix(liquidColor, glassColor.rgb, glassColor.a);
      vec3 luminosityMix = mix(liquidColor, tinted, glassColor.a);
      return mix(directMix, luminosityMix, chromaWeight);
    }

    void main() {
      vec2 css = vec2(gl_FragCoord.x, u_canvas.y * u_dpr - gl_FragCoord.y) / u_dpr;
      vec2 halfSize = u_rect.zw * 0.5;
      vec2 p = css - (u_rect.xy + halfSize);
      float r = min(u_radius, min(halfSize.x, halfSize.y));
      vec2 q = abs(p) - halfSize + r;
      vec2 maxQ = max(q, 0.0);
      float maxQLen = length(maxQ);
      float dist = maxQLen + min(max(q.x, q.y), 0.0) - r;
      float smoothing = 1.0;
      float mask = 1.0 - smoothstep(-smoothing, smoothing, dist);
      if (mask <= 0.001) discard;

      bool isEdge = maxQLen > 0.01;
      vec2 surfaceNormal = isEdge ? (sign(p) * maxQ / maxQLen) : vec2(0.0);
      float normalZ = sqrt(max(0.0, 1.0 - dot(surfaceNormal, surfaceNormal)));

      float borderMask = 1.0 - smoothstep(0.0, smoothing, abs(dist) - 0.5);
      float thicknessNorm = u_thickness / 10.0;
      float densitySpecularBoost = (1.0 + (thicknessNorm - 1.0) * 0.15) * (1.0 + u_density * 0.2);

      vec2 anisoN = isEdge
        ? (surfaceNormal + vec2(-surfaceNormal.y, surfaceNormal.x) * 0.2) * 0.9805806
        : vec2(0.0);
      float lightCatch = max(dot(anisoN, u_light), 0.0);
      float kickCatch = max(dot(anisoN, -u_light), 0.0);
      float lc2 = lightCatch * lightCatch; float lc4 = lc2 * lc2; float lc8 = lc4 * lc4;
      float keySpecular = lc8 * lc8;
      float kc2 = kickCatch * kickCatch; float kc4 = kc2 * kc2; float kc8 = kc4 * kc4;
      float kickSpecular = kc8 * kc8;
      keySpecular *= uLightIntensity * densitySpecularBoost;
      kickSpecular *= uLightIntensity * 0.4 * densitySpecularBoost;
      float totalSpecular = keySpecular + kickSpecular;

      float thicknessOffset = (u_thickness - 10.0) / 10.0;
      float rimFade = 1.0 - smoothstep(0.3, 0.5, uBackdropLuma) * 0.92;
      float rimAlphaBase = 0.65 * rimFade;
      rimAlphaBase *= uIOR;
      rimAlphaBase += totalSpecular * 0.5 * rimFade;
      rimAlphaBase *= (1.0 + thicknessOffset * 0.15) * (1.0 + u_density * 0.1);
      rimAlphaBase *= borderMask;
      rimAlphaBase = clamp(rimAlphaBase, 0.0, 1.0);

      float fresnel = (1.0 - normalZ) * borderMask * 0.10 * mix(1.2, 0.8, uBackdropLuma);

      vec2 uv = gl_FragCoord.xy / (u_canvas * u_dpr);
      float distFromEdge = abs(dist);
      float edgeInfluence = smoothstep(10.0, 0.0, distFromEdge);
      edgeInfluence *= edgeInfluence;
      vec2 edgeOffset = surfaceNormal * edgeInfluence * u_thickness * 0.5;
      vec2 texOffset = vec2(edgeOffset.x, -edgeOffset.y) / u_canvas;
      vec2 refractedUV = uv + texOffset;
      vec2 ca = vec2(surfaceNormal.x, -surfaceNormal.y) * uCA * edgeInfluence / u_canvas;
      float rC = texture2D(u_bg, refractedUV + ca).r;
      float gC = texture2D(u_bg, refractedUV).g;
      float bC = texture2D(u_bg, refractedUV - ca).b;
      vec3 bgRgb = vec3(rC, gC, bC);
      float bgLuminance = dot(bgRgb, LUMA);
      vec3 saturatedBg = mix(vec3(bgLuminance), bgRgb, uSaturation);
      float vertCoord = (css.y - u_rect.y) / max(u_rect.w, 1.0);
      float bottomDarken = vertCoord * 0.04;
      float ambientDarken = clamp((uAmbient * 0.25 + 0.08) * (1.0 + u_density * 0.5) + bottomDarken, 0.0, 0.8);
      ambientDarken *= 0.2;
      vec3 darkenedBg = saturatedBg * (1.0 - ambientDarken);
      vec3 bodyColor = applyGlassColor(darkenedBg, uGlassColor);
      vec3 adaptiveRimColor = mix(bgRgb, vec3(1.0), 0.7);
      vec3 finalColor = bodyColor * (1.0 - rimAlphaBase) + adaptiveRimColor * rimAlphaBase;
      finalColor += vec3(u_glow * 0.3);
      finalColor = clamp(finalColor + vec3(fresnel), 0.0, 1.0);
      gl_FragColor = vec4(finalColor, mask);
    }
  `;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn(gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }
  const vs = compile(gl.VERTEX_SHADER, VS);
  const fs = compile(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) { document.body.classList.add('no-gl'); return; }
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { document.body.classList.add('no-gl'); return; }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  const loc = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = {};
  for (const name of ['u_canvas','u_dpr','u_rect','u_radius','u_thickness','u_light','u_glow','u_density','u_bg']) {
    U[name] = gl.getUniformLocation(prog, name);
  }
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.uniform1i(U.u_bg, 0);

  const blobs = [
    { x: 0.18, y: 0.22, r: 0.28, c: 'rgba(196,245,71,.42)' },
    { x: 0.82, y: 0.18, r: 0.22, c: 'rgba(36,122,77,.22)' },
    { x: 0.55, y: 0.72, r: 0.34, c: 'rgba(216,240,138,.38)' },
    { x: 0.12, y: 0.78, r: 0.20, c: 'rgba(154,212,160,.30)' },
  ];

  let light = { x: Math.cos(2.356), y: Math.sin(2.356) };
  let dpr = 1, cssW = 1, cssH = 1;

  function paintWall() {
    const w = wall.width, h = wall.height;
    const g = w2d.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#f7f4ec');
    g.addColorStop(1, '#efe8d8');
    w2d.fillStyle = g;
    w2d.fillRect(0, 0, w, h);
    blobs.forEach((b) => {
      const x = b.x * w, y = b.y * h, rad = b.r * Math.min(w, h);
      const rg = w2d.createRadialGradient(x, y, 0, x, y, rad);
      rg.addColorStop(0, b.c);
      rg.addColorStop(1, 'rgba(247,244,236,0)');
      w2d.fillStyle = rg;
      w2d.beginPath(); w2d.arc(x, y, rad, 0, Math.PI * 2); w2d.fill();
    });
    w2d.fillStyle = 'rgba(20,58,46,0.18)';
    const step = 22 * dpr;
    const rad = 1.15 * dpr;
    for (let y = 11 * dpr; y < h; y += step) {
      for (let x = 11 * dpr; x < w; x += step) {
        w2d.beginPath();
        w2d.arc(x, y, rad, 0, Math.PI * 2);
        w2d.fill();
      }
    }
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, wall);
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cssW = innerWidth; cssH = innerHeight;
    for (const c of [wall, lg]) {
      c.width = Math.floor(cssW * dpr);
      c.height = Math.floor(cssH * dpr);
      c.style.width = cssW + 'px';
      c.style.height = cssH + 'px';
    }
    gl.viewport(0, 0, lg.width, lg.height);
    paintWall();
    draw();
  }

  function quad(x, y, w, h) {
    const pad = 3;
    const l = ((x - pad) / cssW) * 2 - 1;
    const r = ((x + w + pad) / cssW) * 2 - 1;
    const t = 1 - ((y - pad) / cssH) * 2;
    const b = 1 - ((y + h + pad) / cssH) * 2;
    return new Float32Array([l, t, r, t, l, b, r, b]);
  }

  function draw() {
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform2f(U.u_canvas, cssW, cssH);
    gl.uniform1f(U.u_dpr, dpr);
    gl.uniform2f(U.u_light, light.x, light.y);
    document.querySelectorAll('[data-glass]').forEach((el) => {
      if (!el.offsetParent && el.getClientRects().length === 0) return;
      const screen = el.closest('.screen');
      if (screen && !screen.classList.contains('on')) return;
      const b = el.getBoundingClientRect();
      if (b.width < 2 || b.height < 2) return;
      const kind = el.getAttribute('data-glass');
      let radius = parseFloat(el.dataset.radius || '') || (kind === 'orb' || kind === 'chip' || kind === 'bar' ? 999 : kind === 'btn' ? 22 : 28);
      if (radius >= 999) radius = Math.min(b.width, b.height) / 2;
      const thickness = parseFloat(el.dataset.thickness || '30');
      const density = parseFloat(el.dataset.density || (kind === 'orb' || kind === 'btn' ? '1' : '0'));
      const glow = el.classList.contains('hot') ? 0.85 : parseFloat(el.dataset.glow || '0');
      gl.bufferData(gl.ARRAY_BUFFER, quad(b.left, b.top, b.width, b.height), gl.STREAM_DRAW);
      gl.uniform4f(U.u_rect, b.left, b.top, b.width, b.height);
      gl.uniform1f(U.u_radius, radius);
      gl.uniform1f(U.u_thickness, thickness);
      gl.uniform1f(U.u_glow, glow);
      gl.uniform1f(U.u_density, density);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    });
  }

  window.deskGlass = { draw, resize };
  addEventListener('resize', resize);
  addEventListener('scroll', draw, true);
  addEventListener('pointermove', (e) => {
    const nx = e.clientX / cssW - 0.5;
    const ny = e.clientY / cssH - 0.5;
    const a = 2.356 + nx * 0.45;
    light.x = Math.cos(a);
    light.y = Math.sin(a) + ny * 0.15;
    draw();
  }, { passive: true });
  new ResizeObserver(() => draw()).observe(document.getElementById('phone'));
  resize();
})();
