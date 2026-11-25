#!/usr/bin/env node
/**
 * Quasoria catalog builder.
 *
 * Pulls the file trees of every source repo from the GitHub API, classifies each
 * build (version / era / runtime / client), merges duplicates across repos into one
 * entry with several mirrors, and writes data/mirrors.json.
 * Then run scripts/vendor-builds.mjs to store the builds and write data/catalog.js.
 *
 *   node scripts/build-catalog.mjs            # uses GITHUB_TOKEN if set
 *   GITHUB_TOKEN=$(gh auth token) node scripts/build-catalog.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/* ------------------------------------------------------------------ sources */
// Order = mirror priority. Pages-hosted sources come first: they load straight from a
// CDN, and multi-file builds only work there.
const SOURCES = [
  {
    id: "gx",
    name: "GX Launcher",
    repo: "XENOTECH-X/GX-Launcher",
    pages: "https://xenotech-x.github.io/GX-Launcher/",
    layout: "folders",
    root: "game/",
    labels: "downloads-data.js",
  },
  {
    id: "gxv1",
    name: "GX Launcher V1",
    repo: "GX-Launcher-V1/GX-Launcher-V1.github.io",
    pages: "https://gx-launcher-v1.github.io/",
    layout: "folders",
    root: "",
  },
  {
    id: "cookering",
    name: "TheCookeringYT/Play",
    repo: "TheCookeringYT/Play",
    pages: "https://thecookeringyt.github.io/play/",
    layout: "files",
  },
  {
    id: "arham",
    name: "UserArham/version",
    repo: "UserArham/version",
    layout: "files",
  },
  {
    id: "milkdromeda",
    name: "MilkdromedaStudios/all-of-eaglercraft",
    repo: "MilkdromedaStudios/all-of-eaglercraft",
    layout: "files",
  },
];

// Files/folders that are not playable game builds.
const SKIP = [
  /^readme/i,
  /^injector/i, // mod injector tool, not a game
  /^minicraft/i, // a different game entirely
  /^resources$/i,
  /^ayuncraft$/i, // folder of helper scripts in GX V1, no game entry point
];

/* ------------------------------------------------------------------ github */
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
async function gh(path) {
  const res = await fetch(`https://api.github.com/${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "quasoria-catalog",
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.json();
}
async function ghRaw(repo, branch, path) {
  const j = await gh(`repos/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`);
  return Buffer.from(j.content, "base64").toString("utf8");
}

const enc = (p) => p.split("/").map(encodeURIComponent).join("/");

/* ------------------------------------------------------------------ collect */
async function collect(src) {
  const meta = await gh(`repos/${src.repo}`);
  const branch = meta.default_branch;
  const tree = await gh(`repos/${src.repo}/git/trees/${branch}?recursive=1`);
  const blobs = tree.tree.filter((t) => t.type === "blob");
  const items = [];

  if (src.layout === "files") {
    for (const b of blobs) {
      if (b.path.includes("/") || !/\.html?$/i.test(b.path)) continue;
      const base = b.path.replace(/\.html?$/i, "");
      if (SKIP.some((r) => r.test(base))) continue;
      if (b.size < 1024) continue; // Git LFS pointer files, not real builds
      items.push({
        source: src.id,
        label: base,
        path: b.path,
        size: b.size,
        sha: b.sha,
        url: src.pages
          ? src.pages + enc(b.path)
          : `https://raw.githubusercontent.com/${src.repo}/${branch}/${enc(b.path)}`,
        kind: src.pages ? "page" : "raw",
      });
    }
  } else {
    // one folder per build, entry = index.html
    let labels = {};
    if (src.labels) {
      const js = await ghRaw(src.repo, branch, src.labels);
      const fn = new Function(js + "\nreturn DOWNLOAD_GROUPS;");
      for (const g of fn()) for (const it of g.items) labels[it.folder] = it.label;
    }
    const folders = new Map();
    for (const b of blobs) {
      if (!b.path.startsWith(src.root)) continue;
      const rest = b.path.slice(src.root.length);
      const parts = rest.split("/");
      if (parts.length < 2) continue;
      const folder = parts[0];
      if (SKIP.some((r) => r.test(folder))) continue;
      const f = folders.get(folder) || { files: [], size: 0 };
      f.files.push({ name: parts.slice(1).join("/"), sha: b.sha, size: b.size });
      f.size += b.size;
      folders.set(folder, f);
    }
    for (const [folder, f] of folders) {
      const entry = f.files.find((x) => x.name === "index.html");
      if (!entry) continue;
      const game = f.files.find((x) => x.name === "game.html");
      const main = game || entry;
      items.push({
        source: src.id,
        label: labels[folder] || folder,
        folder,
        path: src.root + folder + "/",
        size: f.size,
        sha: main.sha,
        url: src.pages + enc(src.root + folder) + "/",
        kind: "page",
      });
    }
  }
  return items;
}

