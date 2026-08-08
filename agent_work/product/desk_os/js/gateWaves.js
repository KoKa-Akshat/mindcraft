/** Gate aurora · calm layered waves that billow without mixing */

/**
 * Lightweight value field from stacked sines (no deps)
 * @param {number} x
 * @param {number} y
 * @param {number} t
 */
function field(x, y, t) {
  return (
    Math.sin(x * 0.9 + t * 0.21) * 0.42
    + Math.sin(y * 1.15 - t * 0.17) * 0.34
    + Math.sin((x + y) * 0.55 + t * 0.11) * 0.28
    + Math.sin(x * 2.1 - y * 1.4 + t * 0.08) * 0.18
  );
}

/**
 * @param {HTMLCanvasElement | null} canvas
 * @returns {() => void}
 */
export function startGateWaves(canvas) {
  if (!canvas || typeof canvas.getContext !== 'function') return () => {};

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return () => {};

  let w = 0;
  let h = 0;
  let dpr = 1;
  let raf = 0;
  const t0 = performance.now();
  let running = true;

  const layers = [
    { yBase: 0.18, amp: 0.14, hue: '#061018', alpha: 0.95, speed: 0.11, dens: 72, thick: 1.15 },
    { yBase: 0.42, amp: 0.18, hue: '#0a2438', alpha: 0.72, speed: 0.16, dens: 64, thick: 1.05 },
    { yBase: 0.55, amp: 0.16, hue: '#123a58', alpha: 0.55, speed: 0.13, dens: 56, thick: 0.95 },
    { yBase: 0.62, amp: 0.12, hue: '#1e6a8c', alpha: 0.38, speed: 0.19, dens: 48, thick: 0.85 },
    { yBase: 0.48, amp: 0.10, hue: '#7eb8d6', alpha: 0.16, speed: 0.09, dens: 36, thick: 0.7 },
  ];

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.max(1, Math.floor(rect.width));
    h = Math.max(1, Math.floor(rect.height));
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function paintBase() {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#04080e');
    g.addColorStop(0.35, '#07131d');
    g.addColorStop(0.55, '#0c2740');
    g.addColorStop(0.72, '#153a55');
    g.addColorStop(1, '#060c14');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    const radial = ctx.createRadialGradient(
      w * 0.5, h * 0.42, h * 0.02,
      w * 0.5, h * 0.48, h * 0.55,
    );
    radial.addColorStop(0, 'rgba(190, 230, 255, 0.28)');
    radial.addColorStop(0.35, 'rgba(90, 160, 210, 0.14)');
    radial.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, w, h);
  }

  function paintLayer(layer, time) {
    const cols = Math.max(24, Math.floor(w / 14));
    ctx.save();
    ctx.globalAlpha = layer.alpha;
    ctx.strokeStyle = layer.hue;
    ctx.lineWidth = layer.thick;
    ctx.lineCap = 'round';

    for (let i = 0; i < layer.dens; i += 1) {
      const across = i / (layer.dens - 1 || 1);
      // Keep left/right masses separate · denser toward edges
      const edgeBias = Math.pow(Math.abs(across - 0.5) * 2, 1.35);
      // Deterministic skip in the bright canyon so fibers don't tangle mid-frame
      if (edgeBias < 0.12 && (i % 3) !== 0) continue;

      const x0 = across * w;
      const phase = across * 6.2 + i * 0.07;
      ctx.beginPath();
      let started = false;
      for (let c = 0; c <= cols; c += 1) {
        const u = c / cols;
        const x = x0 + (u - 0.5) * w * 0.08 * (0.35 + edgeBias);
        const n = field(across * 3.2 + u * 1.4, i * 0.04, time * layer.speed + phase);
        // Each fiber stays in its own vertical band
        const y = h * (layer.yBase + edgeBias * 0.22 + n * layer.amp * (0.55 + edgeBias * 0.45));
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function frame(now) {
    if (!running) return;
    const t = (now - t0) / 1000;
    paintBase();

    const left = ctx.createLinearGradient(0, 0, w * 0.42, 0);
    left.addColorStop(0, 'rgba(2, 6, 12, 0.85)');
    left.addColorStop(1, 'rgba(2, 6, 12, 0)');
    ctx.fillStyle = left;
    ctx.fillRect(0, 0, w * 0.42, h);
    const right = ctx.createLinearGradient(w, 0, w * 0.58, 0);
    right.addColorStop(0, 'rgba(2, 6, 12, 0.85)');
    right.addColorStop(1, 'rgba(2, 6, 12, 0)');
    ctx.fillStyle = right;
    ctx.fillRect(w * 0.58, 0, w * 0.42, h);

    for (const layer of layers) {
      paintLayer(layer, reduced ? 0 : t);
    }

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.12;
    const mist = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, h * 0.4);
    mist.addColorStop(0, '#cfefff');
    mist.addColorStop(1, 'transparent');
    ctx.fillStyle = mist;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    if (!reduced) raf = requestAnimationFrame(frame);
  }

  resize();
  frame(performance.now());

  const onResize = () => {
    resize();
    if (reduced) frame(performance.now());
  };
  window.addEventListener('resize', onResize);

  return () => {
    running = false;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', onResize);
  };
}
