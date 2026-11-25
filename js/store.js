/* Shared state + catalog helpers for the launcher and the player. */
(() => {
  "use strict";
  const CAT = window.QUASORIA_CATALOG || { entries: [], sources: [] };
  const byId = new Map(CAT.entries.map((e) => [e.id, e]));
  const sourceById = new Map(CAT.sources.map((s) => [s.id, s]));

  const ls = {
    get(k, d = null) {
      try {
        const v = localStorage.getItem("quasoria:" + k);
        return v == null ? d : JSON.parse(v);
      } catch {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem("quasoria:" + k, JSON.stringify(v));
      } catch {}
    },
  };

  // Every build is stored once, in builds/<id>/, with a single runtime.
  const runtimesOf = (e) => [e.rt];
  const preferredRuntime = (e) => e.rt;
  const buildUrl = (e) => e.path;

  let _gc;
  function supportsWasmGC() {
    if (_gc !== undefined) return _gc;
    try {
      // (module (type (struct)))  - minimal module using the GC proposal
      _gc = WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 3, 1, 95, 0]));
    } catch {
      _gc = false;
    }
    return _gc;
  }

  // Eaglercraft's WASM-GC runtime also needs JSPI (WebAssembly.Suspending):
  // on by default in Chrome/Edge 137+.
  const supportsJSPI = () => typeof WebAssembly === "object" && typeof WebAssembly.Suspending === "function";
  const wasmReady = () => supportsWasmGC() && supportsJSPI();

  const playUrl = (e) => "play.html?id=" + encodeURIComponent(e.id);

  function fmtBytes(b) {
    if (!b) return "";
    if (b < 1024 * 1024) return Math.max(1, Math.round(b / 1024)) + " KB";
    if (b >= 1e9) return (b / 1024 / 1024 / 1024).toFixed(2) + " GB";
    return (b / 1024 / 1024).toFixed(b < 10 * 1024 * 1024 ? 1 : 0) + " MB";
  }


  /* recent + favorites */
  function pushRecent(id) {
    const list = ls.get("recent", []).filter((r) => r.id !== id);
    list.unshift({ id, at: Date.now() });
    ls.set("recent", list.slice(0, 12));
  }
  const recent = () => ls.get("recent", []).filter((r) => byId.has(r.id));
  const favs = () => new Set(ls.get("favs", []));
  function toggleFav(id) {
    const f = favs();
    f.has(id) ? f.delete(id) : f.add(id);
    ls.set("favs", [...f]);
    return f.has(id);
  }

  window.QStore = {
    CAT, byId, sourceById, ls, runtimesOf, preferredRuntime, supportsWasmGC, supportsJSPI, wasmReady, buildUrl,
    playUrl, fmtBytes, pushRecent, recent, favs, toggleFav,
  };
})();