/* ------------------------------------------------------------------ classify */
const FAMILY_ORDER = ["modern", "release", "beta", "alpha", "infdev", "indev", "classic", "preclassic", "client", "modded", "misc"];

// short release numbers that really mean the last patch of that line
const RELEASE_ALIAS = {
  "1.0.0": "1.0",
  "1.7": "1.7.10",
  "1.8": "1.8.8",
  "1.9": "1.9.4",
  "1.12": "1.12.2",
  "1.13": "1.13.2",
  "1.14": "1.14.4",
  "1.15": "1.15.2",
  "1.16": "1.16.5",
  "1.17": "1.17.1",
};

const FORGE_PACKS = ["explore", "lite", "magic", "skyfactory", "tech", "ultimate", "vanilla"];

// Exact relabels for names the rules can't read: "source:label" -> label to classify.
const OVERRIDES = {
  "gx:Beta 1.9 Pre 5": "Beta 1.9 pre5",
  "gx:Beta 1.9 Pre 5 WASM": "Beta 1.9 pre5 WASM",
  "arham:Eaglercraft_Beta_1.9_pre_5": "Beta 1.9 pre5",
  "arham:Eaglercraft_Beta_1.9_pre_5_WASM": "Beta 1.9 pre5 WASM",
  "gx:Beta 1.0.2 WASM": "Beta 1.0.2 WASM",
  "arham:Eaglercraft_Beta_1.0.2": "Beta 1.0.2 WASM",
  "milkdromeda:Eaglercraft 1.17": "Eaglercraft 1.17.1 WASM",
  "milkdromeda:Eaglercraft 1.4.7": "Eaglercraft 1.4.7 WASM",
  "milkdromeda:1.21.11 17 WASM": "Eaglercraft 1.21.11 WASM",
  "milkdromeda:Eaglercraft 1.16 u3": "Eaglercraft 1.16.5",
  "milkdromeda:v1.0.7 JS 1": "Unnamed Client 1.0.7 JS",
  "milkdromeda:v1.0.7 WASM 1": "Unnamed Client 1.0.7 WASM",
  "milkdromeda:clMinceraft I NotMine V6": "Minceraft I NotMine V6",
  "milkdromeda:demon": "Demon Client",
  "milkdromeda:Eaglercraft 26.2 Modded": "Modded 26.2",
  "arham:Novix_26.1.2": "Eaglercraft 26.1.2 WASM",
  "arham:eaglercraft-26.1.2-WASM_Novix": "Eaglercraft 26.1.2 WASM",
  "cookering:eaglercraft-26.1.2-WASM_Novix": "Eaglercraft 26.1.2 WASM",
  "gx:Areo Client (1.12.2-u2)": "Aero Client (1.12.2-u2)",
  "gx:Larp CLient 1.14.4": "Larp Client 1.14.4",
  "gx:Larp CLient 1.12.2": "Larp Client 1.12.2",
  "gx:EB Client OG(1.8.8 u53)": "EB Client OG (1.8.8 u53)",
  "gx:4K": "Minecraft 4K",
  "arham:mc4k": "Minecraft 4K",
  "cookering:Eaglercraft-4k-JS": "Minecraft 4K",
  "arham:Eaglercraft-4k-JS": "Minecraft 4K",
  "gxv1:Wrust Client": "Wurst Client",
  "gxv1:Justin V3": "Justin Client V3",
  "gxv1:EFI 1.12.2": "EFI Client 1.12.2",
  "gxv1:EFI 1.8.8": "EFI Client 1.8.8",
  "gx:EFI (1.12.2-u2)": "EFI Client 1.12.2",
  "gx:EFI (1.8.8-u53)": "EFI Client 1.8.8",
  "gxv1:Modern Client WASM": "Modern Client 1.12.2 WASM",
  "gx:Modern Client (1.12.2-u2) WASM": "Modern Client 1.12.2 WASM",
  "gxv1:1.6.4 WASM Forge": "Forge 1.6.4 WASM",
  "gx:Forge 1.0.0": "Forge 1.0",
  "gx:Chromium Client (26.2-u1)": "Chromium Client 26.2 WASM",
  "gx:The Broken Script 1.8.8": "The Broken Script 1.8.8",
  "gx:Shadow Network": "Shadow Network",
  "gx:Indev": "Indev (Classic engine)",
  "gxv1:indev": "Indev (Classic engine)",
  "cookering:eagler-indev": "Indev (Classic engine)",
  "arham:eagler-indev": "Indev (Classic engine)",
  "milkdromeda:EaglercraftX 194": "Eaglercraft 1.9.4",
  "cookering:eaglercraftx-194": "Eaglercraft 1.9.4",
  "arham:eaglercraftx-194": "Eaglercraft 1.9.4",
  "milkdromeda:Eaglercraft 1.14 Aether": "Aether Mod 1.14.4",
  "milkdromeda:EaglerCreate fast WASM": "EaglerCreate 1.12.2 WASM",
  "milkdromeda:JEI Biomes O Plenty 1.8.8": "JEI + Biomes O Plenty 1.8.8",
  "milkdromeda:Eagler Modpack 1.12.2 New": "Eagler Modpack 1.12.2",
  "milkdromeda:Immersive Engineering 1.12 New": "Immersive Engineering 1.12.2",
  "arham:Eaglercraft-1.6.4-Forge": "Forge 1.6.4 Vanilla",
  "arham:Eaglercraft-1.6.4-Forge-WASM": "Forge 1.6.4 Vanilla WASM",
  "cookering:Tuff_Client_WASM": "Tuff Client 1.12.2 WASM",
  "arham:Tuff_Client_WASM": "Tuff Client 1.12.2 WASM",
  "cookering:Eaglercraft-1.5-wispcraft": "WispCraft 1.5.2",
  "cookering:wispcraft-eaglercraft-js": "WispCraft 1.8.8",
  "cookering:Eaglercraft-1.8_wasm-wispcraft": "WispCraft 1.8.8 WASM",
  "arham:wispcraft-EaglercraftX_1.8_WASM-GC": "WispCraft 1.8.8 WASM",
  "arham:wispcraft-Eaglercraft 1.8.8 ": "WispCraft 1.8.8",
  "cookering:wispcraft-Eaglercraft-1.12": "WispCraft 1.12.2 WASM",
  "arham:wispcraft-Eaglercraft-1.12": "WispCraft 1.12.2 WASM",
  "arham:wispcraft-Eaglercraft_1.12.2-WASM-GC": "WispCraft 1.12.2 WASM",
  "milkdromeda:WispCraft Eaglercraft 26.2 u2": "WispCraft 26.2 WASM",
  "milkdromeda:Eaglercraft IR PixelClient 1.8.8 WASM": "Pixel Client 1.8.8 WASM",
  "cookering:PixelClient 1.8.8 JS": "Pixel Client 1.8.8",
  "arham:PixelClient 1.8.8 JS": "Pixel Client 1.8.8",
  "gx:Pixel Client (1.12.2-u2)": "Pixel Client 1.12.2",
  "gxv1:Pixel Client": "Pixel Client 1.12.2",
  "milkdromeda:Eaglercraft IR Winston Horror": "Winston Horror",
  "milkdromeda:Eaglercraft IR c0.30 WASM": "Classic 0.30 WASM",
  "milkdromeda:EaglercraftZ 1.20 u4 Beta Intl": "EaglercraftZ 1.20 u4",
  "milkdromeda:EaglercraftZ 1.20u3 Intl": "EaglercraftZ 1.20",
  "milkdromeda:EaglercraftZ 1.20u3 WASM": "EaglercraftZ 1.20 WASM",
  "cookering:EaglercraftZ": "EaglercraftZ 1.20",
  "arham:EaglercraftZ": "EaglercraftZ 1.20",
  "milkdromeda:Eaglercraft Custom 1.12.2 Beta": "Custom 1.12.2",
  "cookering:Eaglercraft Mobile": "Mobile 1.8.8",
  "arham:Eaglercraft Mobile": "Mobile 1.8.8",
  "arham:Eaglercraft Scratch": "Scratch Edition",
  "arham:Eaglercraft-Scratch": "Scratch Edition",
  "milkdromeda:EaglerLite v1.7.2": "EaglerLite 1.7.2",
  "cookering:Eclipse Client": "Eclipse Client 1.8.8",
  "arham:Eclipse Client": "Eclipse Client 1.8.8",
  "milkdromeda:Eclipse WASM": "Eclipse Client 1.8.8 WASM",
  "milkdromeda:EclipseClient 1.19 JS": "Eclipse Client 1.19",
  "cookering:WurstX": "WurstX",
  "arham:WurstX": "WurstX",
  "milkdromeda:Wurst Client": "Wurst Client",
  "arham:Koneclient-1.8.8": "Kone Client 1.8.8",
  "arham:Huzzium-Client": "Huzzium Client 1.8.8",
  "gx:Huzzium Client (1.8.8 u53)": "Huzzium Client 1.8.8",
  "arham:Myven-Client-WASM": "Myven Client 1.8.8 WASM",
  "gx:Myven Client (1.8.8-u53)": "Myven Client 1.8.8 WASM",
  "arham:Precision": "Precision Client 1.8.8",
  "gx:Precision Client (1.8.8 u53)": "Precision Client 1.8.8",
  "arham:N0VA CLIENT": "Nova Client",
  "milkdromeda:Nova Client": "Nova Client",
  "arham:Mega Client-JS": "Mega Client",
  "arham:Prism-Client": "Prism Client",
  "arham:Aero Client JS": "Aero Client 1.12.2",
  "gx:Aero Client (1.12.2-u2)": "Aero Client 1.12.2",
  "milkdromeda:EB Client Nextgen CU7": "EB Client Nextgen CU7",
  "arham:EB Client Nextgen CU4": "EB Client Nextgen CU4",
  "milkdromeda:Astra 1.8 New": "Astra Client 1.8.8 New",
  "milkdromeda:Astra 1.8": "Astra Client 1.8.8",
  "milkdromeda:Astra 1.12": "Astra Client 1.12.2",
  "milkdromeda:Astra JS": "Astra Client Offline",
  "milkdromeda:Astra WASM": "Astra Client Offline WASM",
  "gxv1:Astra Client": "Astra Client Offline WASM",
  "gx:Astra Client (1.8.8-u53)": "Astra Client 1.8.8",
  "gx:Astra Client 2 (1.8.8-u53)": "Astra Client 2 1.8.8",
  "milkdromeda:ActX WASM v1.8.0": "ActX Client 1.8.0 WASM",
  "milkdromeda:DeathClient 1.4.1 1.8 Intl": "Death Client 1.4.1",
  "milkdromeda:DeathClient 1.4.1 1.8 WASM": "Death Client 1.4.1 WASM",
  "milkdromeda:DragonX Intl V6": "DragonX Client V6",
  "milkdromeda:DragonX V4": "DragonX Client V4",
  "milkdromeda:DragonX Client": "DragonX Client",
  "milkdromeda:DragonX Outspect": "DragonX Outspect",
  "milkdromeda:EaglerForge v1 1.8 EN": "EaglerForge 1.8.8",
  "milkdromeda:EaglerForge v1 1.8 Intl": "EaglerForge 1.8.8",
  "gx:Eaglerforge (1.8.8-u31)": "EaglerForge 1.8.8",
  "gxv1:Eaglerforge": "EaglerForge 1.8.8",
  "milkdromeda:EaglyMC u6 JS": "EaglyMC",
  "milkdromeda:EaglyMC u6 WASM": "EaglyMC WASM",
  "milkdromeda:EntropyX 1.8 WASM": "EntropyX 1.8.8 WASM",
  "milkdromeda:EntropyX 1.8": "EntropyX 1.8.8 WASM",
  "milkdromeda:GX Client": "GX Client 1.8.8",
  "gx:GX-Client (1.8.8-u53)": "GX Client 1.8.8",
  "gxv1:GX-Client": "GX Client 1.8.8",
  "milkdromeda:EVILcraft 1.21.11": "EVILcraft 1.21.11 WASM",
  "milkdromeda:TungSahur1.21.11": "Tung Sahur 1.21.11 WASM",
  "milkdromeda:Eaglercraft Weird Chest Thing": "Weird Chest Thing",
  "milkdromeda:eClient 1 5 2": "eClient 1.5.2",
  "milkdromeda:3TERN4L Client V2.1": "3TERN4L Client V2.1",
  "milkdromeda:Eaglercraft Explore": "Forge 1.6.4 Explore",
  "milkdromeda:Eaglercraft Lite": "Forge 1.6.4 Lite",
  "milkdromeda:Eaglercraft Magic": "Forge 1.6.4 Magic",
  "milkdromeda:Eaglercraft Skyfactory": "Forge 1.6.4 Skyfactory",
  "milkdromeda:Eaglercraft Tech": "Forge 1.6.4 Tech",
  "milkdromeda:Eaglercraft Ultimate": "Forge 1.6.4 Ultimate",
  "milkdromeda:Eaglercraft Vanilla": "Forge 1.6.4 Vanilla",
  "gx:Forge 1.6.4": "Forge 1.6.4 Ultimate",
  "milkdromeda:Eaglercraft WASM JSPI Explore": "Forge 1.6.4 Explore WASM",
  "milkdromeda:Eaglercraft WASM JSPI Lite": "Forge 1.6.4 Lite WASM",
  "milkdromeda:Eaglercraft WASM JSPI Magic": "Forge 1.6.4 Magic WASM",
  "milkdromeda:Eaglercraft WASM JSPI Skyfactory": "Forge 1.6.4 Skyfactory WASM",
  "milkdromeda:Eaglercraft WASM JSPI Tech": "Forge 1.6.4 Tech WASM",
  "milkdromeda:Eaglercraft WASM JSPI Ultimate": "Forge 1.6.4 Ultimate WASM",
  "milkdromeda:Eaglercraft WASM JSPI Vanilla": "Forge 1.6.4 Vanilla WASM",
  "gxv1:Tuff Client": "Tuff Client 1.12.2",
  "gx:Tuff Client (1.12.2-u2)": "Tuff Client 1.12.2",
  "gxv1:Tuff Client Beta": "Tuff Client Beta 1.12.2",
  "gx:Tuff Client Beta 1.12.2": "Tuff Client Beta 1.12.2",
  "gxv1:EB Client": "EB Client OG 1.8.8",
  "gx:EB Client OG (1.8.8 u53)": "EB Client OG 1.8.8",
  "gxv1:Resent Client": "Resent Client 1.8.8",
  "gx:Resent Client (1.8.8-u53)": "Resent Client 1.8.8",
  "gx:Eaglet (1.8.8-u53) WASM": "Eaglet 1.8.8 WASM",
  "cookering:EaglyMC": "EaglyMC",
  "arham:EaglyMC": "EaglyMC",
  "milkdromeda:Camo Client": "Camo Client",
  "arham:Water Client": "Water Client",
  "milkdromeda:Alpha 1.0.1 01 JS": "Alpha 1.0.1_01",
  "milkdromeda:Best Hacked Minecraft No AI": "Best Hacked Client",
  "milkdromeda:AuraClientBeta": "Aura Client Beta",
  "milkdromeda:AutoClient": "Auto Client",
  "milkdromeda:RavenA NotAnOrange": "Raven A NotAnOrange",
  "milkdromeda:RavenBS": "Raven BS",
  "gx:EB Client (1.8.8 u53)": "EB Client 1.8.8",
};

