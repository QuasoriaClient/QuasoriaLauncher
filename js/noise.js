/* Tiny seeded RNG + value-noise fBm used by the cosmos background and the thumbnails. */
(() => {
  "use strict";

  function hashString(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // mulberry32
  function rng(seed) {
    let a = typeof seed === "string" ? hashString(seed) : seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeNoise(seed) {
    const r = rng(seed);
    const perm = new Uint8Array(512);
    const vals = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      perm[i] = i;
      vals[i] = r();
    }
    for (let i = 255; i > 0; i--) {
      const j = (r() * (i + 1)) | 0;
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
    const fade = (t) => t * t * (3 - 2 * t);
    function noise(x, y) {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = x - xi, yf = y - yi;
      const X = xi & 255, Y = yi & 255;
      const a = vals[perm[perm[X] + Y]];
      const b = vals[perm[perm[X + 1] + Y]];
      const c = vals[perm[perm[X] + Y + 1]];
      const d = vals[perm[perm[X + 1] + Y + 1]];
      const u = fade(xf), v = fade(yf);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    }
    function fbm(x, y, oct = 5) {
      let sum = 0, amp = 0.5, f = 1, norm = 0;
      for (let i = 0; i < oct; i++) {
        sum += amp * noise(x * f, y * f);
        norm += amp;
        amp *= 0.5;
        f *= 2.03;
      }
      return sum / norm;
    }
    return { noise, fbm };
  }

  /**
   * Paint a nebula cloud into a small canvas (cheap), to be drawn scaled up.
   * palette: array of [r,g,b] stops from dark -> bright.
   */
  function nebulaCanvas({ w, h, seed, palette, scale = 3, warp = 1.2, density = 1, falloff = 0.9, ox = 0.5, oy = 0.5 }) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    const img = ctx.createImageData(w, h);
    const { fbm } = makeNoise(seed);
    const n = palette.length - 1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const nx = (x / w) * scale, ny = (y / h) * scale * (h / w);
        // domain warp => filaments
        const wx = fbm(nx + 3.1, ny + 1.7, 4) * warp;
        const wy = fbm(nx - 2.3, ny + 4.2, 4) * warp;
        let v = fbm(nx + wx, ny + wy, 5);
        // radial falloff so clouds sit in the frame
        const dx = x / w - ox, dy = (y / h - oy) * (h / w);
        const r = Math.sqrt(dx * dx + dy * dy) * 2;
        v = v * density - r * falloff * 0.5;
        v = Math.max(0, Math.min(1, (v - 0.28) * 2.2));
        const t = v * n;
        const i0 = Math.min(n - 1, Math.floor(t));
        const f = t - i0;
        const p0 = palette[i0], p1 = palette[i0 + 1];
        const k = (y * w + x) * 4;
        img.data[k] = p0[0] + (p1[0] - p0[0]) * f;
        img.data[k + 1] = p0[1] + (p1[1] - p0[1]) * f;
        img.data[k + 2] = p0[2] + (p1[2] - p0[2]) * f;
        img.data[k + 3] = Math.min(255, v * 330);
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  window.QNoise = { rng, hashString, makeNoise, nebulaCanvas };
})();
