# QuasoriaLauncher

A static website that lists every Eaglercraft version and starts any of them in your browser in one click.

## Versions

Taken from [eaglercraft.com/play](https://eaglercraft.com/play) on 2026-11-25. They are stored in [`data/versions.js`](data/versions.js).

| Version | Category | Launch slug(s) |
| --- | --- | --- |
| Eaglercraft 26.3 | Modern | `26.3` |
| Eaglercraft 26.2 | Modern | `26.2` |
| Eaglercraft 1.12.2 | Release | `1.12.2-wasm` (WebAssembly), `1.12.2` (JavaScript) |
| Eaglercraft 1.8.8 | Release | `1.8.8-wasm` (WebAssembly), `1.8.8` (JavaScript) |
| Modpacks (Forge) | Modded | *(none, opens `/play`)* |
| Eaglercraft 1.5.2 | Release | `1.5.2` |
| Beta 1.7.3 | Beta & Alpha | `b1.7.3` |
| Beta 1.3 | Beta & Alpha | `b1.3` |
| Alpha 1.2.6 | Beta & Alpha | `a1.2.6` |
| Indev | Beta & Alpha | `indev` |

Each version opens `https://eaglercraft.com/play?version=<slug>`.

## Features

- Version grid with filters (Modern / Release / Beta & Alpha / Modded) and search (press `/`)
- Detail panel for each version, with a WebAssembly / JavaScript choice for 1.8.8 and 1.12.2
- Remembers your last-played version and runtime (localStorage) and shows a **Continue** button
- Deep links to a version, e.g. `/#v/1.8.8`
- No build step: plain HTML, CSS and JS

## Run locally

```sh
python3 -m http.server 8080
# open http://localhost:8080
```

You can also deploy the folder as-is to GitHub Pages or any static host.

## Adding or updating versions

Edit `data/versions.js`. Each entry needs an `id`, `name`, `category`, `image` (a file in eaglercraft.com's `/versions/` folder) and a list of `runtimes`, each with a `slug`.

---

This is a fan-made launcher, not affiliated with Eaglercraft, Mojang or Microsoft.