// Duplicate sha in different repos guarantees same build; the canonical sha owner's
// runtime wins. Anything else falls through to name rules below.
function pad2(n) {
  return String(n).padStart(2, "0");
}

function cleanLabel(raw) {
  let s = raw.trim();
  s = s.replace(/(?<![\d.])(\d)_(\d)_(\d)(?![\d.])/g, "$1.$2.$3"); // 1_3_2 -> 1.3.2
  s = s.replace(/(?<![\d.])1-(\d{1,2})-(\d{1,2})(?![\d.])/g, "1.$1.$2"); // 1-21-11 -> 1.21.11
  s = s.replace(/(\d)_(\d{1,2})(?=\D|$)/g, "$1§$2"); // protect 1.0.1_01 style suffixes
  s = s.replace(/_/g, " ").replace(/§/g, "_");
  return s;
}

function detectRuntime(s) {
  return /wasm|jspi/i.test(s) ? "wasm" : "js";
}

const NOISE = /\b(wasm|gc|jspi|js|javascript|javs|offline|download|en|intl|international|copy|html|eaglercraft|eaglercraftx|minecraft|ir|u\d+|sp\d[\d.]*|\(\d\)|new)\b/gi;

function classify(item) {
  const key = `${item.source}:${item.label}`;
  const label = OVERRIDES[key] ?? item.label;
  const s = cleanLabel(label);
  const low = s.toLowerCase();
  const runtime = detectRuntime(low);

  // ---- pre-classic
  let m = low.match(/rd[- ]?(\d{6})/) || low.match(/pre-release[- ](\d{6})/);
  if (m) return { family: "preclassic", ver: `rd-${m[1]}`, title: `Pre-Classic rd-${m[1]}`, runtime };

  // ---- classic
  if (/\bclassic\b|\bc0\.\d/.test(low) && !/client/.test(low)) {
    m = low.match(/(\d+)\.(\d+)(?:\.(\d+))?(a)?(?:[_ -]+(\d+))?/);
    if (m) {
      let [, a, b, c, , suf] = m;
      let ver;
      if (a === "0" && b === "0") ver = `0.0.${c}a${suf ? "_" + pad2(suf) : ""}`;
      else if (a === "0" && (b === "30" || (b === "3" && c === "0"))) ver = "0.30";
      else if (a === "0" && Number(b) >= 20 && !c) ver = `0.0.${b}a${suf ? "_" + pad2(suf) : ""}`;
      else ver = [a, b, c].filter(Boolean).join(".");
      return { family: "classic", ver, title: `Classic ${ver}`, runtime };
    }
  }

  // ---- infdev
  if (/\binfdev\b/.test(low)) return { family: "infdev", ver: "infdev", title: "Infdev", runtime };

  // ---- indev
  if (/\bindev\b/.test(low)) {
    if (/classic engine/.test(low)) return { family: "indev", ver: "indev-classic", title: "Indev (Classic engine)", runtime };
    m = low.match(/(20\d{6})/);
    let d = m ? m[1] : "";
    if (d === "20100233") d = "20100223"; // typo in source filenames
    return { family: "indev", ver: d || "indev", title: d ? `Indev ${d}` : "Indev", runtime };
  }

  // ---- Minecraft 4K
  if (/\b4k\b/.test(low)) return { family: "misc", ver: "4k", title: "Minecraft 4K", runtime: "js" };

  // ---- alpha
  m = low.match(/(?:\balpha[ -]*|\ba)(1\.\d+\.\d+(?:_\d+)?)/);
  if (m && !/client/.test(low)) return { family: "alpha", ver: m[1], title: `Alpha ${m[1]}`, runtime };

  // ---- beta
  m = low.match(/(?:\bbeta[ -]*|\bb)(1\.\d+(?:\.\d+)?)(?:[_ -]*(0\d|tb\d|pre\s*\d))?/);
  if (m && !/client/.test(low)) {
    let ver = m[1];
    const suf = (m[2] || "").replace(/\s+/g, "");
    if (suf.startsWith("tb")) ver += `-${suf}`;
    else if (suf.startsWith("pre")) ver += `-pre${suf.replace("pre", "")}`;
    // _01/_02 hotfix suffixes: merge with the base number (sources disagree on naming)
    return { family: "beta", ver, title: `Beta ${ver.replace("-pre", " Pre ").replace("-tb", " Test Build ")}`, runtime };
  }

  // ---- version number in the label
  const vm = low.match(/(?<![\d.])(2\d\.\d+(?:\.\d+)?)(?![\d])/) || low.match(/(?<![\d.])(1\.\d+(?:\.\d+)?)(?![\d])/);
  let ver = vm ? vm[1] : "";
  if (RELEASE_ALIAS[ver]) ver = RELEASE_ALIAS[ver];

  // what remains once we strip the version + noise is the client/variant name
  let rest = s
    .replace(/\(.*?\)/g, " ")
    .replace(vm ? new RegExp(vm[1].replace(/\./g, "\\."), "g") : /$^/, " ")
    .replace(NOISE, " ")
    .replace(/[-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const isModern = /^2\d\./.test(ver);
  const rt = isModern ? "wasm" : runtime; // 26.x builds are WebAssembly only

  if (!rest) {
    if (!ver) return null;
    return { family: isModern ? "modern" : "release", ver, title: `Release ${ver}`, runtime: rt };
  }

  if (/scratch|mobile|weird chest/i.test(rest)) {
    return { family: "misc", ver, client: rest, title: rest + (ver ? ` ${ver}` : ""), runtime: rt };
  }
  const modded = /forge|modpack|modded|skyfactory|immersive|jei|aether|create|biomes/i.test(rest) || FORGE_PACKS.includes(rest.toLowerCase());
  return {
    family: modded ? "modded" : "client",
    ver,
    client: rest,
    title: rest + (ver ? ` ${ver}` : ""),
    runtime: rt,
  };
}

/* ------------------------------------------------------------------ helpers */
function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-|-$/g, "");
}

