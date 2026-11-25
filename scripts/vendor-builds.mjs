#!/usr/bin/env node
/**
 * Quasoria build vendoring.
 *
 * Reads the mirror index written by build-catalog.mjs (data/mirrors.json), picks ONE
 * copy of every build (JavaScript if there is one, since it runs in every browser; then
 * the smallest file; ties broken by source priority),
 * copies it into builds/<id>/ and writes data/catalog.js pointing only at those
 * local copies. The website never fetches games from anywhere else.
 *
 *   node scripts/vendor-builds.mjs                 # download everything missing
 *   node scripts/vendor-builds.mjs --plan          # just print what would be stored
 *   node scripts/vendor-builds.mjs --only=release,beta   # limit to some families
 *   node scripts/vendor-builds.mjs --catalog       # only rewrite data/catalog.js
 *   node scripts/vendor-builds.mjs --catalog --patch   # re-apply PATCHES to stored builds
 *
 * Files are pulled with partial git clones from github.com (only the blobs that are
 * needed), so it works without raw.githubusercontent.com or GitHub Pages access.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, cpSync, statSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BUILDS = join(ROOT, "builds");
const TMP = process.env.QUASORIA_TMP || "/tmp/quasoria-vendor";
const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n) => (args.find((a) => a.startsWith(`--${n}=`)) || "").split("=")[1];

const M = JSON.parse(readFileSync(join(ROOT, "data/mirrors.json"), "utf8"));
const SRC = Object.fromEntries(M.sources.map((s, i) => [s.id, { ...s, prio: i }]));

/* ---------------------------------------------------------------- choose */
// Mirror URL -> { repo, branch, path, dir }
function locate(m) {
  const src = SRC[m.s];
  if (m.k === "page") {
    const rest = decodeURIComponent(m.u.slice(src.pages.length));
    const dir = rest.endsWith("/");
    return { repo: src.repo, path: dir ? rest.slice(0, -1) : rest, dir };
  }
  const u = new URL(m.u);
  const [, , , branch, ...p] = u.pathname.split("/");
  return { repo: src.repo, branch, path: decodeURIComponent(p.join("/")), dir: false };
}

const plan = [];
for (const e of M.entries) {
  // JS first: WASM builds need WASM-GC (and some need JSPI), which older browsers lack
  let best = null;
  const rts = e.runtimes.js?.length ? ["js"] : Object.keys(e.runtimes);
  for (const rt of rts) {
    for (const m of e.runtimes[rt]) {
      const cand = { rt, m, prio: SRC[m.s].prio };
      if (!best || m.b < best.m.b || (m.b === best.m.b && cand.prio < best.prio)) best = cand;
    }
  }
  const others = Object.values(e.runtimes).flat().map((m) => m.s);
  plan.push({
    id: e.id,
    family: e.family,
    rt: best.rt,
    size: best.m.b,
    from: best.m.s,
    alsoIn: [...new Set(others)].filter((s) => s !== best.m.s),
    loc: locate(best.m),
    entry: e,
  });
}

const only = opt("only") ? new Set(opt("only").split(",")) : null;
const todo = plan.filter((p) => !only || only.has(p.family));

const GB = (b) => (b / 1e9).toFixed(2) + " GB";
if (flag("plan")) {
  for (const p of todo) console.log(`${p.family.padEnd(10)} ${p.id.padEnd(40)} ${p.rt.padEnd(4)} ${(p.size / 1e6).toFixed(1).padStart(6)} MB  ${p.from}:${p.loc.path}`);
  console.log(`\n${todo.length} builds, ${GB(todo.reduce((n, p) => n + p.size, 0))}`);
  process.exit(0);
}

/* ---------------------------------------------------------------- patches */
// Small, surgical edits so stored builds never call out to other hosts. Each rule only
// touches a <script> tag that loads analytics or a CDN copy of a dev tool.
const PATCHES = [
  {
    name: "strip Cloudflare analytics beacon",
    re: /<script[^>]*static\.cloudflareinsights\.com\/beacon[^>]*>\s*<\/script>/g,
    to: "",
  },
  { name: "strip GA4 analytics script", re: /<script src="\/js\/ga4\.js"><\/script>/g, to: "" },
  {
    name: "use local eruda (debug console) instead of jsDelivr",
    re: /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/eruda"><\/script>/g,
    to: '<script src="../../assets/vendor/eruda.js"></script>',
  },
];
function patchBuild(dir) {
  const f = join(dir, "index.html");
  let html = readFileSync(f, "latin1"); // latin1 round-trips arbitrary bytes unchanged
  const applied = [];
  for (const p of PATCHES) {
    const next = html.replace(p.re, p.to);
    if (next !== html) applied.push(p.name);
    html = next;
  }
  if (applied.length) writeFileSync(f, html, "latin1");
  return applied;
}

