/*
 * Quasoria cosmos: full-screen animated background.
 *  - drifting, breathing nebula clouds (domain-warped fBm)
 *  - three parallax star layers with twinkle
 *  - a quasar: white-hot core, photon ring, tilted accretion disk of orbiting
 *    particles with Doppler beaming, and twin relativistic jets with travelling knots
 *  - the odd shooting star
 * Honors prefers-reduced-motion (single static frame) and pauses when hidden.
 */
(() => {
  "use strict";
  const canvas = document.getElementById("cosmos");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const { rng, nebulaCanvas } = window.QNoise;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const opts = Object.assign({ quasar: true, anchor: "hero" }, window.QUASORIA_COSMOS || {});

  let W = 0, H = 0, DPR = 1;
  let scrollY = 0;
  let mouseX = 0, mouseY = 0, mx = 0, my = 0;

  /* ---------------- nebulae (pre-rendered once, low-res) ---------------- */
  const PALETTES = {
    violet: [[10, 5, 30], [70, 25, 140], [160, 70, 255], [255, 140, 230], [255, 235, 255]],
    teal: [[2, 10, 25], [10, 70, 120], [30, 170, 220], [140, 240, 255], [240, 255, 255]],
    ember: [[20, 4, 10], [120, 20, 60], [240, 80, 90], [255, 170, 110], [255, 240, 210]],
    rose: [[15, 4, 25], [110, 20, 110], [230, 70, 180], [255, 160, 220], [255, 240, 250]],
  };
  const nebulae = [
    { pal: "violet", seed: 11, x: 0.78, y: 0.18, s: 1.25, a: 0.85, drift: 0.012, rot: 0.00004 },
    { pal: "teal", seed: 23, x: 0.12, y: 0.42, s: 1.1, a: 0.55, drift: 0.018, rot: -0.00003 },
    { pal: "rose", seed: 37, x: 0.55, y: 0.95, s: 1.3, a: 0.45, drift: 0.01, rot: 0.00002 },
    { pal: "ember", seed: 51, x: 0.95, y: 0.7, s: 0.9, a: 0.35, drift: 0.02, rot: -0.00005 },
  ].map((n) => ({
    ...n,
    img: nebulaCanvas({ w: 220, h: 160, seed: n.seed, palette: PALETTES[n.pal], scale: 2.6, warp: 1.6, falloff: 1.25 }),
  }));

  /* ---------------- stars ---------------- */
  let stars = [];
  function makeStars() {
    const r = rng(7);
    const count = Math.min(900, Math.floor((W * H) / 2200));
    stars = [];
    for (let i = 0; i < count; i++) {
      const layer = r() < 0.65 ? 0 : r() < 0.75 ? 1 : 2;
      const hue = r();
      stars.push({
        x: r() * W,
        y: r() * H * 1.6,
        z: layer,
        r: [0.5, 0.9, 1.5][layer] * (0.6 + r() * 0.8),
        tw: r() * Math.PI * 2,
        ts: 0.5 + r() * 2,
        c: hue < 0.15 ? "255,200,170" : hue < 0.35 ? "180,210,255" : hue < 0.45 ? "220,190,255" : "255,255,255",
      });
    }
  }

  /* ---------------- quasar ---------------- */
  const disk = [];
  function makeDisk() {
    const r = rng(99);
    disk.length = 0;
    const n = W < 700 ? 650 : 1100;
    for (let i = 0; i < n; i++) {
      // more particles near the inner edge
      const rad = 0.18 + Math.pow(r(), 1.7) * 0.82;
      disk.push({
        a: r() * Math.PI * 2,
        rad,
        speed: 0.35 / Math.pow(rad, 1.5), // keplerian-ish
        size: 0.6 + r() * 1.6,
        jitter: (r() - 0.5) * 0.04,
      });
    }
  }
  const knots = Array.from({ length: 10 }, (_, i) => ({ t: i / 10, s: 0.08 + (i % 3) * 0.03 }));

  function quasarFrame() {
    const anchor = opts.anchor === "hero" ? document.querySelector("[data-quasar-anchor]") : null;
    let cx, cy, R;
    if (anchor) {
      const b = anchor.getBoundingClientRect();
      cx = b.left + b.width / 2;
      cy = b.top + b.height / 2;
      R = Math.min(b.width, b.height) * (W < 700 ? 0.34 : 0.42);
    } else {
      cx = W * 0.8;
      cy = H * 0.25 - scrollY * 0.3;
      R = Math.min(W, H) * 0.22;
    }
    return { cx: cx + mx * 10, cy: cy + my * 8, R };
  }

  function drawQuasar(t) {
    const { cx, cy, R } = quasarFrame();
    if (cy < -R * 4 || cy > H + R * 4) return;
    const tilt = -0.42; // disk rotation
    const squash = 0.28; // disk inclination
    const cos = Math.cos(tilt), sin = Math.sin(tilt);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    // outer halo
    let g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 2.6);
    g.addColorStop(0, "rgba(190,160,255,0.35)");
    g.addColorStop(0.25, "rgba(120,80,255,0.16)");
    g.addColorStop(0.6, "rgba(60,120,255,0.05)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(cx - R * 3, cy - R * 3, R * 6, R * 6);

    // jets (perpendicular to disk)
    const jx = -sin, jy = cos; // unit vector perpendicular to disk major axis
    const flick = 0.85 + Math.sin(t * 0.004) * 0.08 + Math.sin(t * 0.011) * 0.05;
    for (const dir of [-1, 1]) {
      const len = R * (W < 700 ? 2.4 : 3);
      const ex = cx + jx * len * dir, ey = cy + jy * len * dir;
      // beam
      const lg = ctx.createLinearGradient(cx, cy, ex, ey);
      lg.addColorStop(0, `rgba(200,240,255,${0.55 * flick})`);
      lg.addColorStop(0.15, `rgba(120,200,255,${0.32 * flick})`);
      lg.addColorStop(0.6, `rgba(140,90,255,${0.12 * flick})`);
      lg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = lg;
      const wBase = R * 0.03, wEnd = R * 0.2;
      ctx.beginPath();
      ctx.moveTo(cx + jy * wBase, cy - jx * wBase);
      ctx.lineTo(ex + jy * wEnd, ey - jx * wEnd);
      ctx.lineTo(ex - jy * wEnd, ey + jx * wEnd);
      ctx.lineTo(cx - jy * wBase, cy + jx * wBase);
      ctx.closePath();
      ctx.fill();
      // bright spine
      const sg = ctx.createLinearGradient(cx, cy, ex, ey);
      sg.addColorStop(0, `rgba(255,255,255,${0.9 * flick})`);
      sg.addColorStop(0.4, `rgba(170,230,255,${0.35 * flick})`);
      sg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.strokeStyle = sg;
      ctx.lineWidth = Math.max(1, R * 0.018);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      // travelling knots
      for (const k of knots) {
        const p = (k.t + t * 0.00004 * (1 + k.s * 4)) % 1;
        const kx = cx + jx * len * dir * p, ky = cy + jy * len * dir * p;
        const kr = R * (0.04 + p * 0.12);
        const kg = ctx.createRadialGradient(kx, ky, 0, kx, ky, kr);
        kg.addColorStop(0, `rgba(210,240,255,${0.5 * (1 - p)})`);
        kg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = kg;
        ctx.fillRect(kx - kr, ky - kr, kr * 2, kr * 2);
      }
    }

    // accretion disk: back half first, then core, then front half
    const drawDiskHalf = (front) => {
      for (const p of disk) {
        if (!reduce) p.a += p.speed * 0.006;
        const a = p.a;
        const rr = R * (p.rad + p.jitter);
        const lx = Math.cos(a) * rr;
        const ly = Math.sin(a) * rr * squash;
        const isFront = Math.sin(a) > 0;
        if (isFront !== front) continue;
        const x = cx + lx * cos - ly * sin;
        const y = cy + lx * sin + ly * cos;
        // doppler beaming: approaching side (cos a < 0) brighter + bluer
        const beam = 0.55 + 0.45 * -Math.cos(a);
        const heat = 1 - p.rad; // inner = hotter
        const rC = 255;
        const gC = Math.round(150 + 105 * heat);
        const bC = Math.round(150 + 105 * heat * beam + 60 * (1 - beam) * 0);
        const alpha = (0.25 + 0.75 * heat) * beam;
        const hueShift = p.rad > 0.65 ? `255,${110 + 60 * heat | 0},${200 + 55 * beam | 0}` : `${rC},${gC},${bC}`;
        ctx.fillStyle = `rgba(${hueShift},${alpha.toFixed(3)})`;
        const s = p.size * (0.7 + heat);
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
      }
    };
    drawDiskHalf(false);

    // disk glow band
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tilt);
    ctx.scale(1, squash);
    g = ctx.createRadialGradient(0, 0, R * 0.12, 0, 0, R * 1.05);
    g.addColorStop(0, "rgba(255,240,220,0.0)");
    g.addColorStop(0.18, "rgba(255,220,200,0.55)");
    g.addColorStop(0.4, "rgba(255,120,200,0.22)");
    g.addColorStop(0.75, "rgba(120,80,255,0.08)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, R * 1.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // core + photon ring
    const pulse = 1 + Math.sin(t * 0.002) * 0.06;
    g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.42 * pulse);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.15, "rgba(255,250,240,0.95)");
    g.addColorStop(0.35, "rgba(200,220,255,0.45)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.42 * pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,230,210,0.55)";
    ctx.lineWidth = Math.max(1, R * 0.012);
    ctx.beginPath();
    ctx.ellipse(cx, cy, R * 0.17, R * 0.17, 0, 0, Math.PI * 2);
    ctx.stroke();

    drawDiskHalf(true);

    // diffraction spikes
    ctx.globalAlpha = 0.35 * pulse;
    for (const ang of [0, Math.PI / 2]) {
      const lg = ctx.createLinearGradient(cx - R * 1.4 * Math.cos(ang), cy - R * 1.4 * Math.sin(ang), cx + R * 1.4 * Math.cos(ang), cy + R * 1.4 * Math.sin(ang));
      lg.addColorStop(0, "rgba(255,255,255,0)");
      lg.addColorStop(0.5, "rgba(255,255,255,0.9)");
      lg.addColorStop(1, "rgba(255,255,255,0)");
      ctx.strokeStyle = lg;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx - R * 1.4 * Math.cos(ang), cy - R * 1.4 * Math.sin(ang));
      ctx.lineTo(cx + R * 1.4 * Math.cos(ang), cy + R * 1.4 * Math.sin(ang));
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------------- shooting stars ---------------- */
  const meteors = [];
  function maybeMeteor(t) {
    if (reduce || meteors.length > 2 || Math.random() > 0.004) return;
    meteors.push({ x: Math.random() * W, y: Math.random() * H * 0.5, vx: -6 - Math.random() * 6, vy: 2.5 + Math.random() * 3, life: 1, born: t });
  }
  function drawMeteors() {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i];
      m.x += m.vx;
      m.y += m.vy;
      m.life -= 0.012;
      if (m.life <= 0) {
        meteors.splice(i, 1);
        continue;
      }
      const lg = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * 14, m.y - m.vy * 14);
      lg.addColorStop(0, `rgba(255,255,255,${m.life})`);
      lg.addColorStop(1, "rgba(150,200,255,0)");
      ctx.strokeStyle = lg;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(m.x - m.vx * 14, m.y - m.vy * 14);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------------- frame ---------------- */
  function frame(t) {
    mx += (mouseX - mx) * 0.04;
    my += (mouseY - my) * 0.04;

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    // deep space gradient
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#07051a");
    bg.addColorStop(0.5, "#05040f");
    bg.addColorStop(1, "#08041a");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // nebulae
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    for (const n of nebulae) {
      const breathe = reduce ? 1 : 0.85 + Math.sin(t * 0.0003 + n.seed) * 0.15;
      const size = Math.max(W, H) * n.s;
      const x = n.x * W + Math.sin(t * 0.00005 * n.drift * 60 + n.seed) * 40 - mx * 18;
      const y = n.y * H - scrollY * 0.15 + Math.cos(t * 0.00004 * n.drift * 60 + n.seed) * 30 - my * 12;
      ctx.globalAlpha = n.a * breathe;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(reduce ? 0 : t * n.rot);
      ctx.drawImage(n.img, -size / 2, -size * 0.36, size, size * 0.73);
      ctx.restore();
    }
    ctx.restore();

    // stars
    const par = [0.05, 0.12, 0.25];
    for (const s of stars) {
      const tw = reduce ? 0.8 : 0.55 + 0.45 * Math.sin(t * 0.001 * s.ts + s.tw);
      let y = (s.y - scrollY * par[s.z] - my * (s.z + 1) * 3) % (H * 1.6);
      if (y < 0) y += H * 1.6;
      if (y > H) continue;
      const x = s.x - mx * (s.z + 1) * 4;
      ctx.fillStyle = `rgba(${s.c},${tw})`;
      if (s.z === 2) {
        ctx.beginPath();
        ctx.arc(x, y, s.r, 0, Math.PI * 2);
        ctx.fill();
        if (tw > 0.85) {
          ctx.fillStyle = `rgba(${s.c},${(tw - 0.85) * 2})`;
          ctx.fillRect(x - s.r * 3, y - 0.4, s.r * 6, 0.8);
          ctx.fillRect(x - 0.4, y - s.r * 3, 0.8, s.r * 6);
        }
      } else {
        ctx.fillRect(x, y, s.r, s.r);
      }
    }

    if (opts.quasar) drawQuasar(t);
    maybeMeteor(t);
    drawMeteors();

    if (!reduce && !document.hidden) raf = requestAnimationFrame(frame);
  }

  let raf = 0;
  function resize() {
    DPR = Math.min(1.5, window.devicePixelRatio || 1);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    makeStars();
    makeDisk();
    if (reduce) frame(0);
  }

  window.addEventListener("resize", resize);
  window.addEventListener("scroll", () => {
    scrollY = window.scrollY;
    if (reduce) frame(0);
  }, { passive: true });
  window.addEventListener("pointermove", (e) => {
    mouseX = e.clientX / W - 0.5;
    mouseY = e.clientY / H - 0.5;
  }, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && !reduce) {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    }
  });

  resize();
  if (!reduce) raf = requestAnimationFrame(frame);
})();