function verSortKey(v) {
  // numeric sort key from the first dotted number found
  const m = String(v).match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!m) return 0;
  return Number(m[1]) * 1e6 + Number(m[2] || 0) * 1e3 + Number(m[3] || 0);
}

/* ------------------------------------------------------------------ main */
const all = [];
for (const src of SOURCES) {
  process.stderr.write(`fetching ${src.repo}… `);
  const items = await collect(src);
  process.stderr.write(`${items.length} builds\n`);
  all.push(...items);
}

// identical bytes => identical build, so share one runtime even if names disagree
const shaRuntime = new Map();
for (const it of all) {
  const c = classify(it);
  if (!c) continue;
  if (c.runtime === "wasm") shaRuntime.set(it.sha, "wasm");
}

const groups = new Map();
const unclassified = [];
for (const it of all) {
  const c = classify(it);
  if (!c) {
    unclassified.push(`${it.source}:${it.label}`);
    continue;
  }
  if (shaRuntime.get(it.sha) === "wasm") c.runtime = "wasm";
  const gkey = `${c.family}:${slug(c.client || "")}:${c.ver}`;
  let g = groups.get(gkey);
  if (!g) {
    g = {
      id: slug(c.family === "client" || c.family === "modded" ? c.title : `${c.family}-${c.ver}`),
      title: c.title,
      family: c.family,
      version: c.ver,
      runtimes: {},
      _shas: new Set(),
    };
    groups.set(gkey, g);
  }
  const list = (g.runtimes[c.runtime] ||= []);
  // same sha already present under this runtime: an exact duplicate, keep the earlier
  // (higher priority) mirror but remember the extra host as a fallback
  list.push({ s: it.source, u: it.url, k: it.kind, b: it.size, label: it.label, sha: it.sha });
}

