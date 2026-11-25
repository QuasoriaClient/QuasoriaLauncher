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

  const runtimesOf = (e) => ["wasm", "js"].filter((r) => e.runtimes[r]?.length);
  const mirrorCount = (e) => runtimesOf(e).reduce((n, r) => n + e.runtimes[r].length, 0);

  function preferredRuntime(e) {
    const saved = ls.get("rt:" + e.id);
    const avail = runtimesOf(e);
    if (saved && avail.includes(saved)) return saved;
    // WASM-GC needs a modern browser; fall back to JS when we can tell it's missing
    if (avail.includes("wasm") && supportsWasmGC()) return "wasm";
    return avail.includes("js") ? "js" : avail[0];
  }

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

  function playUrl(e, rt = preferredRuntime(e), m = 0) {
    const q = new URLSearchParams({ id: e.id, rt });
    if (m) q.set("m", String(m));
    return "play.html?" + q.toString();
  }

  function fmtBytes(b) {
    if (!b) return "";
    if (b < 1024 * 1024) return Math.max(1, Math.round(b / 1024)) + " KB";
    return (b / 1024 / 1024).toFixed(b < 10 * 1024 * 1024 ? 1 : 0) + " MB";
  }

  function hostOf(url) {
    try {
      return new URL(url).host;
    } catch {
      return "";
    }
  }

  /* recent + favorites */
  function pushRecent(id, rt) {
    const list = ls.get("recent", []).filter((r) => r.id !== id);
    list.unshift({ id, rt, at: Date.now() });
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
    CAT, byId, sourceById, ls, runtimesOf, mirrorCount, preferredRuntime, supportsWasmGC,
    playUrl, fmtBytes, hostOf, pushRecent, recent, favs, toggleFav,
  };
})();
