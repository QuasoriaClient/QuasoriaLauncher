# Quasoria Launcher

A launcher website for every Eaglercraft build in the known universe. It merges five community archives into one catalog with no duplicates, and plays each build right in your browser.

**171 unique builds · 521 mirrors · 5 archives.** The catalog runs from Pre-Classic `rd-131655` through Classic, Indev, Alpha, Beta and Release 1.0–1.21.11 up to 26.3, plus 83 clients, 16 Forge/modpack builds and a few oddities.

## Sources

| Archive | Hosting | Builds |
| --- | --- | --- |
| [XENOTECH-X/GX-Launcher](https://github.com/XENOTECH-X/GX-Launcher) (GX Launcher) | GitHub Pages: direct | 116 |
| [GX-Launcher-V1/GX-Launcher-V1.github.io](https://github.com/GX-Launcher-V1/GX-Launcher-V1.github.io) | GitHub Pages: direct | 43 |
| [TheCookeringYT/Play](https://github.com/TheCookeringYT/Play) | GitHub Pages: direct | 103 |
| [UserArham/version](https://github.com/UserArham/version) | raw GitHub: streamed | 138 |
| [MilkdromedaStudios/all-of-eaglercraft](https://github.com/MilkdromedaStudios/all-of-eaglercraft) | raw GitHub: streamed | 121 |

### How deduplication works

`scripts/build-catalog.mjs` reads every repo's file tree from the GitHub API. It then turns each filename into a normalized identity: *era + version + client name*, plus the runtime (JS or WASM). Some examples:

- `Eaglercraft_Beta_1.4_01.html`, `Eaglercraft Beta 1.4.html` and GX's `beta-1.4/` all become **Beta 1.4**.
- `Classic 0.24_3-JS.html` and `classic-0.0.24a-03-wasm/` both become **Classic 0.0.24a_03** (once as JS, once as WASM).
- `EaglercraftX 1.8 EN/Intl/WASM`, `Eaglercraft-1.8.8.html` and so on all become **1.8.8**.
- When several archives contain byte-identical files (same git SHA), they share one runtime, even if a filename says otherwise.

Each identity becomes **one card**. Every copy across the archives becomes a **mirror** of that card. Mirrors are ordered so the Pages-hosted (fastest) copies come first. The script has a small override table for filenames the rules can't parse.

```sh
GITHUB_TOKEN=$(gh auth token) node scripts/build-catalog.mjs --dump
```

This regenerates `data/catalog.js` (`--dump` also prints the merged table).

## How playing works (`play.html`)

- **Direct** mirrors (GitHub Pages) are embedded in an iframe.
- **Streamed** mirrors are fetched from `raw.githubusercontent.com` with a live progress bar. They're stored with the Cache API, so the next launch is instant, and then booted from a same-origin `blob:` URL, so your worlds persist in this site's storage.
- If a streamed mirror fails, the player moves on to the next mirror, and then to the other runtime.
- The top bar hides itself while you play. It has controls to switch runtime or mirror, go fullscreen, and open the build in a new tab.

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

- Sector sidebar, search (press `/`), a WASM/JS filter, and sorting (timeline, A–Z, most mirrors)
- A detail sheet for each build with a runtime picker, mirror list (host, size, direct or streamed) and share link (`#b/<id>`)
- Favorites, a "recent transmissions" rail, and a "Continue" button (stored in localStorage)
- Picks WASM by default when the browser supports WebAssembly GC, and falls back to JS otherwise
- No build step: plain HTML, CSS and JS

## Run locally

```sh
python3 -m http.server 8080
```

Then open http://localhost:8080. Streamed builds and the Cache API need `http://localhost` or HTTPS.

---

This is a fan-made launcher, not affiliated with Mojang or Microsoft. All builds belong to their respective authors and archive maintainers.