// tidy: order mirrors by source priority, remove same-url dupes, final shape
const prio = Object.fromEntries(SOURCES.map((s, i) => [s.id, i]));
const entries = [];
for (const g of groups.values()) {
  for (const rt of Object.keys(g.runtimes)) {
    const seen = new Set();
    g.runtimes[rt] = g.runtimes[rt]
      .sort((a, b) => prio[a.s] - prio[b.s])
      .filter((m) => (seen.has(m.u) ? false : seen.add(m.u)))
      .map(({ s, u, k, b }) => ({ s, u, k, b }));
  }
  delete g._shas;
  entries.push(g);
}

// readable titles
for (const e of entries) {
  if (e.family === "release" || e.family === "modern") e.title = e.version;
}

// unique ids
const idCount = {};
for (const e of entries) {
  idCount[e.id] = (idCount[e.id] || 0) + 1;
  if (idCount[e.id] > 1) e.id += `-${idCount[e.id]}`;
}

entries.sort((a, b) => {
  const fa = FAMILY_ORDER.indexOf(a.family);
  const fb = FAMILY_ORDER.indexOf(b.family);
  if (fa !== fb) return fa - fb;
  if (a.family === "client" || a.family === "modded" || a.family === "misc") return a.title.localeCompare(b.title);
  return verSortKey(b.version) - verSortKey(a.version) || b.version.localeCompare(a.version);
});

