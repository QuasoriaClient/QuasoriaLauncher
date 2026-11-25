/*
 * Procedural celestial thumbnails. Every era is a different kind of cosmic object,
 * and every entry gets its own seeded variation, so all cards look distinct.
 */
(() => {
  "use strict";
  const { rng, nebulaCanvas } = window.QNoise;

  const SECTORS = {
    modern: { name: "Quasars", object: "quasar", hues: [[265, 90], [190, 95]], label: "Modern" },
    release: { name: "Spiral Galaxies", object: "galaxy", hues: [[220, 85], [285, 80]], label: "Release" },
    beta: { name: "Binary Stars", object: "binary", hues: [[200, 90], [35, 95]], label: "Beta" },
    alpha: { name: "Red Giants", object: "giant", hues: [[12, 95], [340, 80]], label: "Alpha" },
    infdev: { name: "Protostars", object: "protostar", hues: [[30, 90], [300, 60]], label: "Infdev" },
    indev: { name: "Protostars", object: "protostar", hues: [[45, 90], [320, 65]], label: "Indev" },
    classic: { name: "Nebulae", object: "nebula", hues: [[170, 85], [320, 85]], label: "Classic" },
    preclassic: { name: "Singularities", object: "singularity", hues: [[25, 100], [260, 70]], label: "Pre-Classic" },
    client: { name: "Constellations", object: "constellation", hues: [[210, 90], [160, 80]], label: "Client" },
    modded: { name: "Supernovae", object: "supernova", hues: [[330, 95], [45, 100]], label: "Modded" },
    misc: { name: "Comets", object: "comet", hues: [[185, 90], [130, 70]], label: "Oddity" },
  };

  const hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;
  const hslToRgb = (h, s, l) => {
    s /= 100; l /= 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
  };
  const palette = (h, s) => [hslToRgb(h, s, 3), hslToRgb(h, s, 20), hslToRgb(h, s, 45), hslToRgb((h + 30) % 360, s, 70), hslToRgb(h, 30, 96)];

  function glow(ctx, x, y, r, color, alpha = 1) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color.replace("ALPHA", alpha));
    g.addColorStop(0.3, color.replace("ALPHA", alpha * 0.45));
    g.addColorStop(1, color.replace("ALPHA", 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function starfield(ctx, w, h, r, n = 70) {
    for (let i = 0; i < n; i++) {
      const a = r() * 0.8 + 0.2;
      ctx.fillStyle = `rgba(255,255,255,${a * r()})`;
      const s = r() < 0.08 ? 1.6 : r() < 0.3 ? 1 : 0.6;
      ctx.fillRect(r() * w, r() * h, s, s);
    }
  }

  function backdrop(ctx, w, h, r, seed, hueA, hueB, strength = 0.9) {
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, hsl(hueA[0], 60, 5));
    bg.addColorStop(1, hsl(hueB[0], 60, 4));
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    starfield(ctx, w, h, r, 60);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = strength;
    const neb = nebulaCanvas({ w: 64, h: 36, seed: seed + "neb", palette: palette(hueA[0], hueA[1]), scale: 2.2 + r() * 1.5, warp: 1.4, falloff: 0.7, ox: 0.3 + r() * 0.4, oy: 0.3 + r() * 0.4 });
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(neb, 0, 0, w, h);
    ctx.globalAlpha = strength * 0.6;
    const neb2 = nebulaCanvas({ w: 48, h: 27, seed: seed + "neb2", palette: palette(hueB[0], hueB[1]), scale: 2 + r() * 2, warp: 1.8, falloff: 1, ox: r(), oy: r() });
    ctx.drawImage(neb2, 0, 0, w, h);
    ctx.restore();
  }

  const DRAW = {
    quasar(ctx, w, h, r, [A, B]) {
      const cx = w * (0.45 + r() * 0.15), cy = h * (0.45 + r() * 0.1), R = h * 0.42;
      const tilt = -0.3 - r() * 0.5, squash = 0.22 + r() * 0.12;
      ctx.globalCompositeOperation = "lighter";
      // jets
      const jx = -Math.sin(tilt), jy = Math.cos(tilt);
      for (const d of [-1, 1]) {
        const lg = ctx.createLinearGradient(cx, cy, cx + jx * R * 2.4 * d, cy + jy * R * 2.4 * d);
        lg.addColorStop(0, hsl(B[0], 100, 85, 0.9));
        lg.addColorStop(0.5, hsl(A[0], 100, 60, 0.25));
        lg.addColorStop(1, hsl(A[0], 100, 50, 0));
        ctx.strokeStyle = lg;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + jx * R * 2.4 * d, cy + jy * R * 2.4 * d);
        ctx.stroke();
        ctx.lineWidth = 8;
        ctx.globalAlpha = 0.25;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      // disk
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(tilt);
      ctx.scale(1, squash);
      for (let i = 0; i < 380; i++) {
        const a = r() * Math.PI * 2;
        const rad = R * (0.2 + Math.pow(r(), 1.6) * 0.85);
        const heat = 1 - rad / R;
        const beam = 0.5 + 0.5 * -Math.cos(a);
        ctx.fillStyle = heat > 0.55 ? `rgba(255,245,230,${0.4 + beam * 0.5})` : hsl(heat > 0.3 ? 20 + B[0] * 0 : A[0], 100, 55 + heat * 40, 0.25 + beam * 0.5);
        ctx.fillRect(Math.cos(a) * rad, Math.sin(a) * rad, 1.4, 1.4 / squash);
      }
      ctx.restore();
      glow(ctx, cx, cy, R * 0.9, `hsla(${A[0]},100%,70%,ALPHA)`, 0.5);
      glow(ctx, cx, cy, R * 0.32, "rgba(255,255,255,ALPHA)", 1);
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
      ctx.fill();
    },

    galaxy(ctx, w, h, r, [A, B]) {
      const cx = w * (0.4 + r() * 0.2), cy = h * (0.42 + r() * 0.16);
      const R = h * (0.45 + r() * 0.12);
      const arms = 2 + ((r() * 2) | 0);
      const tilt = r() * Math.PI, squash = 0.45 + r() * 0.35, twist = 3.2 + r() * 1.8;
      ctx.globalCompositeOperation = "lighter";
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(tilt);
      ctx.scale(1, squash);
      for (let i = 0; i < 1600; i++) {
        const arm = i % arms;
        const t = Math.pow(r(), 0.8);
        const ang = t * twist + (arm / arms) * Math.PI * 2 + (r() - 0.5) * (0.6 - t * 0.3);
        const rad = t * R + (r() - 0.5) * 6;
        const x = Math.cos(ang) * rad, y = Math.sin(ang) * rad;
        const isBlue = r() < 0.5 + t * 0.4;
        ctx.fillStyle = isBlue ? hsl(A[0], 90, 70 + r() * 20, 0.5 * (1 - t * 0.6)) : hsl(B[0], 80, 70, 0.4 * (1 - t));
        const s = r() < 0.03 ? 1.8 : 1;
        ctx.fillRect(x, y, s, s);
      }
      ctx.restore();
      glow(ctx, cx, cy, R * 0.55, `hsla(${(A[0] + 180) % 360},80%,80%,ALPHA)`, 0.45);
      glow(ctx, cx, cy, R * 0.18, "rgba(255,248,230,ALPHA)", 0.95);
    },

    binary(ctx, w, h, r, [A, B]) {
      const cx = w * 0.5, cy = h * 0.5, sep = h * (0.22 + r() * 0.12), ang = r() * Math.PI;
      const ax = cx + Math.cos(ang) * sep, ay = cy + Math.sin(ang) * sep * 0.5;
      const bx = cx - Math.cos(ang) * sep * 0.7, by = cy - Math.sin(ang) * sep * 0.35;
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.ellipse(cx, cy, sep * 1.1, sep * 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      // mass transfer stream
      ctx.strokeStyle = hsl(B[0], 100, 70, 0.35);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(cx, cy - sep * 0.6, ax, ay);
      ctx.stroke();
      glow(ctx, ax, ay, h * 0.32, `hsla(${A[0]},100%,70%,ALPHA)`, 0.7);
      glow(ctx, ax, ay, h * 0.08, "rgba(255,255,255,ALPHA)", 1);
      glow(ctx, bx, by, h * 0.42, `hsla(${B[0]},100%,60%,ALPHA)`, 0.6);
      glow(ctx, bx, by, h * 0.12, "rgba(255,245,220,ALPHA)", 1);
    },

    giant(ctx, w, h, r, [A, B]) {
      const cx = w * (0.55 + r() * 0.2), cy = h * (0.5 + r() * 0.2), R = h * (0.38 + r() * 0.12);
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, cx, cy, R * 2.2, `hsla(${A[0]},100%,55%,ALPHA)`, 0.45);
      ctx.globalCompositeOperation = "source-over";
      const g = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R);
      g.addColorStop(0, hsl(A[0] + 30, 100, 85));
      g.addColorStop(0.5, hsl(A[0] + 10, 100, 58));
      g.addColorStop(1, hsl(A[0], 100, 30));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();
      // granulation
      ctx.globalCompositeOperation = "overlay";
      for (let i = 0; i < 160; i++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * R * 0.95;
        ctx.fillStyle = r() < 0.5 ? "rgba(255,230,180,0.35)" : "rgba(80,0,0,0.3)";
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 1 + r() * 4, 0, Math.PI * 2);
        ctx.fill();
      }
      // planet silhouette
      ctx.globalCompositeOperation = "source-over";
      if (r() < 0.6) {
        ctx.fillStyle = "#05030a";
        ctx.beginPath();
        ctx.arc(cx - R * 1.3, cy + R * 0.2, R * 0.16, 0, Math.PI * 2);
        ctx.fill();
      }
    },

    protostar(ctx, w, h, r, [A, B]) {
      const cx = w * (0.4 + r() * 0.25), cy = h * (0.45 + r() * 0.15);
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, cx, cy, h * 0.7, `hsla(${A[0]},90%,55%,ALPHA)`, 0.55);
      // bipolar outflow
      const ang = r() * Math.PI;
      for (const d of [-1, 1]) {
        const ex = cx + Math.cos(ang) * h * 0.7 * d, ey = cy + Math.sin(ang) * h * 0.7 * d;
        const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, h * 0.35);
        g.addColorStop(0, hsl(B[0], 90, 70, 0.4));
        g.addColorStop(1, hsl(B[0], 90, 50, 0));
        ctx.fillStyle = g;
        ctx.fillRect(ex - h * 0.35, ey - h * 0.35, h * 0.7, h * 0.7);
      }
      glow(ctx, cx, cy, h * 0.12, "rgba(255,250,235,ALPHA)", 1);
      // dark dust lanes
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(3,2,8,0.55)";
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang + Math.PI / 2);
      ctx.beginPath();
      ctx.ellipse(0, 0, h * 0.5, h * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },

    nebula(ctx, w, h, r, [A, B], seed) {
      ctx.globalCompositeOperation = "lighter";
      const neb = nebulaCanvas({ w: 96, h: 54, seed: seed + "core", palette: palette(A[0], A[1]), scale: 2.4, warp: 2.2, density: 1.15, falloff: 0.8 });
      ctx.drawImage(neb, 0, 0, w, h);
      ctx.globalAlpha = 0.7;
      const neb2 = nebulaCanvas({ w: 80, h: 45, seed: seed + "core2", palette: palette(B[0], B[1]), scale: 3, warp: 2, falloff: 1.1, ox: 0.4 + r() * 0.3 });
      ctx.drawImage(neb2, 0, 0, w, h);
      ctx.globalAlpha = 1;
      for (let i = 0; i < 4; i++) glow(ctx, r() * w, r() * h, 6 + r() * 10, "rgba(255,255,255,ALPHA)", 0.9);
    },

    singularity(ctx, w, h, r, [A, B]) {
      const cx = w * 0.5, cy = h * 0.5, R = h * 0.2;
      ctx.globalCompositeOperation = "lighter";
      // lensed disk (top arc) + disk band
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((r() - 0.5) * 0.4);
      for (let i = 0; i < 4; i++) {
        ctx.strokeStyle = hsl(A[0] + i * 6, 100, 65 - i * 6, 0.55 - i * 0.1);
        ctx.lineWidth = 3 - i * 0.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, R * (1.9 + i * 0.35), R * (0.35 + i * 0.05), 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(0, -R * 0.05, R * (1.15 + i * 0.12), R * (1.15 + i * 0.12), 0, Math.PI, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
      glow(ctx, cx, cy, R * 3, `hsla(${A[0]},100%,60%,ALPHA)`, 0.35);
      // event horizon
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,230,200,0.9)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
      // front of disk over the hole
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = hsl(A[0], 100, 70, 0.8);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(cx, cy, R * 1.9, R * 0.35, 0, 0, Math.PI);
      ctx.stroke();
    },

    constellation(ctx, w, h, r, [A, B]) {
      const n = 5 + ((r() * 4) | 0);
      const pts = Array.from({ length: n }, () => [w * (0.12 + r() * 0.76), h * (0.15 + r() * 0.7)]);
      pts.sort((a, b) => a[0] - b[0]);
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = hsl(A[0], 90, 75, 0.45);
      ctx.lineWidth = 1;
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      if (r() < 0.5) {
        const k = 1 + ((r() * (n - 2)) | 0);
        ctx.moveTo(pts[k][0], pts[k][1]);
        ctx.lineTo(w * (0.2 + r() * 0.6), h * (0.1 + r() * 0.8));
      }
      ctx.stroke();
      for (const [x, y] of pts) {
        glow(ctx, x, y, 10 + r() * 10, `hsla(${r() < 0.5 ? A[0] : B[0]},100%,75%,ALPHA)`, 0.8);
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(x, y, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    },

    supernova(ctx, w, h, r, [A, B]) {
      const cx = w * (0.45 + r() * 0.1), cy = h * (0.5 + r() * 0.05), R = h * (0.32 + r() * 0.1);
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, cx, cy, R * 1.8, `hsla(${A[0]},100%,55%,ALPHA)`, 0.4);
      // filaments
      for (let i = 0; i < 260; i++) {
        const a = r() * Math.PI * 2;
        const d0 = R * (0.75 + r() * 0.2), d1 = d0 + R * (0.05 + r() * 0.3);
        ctx.strokeStyle = r() < 0.5 ? hsl(A[0], 100, 65, 0.35) : hsl(B[0], 100, 65, 0.35);
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * d0, cy + Math.sin(a) * d0);
        ctx.lineTo(cx + Math.cos(a) * d1, cy + Math.sin(a) * d1);
        ctx.stroke();
      }
      ctx.strokeStyle = hsl(B[0], 100, 70, 0.6);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.8, 0, Math.PI * 2);
      ctx.stroke();
      glow(ctx, cx, cy, R * 0.25, "rgba(220,240,255,ALPHA)", 1);
    },

    comet(ctx, w, h, r, [A, B]) {
      const hx = w * (0.65 + r() * 0.15), hy = h * (0.3 + r() * 0.3);
      const ang = Math.PI * (0.85 + r() * 0.2);
      const L = w * 0.7;
      ctx.globalCompositeOperation = "lighter";
      for (let k = 0; k < 2; k++) {
        const a = ang + (k ? 0.12 : 0);
        const lg = ctx.createLinearGradient(hx, hy, hx + Math.cos(a) * L, hy + Math.sin(a) * L);
        lg.addColorStop(0, hsl(k ? B[0] : A[0], 100, 80, 0.7));
        lg.addColorStop(1, hsl(k ? B[0] : A[0], 100, 60, 0));
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.moveTo(hx, hy - 3);
        ctx.lineTo(hx + Math.cos(a - 0.08) * L, hy + Math.sin(a - 0.08) * L);
        ctx.lineTo(hx + Math.cos(a + 0.08) * L, hy + Math.sin(a + 0.08) * L);
        ctx.lineTo(hx, hy + 3);
        ctx.fill();
      }
      glow(ctx, hx, hy, h * 0.18, `hsla(${A[0]},100%,80%,ALPHA)`, 0.9);
      glow(ctx, hx, hy, h * 0.05, "rgba(255,255,255,ALPHA)", 1);
    },
  };

  const cache = new Map();

  /** Draw the thumbnail for an entry into the given canvas. */
  function paint(canvas, entry) {
    const w = canvas.width, h = canvas.height;
    const ctx = canvas.getContext("2d");
    const key = entry.id + ":" + w + "x" + h;
    const cached = cache.get(key);
    if (cached) {
      ctx.drawImage(cached, 0, 0);
      return;
    }
    const sector = SECTORS[entry.family] || SECTORS.misc;
    const r = rng(entry.id);
    // jitter hues per entry so two cards in the same era don't match
    const hues = sector.hues.map(([hh, s]) => [(hh + (r() - 0.5) * 40 + 360) % 360, s]);
    backdrop(ctx, w, h, r, entry.id, hues[0], hues[1], sector.object === "nebula" ? 0.5 : 0.85);
    ctx.save();
    DRAW[sector.object](ctx, w, h, r, hues, entry.id);
    ctx.restore();
    // vignette
    const v = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.7);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
    const copy = document.createElement("canvas");
    copy.width = w;
    copy.height = h;
    copy.getContext("2d").drawImage(canvas, 0, 0);
    cache.set(key, copy);
  }

  window.QThumbs = { paint, SECTORS };
})();
