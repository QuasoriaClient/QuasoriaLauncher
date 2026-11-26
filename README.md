# Quasoria Launcher

A launcher website for every Eaglercraft build in the known universe. It merges five community archives into one catalog with no duplicates, and **keeps exactly one copy of every build inside this repository** (`builds/`). There are no mirrors, and nothing is fetched from other sites when you play.

**171 unique builds · 4.49 GB stored · 5 archives merged.** The catalog runs from Pre-Classic `rd-131655` through Classic, Indev, Alpha, Beta and Release 1.0–1.21.11 up to 26.3, plus 83 clients, 16 Forge/modpack builds and a few oddities.

## Sources

| Archive | Builds kept from it |
| --- | --- |
| [XENOTECH-X/GX-Launcher](https://github.com/XENOTECH-X/GX-Launcher) (GX Launcher) | 61 |
| [GX-Launcher-V1/GX-Launcher-V1.github.io](https://github.com/GX-Launcher-V1/GX-Launcher-V1.github.io) | 6 |
| [TheCookeringYT/Play](https://github.com/TheCookeringYT/Play) | 33 |
| [UserArham/version](https://github.com/UserArham/version) | 11 |
| [MilkdromedaStudios/all-of-eaglercraft](https://github.com/MilkdromedaStudios/all-of-eaglercraft) | 60 |

### How deduplication works

`scripts/build-catalog.mjs` reads every repo's file tree from the GitHub API. It then turns each filename into a normalized identity: *era + version + client name*, plus the runtime (JS or WASM). Some examples:

- `Eaglercraft_Beta_1.4_01.html`, `Eaglercraft Beta 1.4.html` and GX's `beta-1.4/` all become **Beta 1.4**.
- `Classic 0.24_3-JS.html` and `classic-0.0.24a-03-wasm/` both become **Classic 0.0.24a_03** (once as JS, once as WASM).
- `EaglercraftX 1.8 EN/Intl/WASM`, `Eaglercraft-1.8.8.html` and so on all become **1.8.8**.
- When several archives contain byte-identical files (same git SHA), they share one runtime, even if a filename says otherwise.

Each identity becomes **one card**. The script has a small override table for filenames the rules can't parse. It writes a temporary archive index to your OS temp directory (never into the repo), which feeds the next step.

### How builds are kept

`scripts/vendor-builds.mjs` picks **one copy per card**: a JavaScript build when one exists (it runs in every browser), otherwise the smallest file. It then copies that build into `builds/<id>/`:

- Single-file builds are saved as `builds/<id>/index.html`.
- Multi-file builds (GX folders with `classes.js`, `assets.epk`, `.wasm` and so on) are copied whole.
- `builds/<id>/.source.json` records which repo and path each copy came from.
- Files are pulled with partial git clones that fetch only the needed blobs. Every file was checked byte-for-byte against GitHub's tree sizes.
- A few builds had analytics beacons or a CDN-hosted debug console. Those `<script>` tags are stripped, or pointed at `assets/vendor/`, so no build calls out to another host. The `PATCHES` list in the script shows exactly what was changed.
- The runtime label comes from each build's own `<title>` (for example "... WASM-GC"), because archive file names are not always right.

It then writes `data/catalog.js`, which lists only the local copies: one path per build, with no alternates.

```sh
GITHUB_TOKEN=$(gh auth token) node scripts/build-catalog.mjs --dump   # 1. merge the archives -> temp index
node scripts/vendor-builds.mjs --plan                                 # 2a. preview what will be kept
node scripts/vendor-builds.mjs                                        # 2b. download anything missing -> builds/, data/catalog.js
node scripts/vendor-builds.mjs --catalog                              # offline: rebuild data/catalog.js from builds/
```

GitHub's 100 MB per-file limit is never hit: the largest kept file is Chromium Client 26.2 at 100,391,663 bytes, which is under GitHub's 104,857,600-byte cap.

## How playing works (`play.html`)

- The player opens `builds/<id>/` in an iframe on the same origin as the launcher. Worlds and settings are saved in this site's storage.
- WASM-GC builds need **Chrome or Edge 137+** (WebAssembly GC + JSPI). The launcher detects this and warns on older browsers. JS builds run anywhere.
- The top bar hides itself while you play. It has reload, fullscreen and open-in-new-tab controls.

## The cosmos

Quasoria is a play on *quasar*, so the whole site is set in space:

- **`js/cosmos.js`**: a full-screen canvas with a live quasar behind the hero. It has a white-hot core, a photon ring, a tilted accretion disk of about 1,100 orbiting particles (Keplerian speeds with Doppler beaming), and twin relativistic jets with travelling knots. Around it are drifting, breathing domain-warped nebula clouds, a three-layer parallax starfield with twinkle and diffraction spikes, and the occasional shooting star. It reacts to the mouse and to scrolling, pauses in background tabs, and respects `prefers-reduced-motion`.
- **`js/thumbs.js`**: every era is a different cosmic object, and each card's art is generated from its ID:

| Sector | Era | Object |
| --- | --- | --- |
| Quasars | Modern 26.x | quasar with jets |
| Spiral Galaxies | Release | spiral galaxy |
| Binary Stars | Beta | binary pair with mass transfer |
| Red Giants | Alpha | red giant |
| Protostars | Indev · Infdev | protostar with bipolar outflow |
| Nebulae | Classic | emission nebula |
| Singularities | Pre-Classic | black hole with lensed disk |
| Constellations | Clients | constellation |
| Supernovae | Forge & modpacks | supernova remnant |
| Comets | Oddities | comet |

## Features

- Sector sidebar, search (press `/`), a WASM/JS filter, sorting (timeline, A–Z, smallest first), and 48 cards per page with "Show more"
- A detail sheet for each build showing its runtime, stored size and the archive it was kept from, plus a share link (`#b/<id>`)
- Favorites, a "recent transmissions" rail, and a "Continue" button (stored in localStorage)
- Self-hosted fonts (`assets/fonts/`, from @fontsource), so the site makes no outside requests
- No build step: plain HTML, CSS and JS

## Run locally

```sh
python3 -m http.server 8080
```

Then open http://localhost:8080. Use a server rather than opening the file directly, because some builds load their `classes.js` and `assets.epk` with requests that browsers block on `file://`.

> **Hosting note:** the full site is about 4.5 GB. GitHub Pages only publishes sites up to 1 GB, so host it somewhere without that cap (your own server, Cloudflare R2 + Pages, Netlify with large media, etc.). Cloning the repo also downloads every build.

---

This is a fan-made launcher, not affiliated with Mojang or Microsoft. All builds belong to their respective authors and archive maintainers.