const builds = entries.reduce((n, e) => n + Object.values(e.runtimes).reduce((k, l) => k + l.length, 0), 0);
const out = {
  generated: new Date().toISOString().slice(0, 10),
  sources: SOURCES.map(({ id, name, repo, pages }) => ({ id, name, repo, pages: pages || null })),
  stats: { files: all.length, builds, entries: entries.length },
  entries,
};

mkdirSync(join(ROOT, "data"), { recursive: true });
// Full mirror index (every copy in every archive). The website does not read this;
// scripts/vendor-builds.mjs uses it to pick one copy per build and store it in builds/.
writeFileSync(join(ROOT, "data/mirrors.json"), JSON.stringify(out) + "\n");
process.stderr.write(
  `\n${all.length} files from ${SOURCES.length} sources -> ${entries.length} unique entries (${builds} mirrors) -> data/mirrors.json\n`,
);
if (unclassified.length) process.stderr.write(`unclassified: ${unclassified.join(", ")}\n`);
if (process.argv.includes("--dump")) {
  for (const e of entries) {
    const rts = Object.entries(e.runtimes).map(([k, v]) => `${k}:${v.map((m) => m.s).join("+")}`).join("  ");
    console.log(`${e.family.padEnd(10)} ${e.title.padEnd(34)} ${rts}`);
  }
}