/* ---------------------------------------------------------------- download */
const sh = (cmd, a, o = {}) => execFileSync(cmd, a, { stdio: ["ignore", "pipe", "inherit"], maxBuffer: 1 << 26, ...o })?.toString() ?? "";
const dirSize = (d) => readdirSync(d, { withFileTypes: true }).reduce((n, f) => n + (f.isDirectory() ? dirSize(join(d, f.name)) : statSync(join(d, f.name)).size), 0);
function isDone(p) {
  const f = join(BUILDS, p.id, ".source.json");
  if (!existsSync(join(BUILDS, p.id, "index.html")) || !existsSync(f)) return false;
  const meta = JSON.parse(readFileSync(f, "utf8"));
  return meta.repo === p.loc.repo && meta.path === p.loc.path; // stale if the pick changed
}
// gitignore-style pattern that matches exactly this path
const sparsePattern = (path, dir) => "/" + path.replace(/[\\*?[\]!#]/g, (c) => "\\" + c).replace(/ $/, "\\ ") + (dir ? "/" : "");

if (!flag("catalog")) {
  mkdirSync(BUILDS, { recursive: true });
  mkdirSync(TMP, { recursive: true });
  const byRepo = new Map();
  for (const p of todo) if (!isDone(p)) (byRepo.get(p.loc.repo) || byRepo.set(p.loc.repo, []).get(p.loc.repo)).push(p);

  for (const [repo, items] of byRepo) {
    const dest = join(TMP, repo.replace("/", "_"));
    const env = { ...process.env, GIT_LFS_SKIP_SMUDGE: "1", GIT_TERMINAL_PROMPT: "0" };
    if (!existsSync(join(dest, ".git"))) {
      console.log(`clone ${repo} (tree only)`);
      sh("git", ["-c", "gc.auto=0", "-c", "maintenance.auto=false", "clone", "-q", "--depth=1", "--filter=blob:none", "--no-checkout", `https://github.com/${repo}.git`, dest], { env });
    }
    // sparse checkout of only the paths we need: git prefetches all missing blobs in one batch
    const mb = items.reduce((n, p) => n + p.size, 0);
    console.log(`fetch ${items.length} builds from ${repo} (${GB(mb)})`);
    const git = (...a) => sh("git", ["-C", dest, "-c", "gc.auto=0", "-c", "maintenance.auto=false", ...a], { env, stdio: ["pipe", "inherit", "inherit"] });
    git("sparse-checkout", "init", "--no-cone");
    sh("git", ["-C", dest, "sparse-checkout", "set", "--no-cone", "--stdin"], {
      env,
      input: items.map((p) => sparsePattern(p.loc.path, p.loc.dir)).join("\n") + "\n",
      stdio: ["pipe", "inherit", "inherit"],
    });
    git("checkout", "-q", "HEAD");
    for (const p of items) {
      const src = join(dest, p.loc.path);
      const out = join(BUILDS, p.id);
      rmSync(out, { recursive: true, force: true });
      mkdirSync(out, { recursive: true });
      if (p.loc.dir) cpSync(src, out, { recursive: true });
      else cpSync(src, join(out, "index.html"));
      // refuse Git LFS pointers: they are tiny text stubs, not games
      const head = readFileSync(join(out, "index.html")).subarray(0, 64).toString();
      if (head.startsWith("version https://git-lfs")) throw new Error(`${p.id}: LFS pointer`);
      const patched = patchBuild(out);
      writeFileSync(join(out, ".source.json"), JSON.stringify({ repo: p.loc.repo, path: p.loc.path, source: p.from, runtime: p.rt, patched }, null, 2) + "\n");
      console.log(`  ✓ ${p.id}  ${(dirSize(out) / 1e6).toFixed(1)} MB`);
    }
    rmSync(dest, { recursive: true, force: true }); // free disk as we go
  }
}

// --patch: re-apply patches to builds that are already stored
if (flag("patch")) {
  for (const p of plan) {
    if (!isDone(p)) continue;
    const dir = join(BUILDS, p.id);
    const applied = patchBuild(dir);
    if (!applied.length) continue;
    const metaFile = join(dir, ".source.json");
    const meta = JSON.parse(readFileSync(metaFile, "utf8"));
    meta.patched = [...new Set([...(meta.patched || []), ...applied])];
    writeFileSync(metaFile, JSON.stringify(meta, null, 2) + "\n");
    console.log(`  patched ${p.id}: ${applied.join("; ")}`);
  }
}

/* ---------------------------------------------------------------- catalog */
// Archive file names are not always right about the runtime, so trust the build's own
// <title> ("... WASM-GC", "... JS") when it says.
function sniffRuntime(dir, fallback) {
  const head = readFileSync(join(dir, "index.html")).subarray(0, 300000).toString("latin1");
  const t = (head.match(/<title>([^<]{0,120})/i) || [])[1] || "";
  if (/WASM/.test(t)) return "wasm";
  if (/\bJS\b/.test(t)) return "js";
  return fallback;
}

const entries = [];
for (const p of plan) {
  if (!isDone(p)) continue;
  const { runtimes, ...rest } = p.entry;
  entries.push({
    ...rest,
    rt: sniffRuntime(join(BUILDS, p.id), p.rt),
    path: `builds/${p.id}/`,
    size: dirSize(join(BUILDS, p.id)),
    from: p.from,
    also: p.alsoIn,
  });
}
const out = {
  generated: new Date().toISOString().slice(0, 10),
  sources: M.sources,
  stats: { files: M.stats.files, entries: entries.length, bytes: entries.reduce((n, e) => n + e.size, 0) },
  entries,
};
writeFileSync(
  join(ROOT, "data/catalog.js"),
  `/* Generated by scripts/vendor-builds.mjs on ${out.generated}. Do not edit by hand.\n   Every build listed here is stored in builds/<id>/ in this repository. */\nwindow.QUASORIA_CATALOG = ${JSON.stringify(out)};\n`,
);
console.log(`\ncatalog: ${entries.length}/${plan.length} builds stored locally, ${GB(out.stats.bytes)}`);
