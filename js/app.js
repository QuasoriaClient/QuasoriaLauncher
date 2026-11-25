(() => {
  "use strict";
  const S = window.QStore;
  const { CAT, byId, sourceById } = S;
  const { SECTORS, paint } = window.QThumbs;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const ENTRIES = CAT.entries;

  /* ------------------------------------------------ sectors (filters) */
  const SECTOR_TABS = [
    { id: "all", name: "Entire galaxy", sub: "All builds", families: null },
    { id: "favs", name: "Favorites", sub: "Starred", families: null },
    { id: "modern", name: "Quasars", sub: "Modern · 26.x", families: ["modern"] },
    { id: "release", name: "Spiral Galaxies", sub: "Release 1.0 – 1.21", families: ["release"] },
    { id: "beta", name: "Binary Stars", sub: "Beta", families: ["beta"] },
    { id: "alpha", name: "Red Giants", sub: "Alpha", families: ["alpha"] },
    { id: "proto", name: "Protostars", sub: "Indev · Infdev", families: ["indev", "infdev"] },
    { id: "classic", name: "Nebulae", sub: "Classic", families: ["classic"] },
    { id: "preclassic", name: "Singularities", sub: "Pre-Classic rd", families: ["preclassic"] },
    { id: "client", name: "Constellations", sub: "Clients", families: ["client"] },
    { id: "modded", name: "Supernovae", sub: "Forge & modpacks", families: ["modded"] },
    { id: "misc", name: "Comets", sub: "Oddities", families: ["misc"] },
  ];
  const SECTOR_DOT = {
    all: "linear-gradient(135deg,#5ee7ff,#a274ff,#ff7ad9)",
    favs: "#ffd36b",
    modern: "#a274ff",
    release: "#6aa8ff",
    beta: "#5ee7ff",
    alpha: "#ff6b5e",
    proto: "#ffb35e",
    classic: "#3fe0c5",
    preclassic: "#ff9d3d",
    client: "#7cc4ff",
    modded: "#ff5fa8",
    misc: "#7affb8",
  };

  const state = {
    sector: S.ls.get("sector", "all"),
    rt: "any",
    sort: "era",
    q: "",
  };

  function inSector(e, sec) {
    if (sec.id === "all") return true;
    if (sec.id === "favs") return S.favs().has(e.id);
    return sec.families.includes(e.family);
  }

  function renderSectors() {
    const list = $("#sectorList");
    list.replaceChildren(
      ...SECTOR_TABS.map((sec) => {
        const n = ENTRIES.filter((e) => inSector(e, sec)).length;
        if (sec.id === "favs" && n === 0 && state.sector !== "favs") return document.createComment("");
        const b = document.createElement("button");
        b.className = "sector" + (state.sector === sec.id ? " active" : "");
        b.setAttribute("role", "tab");
        b.setAttribute("aria-selected", String(state.sector === sec.id));
        b.innerHTML = `<span class="sdot" style="background:${SECTOR_DOT[sec.id]}"></span>
          <span class="sname"><b>${esc(sec.name)}</b><small>${esc(sec.sub)}</small></span>
          <span class="scount mono">${n}</span>`;
        b.onclick = () => {
          state.sector = sec.id;
          S.ls.set("sector", sec.id);
          renderSectors();
          renderGrid();
        };
        return b;
      }),
    );
  }

  /* ------------------------------------------------ search / filter / sort */
  function haystack(e) {
    const sec = SECTORS[e.family];
    const srcs = [e.from, ...(e.also || [])].map((s) => sourceById.get(s)?.name || s);
    return [e.title, e.version, e.family, sec?.name, sec?.label, e.rt, ...srcs].join(" ").toLowerCase();
  }
  const HAY = new Map(ENTRIES.map((e) => [e.id, haystack(e)]));
  const ORDER = new Map(ENTRIES.map((e, i) => [e.id, i]));

  function filtered() {
    const sec = SECTOR_TABS.find((s) => s.id === state.sector) || SECTOR_TABS[0];
    const terms = state.q.toLowerCase().split(/\s+/).filter(Boolean);
    let list = ENTRIES.filter((e) => {
      if (!inSector(e, sec)) return false;
      if (state.rt !== "any" && e.rt !== state.rt) return false;
      if (!terms.length) return true;
      const h = HAY.get(e.id);
      return terms.every((t) => h.includes(t));
    });
    if (state.sort === "az") list = list.slice().sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }));
    else if (state.sort === "size") list = list.slice().sort((a, b) => a.size - b.size || ORDER.get(a.id) - ORDER.get(b.id));
    return list;
  }

  /* ------------------------------------------------ cards */
  const io = new IntersectionObserver(
    (items) => {
      for (const it of items) {
        if (!it.isIntersecting) continue;
        const c = it.target;
        io.unobserve(c);
        const e = byId.get(c.dataset.id);
        if (e) requestIdleCallbackSafe(() => paint(c, e));
      }
    },
    { rootMargin: "300px" },
  );
  function requestIdleCallbackSafe(fn) {
    (window.requestIdleCallback || ((f) => setTimeout(f, 1)))(fn, { timeout: 300 });
  }

  function subtitle(e) {
    const sec = SECTORS[e.family];
    if (e.family === "release" || e.family === "modern") return `${sec.label} ${e.version}`;
    if (e.family === "client" || e.family === "modded" || e.family === "misc") return e.version ? `${sec.label} · based on ${e.version}` : sec.label;
    return sec.label;
  }

  function card(e, i) {
    const sec = SECTORS[e.family];
    const fav = S.favs().has(e.id);
    const el = document.createElement("article");
    el.className = "card";
    el.style.setProperty("--d", `${Math.min(i, 24) * 25}ms`);
    el.innerHTML = `
      <button class="card-hit" aria-label="${esc(e.title)}: open details"></button>
      <div class="card-art">
        <canvas width="320" height="180" data-id="${esc(e.id)}"></canvas>
        <span class="card-sector mono">${esc(sec.name)}</span>
        ${fav ? '<span class="card-fav" title="Favorite">★</span>' : ""}
      </div>
      <div class="card-body">
        <h3>${esc(e.title)}</h3>
        <p class="card-sub">${esc(subtitle(e))}</p>
        <div class="card-foot">
          <span class="rts"><span class="rt rt-${e.rt}">${e.rt.toUpperCase()}</span></span>
          <span class="sz mono" title="Stored in this site">${S.fmtBytes(e.size)}</span>
        </div>
      </div>
      <button class="card-play" aria-label="Launch ${esc(e.title)}">
        <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14Z"/></svg>
      </button>`;
    $(".card-hit", el).onclick = () => openSheet(e);
    $(".card-play", el).onclick = (ev) => {
      ev.stopPropagation();
      launch(e);
    };
    io.observe($("canvas", el));
    return el;
  }

  const PAGE = 48;
  let shown = PAGE;
  let lastList = [];
  function renderGrid(keepPage) {
    const list = filtered();
    lastList = list;
    if (!keepPage) shown = PAGE;
    $("#grid").replaceChildren(...list.slice(0, shown).map(card));
    updateMore();
    $("#empty").hidden = list.length > 0;
    const total = list.reduce((n, e) => n + e.size, 0);
    $("#resultLine").textContent = `${list.length} build${list.length === 1 ? "" : "s"} · ${S.fmtBytes(total)} stored`;
  }

  function updateMore() {
    const left = lastList.length - shown;
    $("#moreWrap").hidden = left <= 0;
    $("#moreBtn").textContent = `Show more (${left} left)`;
  }
  $("#moreBtn").addEventListener("click", () => {
    const grid = $("#grid");
    const next = lastList.slice(shown, shown + PAGE);
    next.forEach((e, i) => grid.append(card(e, i)));
    shown += PAGE;
    updateMore();
  });

  /* ------------------------------------------------ toolbar wiring */
  const search = $("#search");
  search.placeholder = `Search ${ENTRIES.length} builds… (e.g. beta 1.7, astra, wasm)`;
  let qTimer;
  search.addEventListener("input", () => {
    clearTimeout(qTimer);
    qTimer = setTimeout(() => {
      state.q = search.value.trim();
      renderGrid();
    }, 80);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== search && !$("#sheet").open) {
      e.preventDefault();
      search.focus();
      search.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  });
  document.querySelectorAll(".seg-btn").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll(".seg-btn").forEach((x) => {
        x.classList.toggle("active", x === b);
        x.setAttribute("aria-checked", String(x === b));
      });
      state.rt = b.dataset.rt;
      renderGrid();
    }),
  );
  $("#sort").addEventListener("change", (e) => {
    state.sort = e.target.value;
    renderGrid();
  });

  /* ------------------------------------------------ detail sheet */
  const sheet = $("#sheet");
  let cur = null;
  function openSheet(e) {
    cur = e;
    const sec = SECTORS[e.family];
    paint($("#sheetArt"), e);
    $("#sheetName").textContent = e.title;
    $("#sheetSector").textContent = sec.name;
    $("#sheetFamily").textContent = subtitle(e);
    const fav = S.favs().has(e.id);
    $("#sheetFav").classList.toggle("on", fav);
    $("#sheetFav").setAttribute("aria-pressed", String(fav));

    const src = sourceById.get(e.from);
    const wasm = e.rt === "wasm";
    $("#sheetRuntime").textContent = wasm ? "WebAssembly" : "JavaScript";
    $("#sheetRuntimeNote").textContent = wasm
      ? S.wasmReady() ? "Faster · your browser supports it" : "Needs Chrome or Edge 137+ (WASM-GC + JSPI)"
      : "Works in any modern browser";
    $("#sheetSize").textContent = S.fmtBytes(e.size);
    const origin = $("#sheetOrigin");
    origin.textContent = src?.name || e.from;
    origin.href = `https://github.com/${src?.repo || ""}`;
    const also = (e.also || []).map((s) => sourceById.get(s)?.name || s);
    $("#sheetAlso").textContent = also.length ? `Also archived by ${also.join(", ")}` : "Only found in this archive";
    $("#sheetLaunch").href = S.playUrl(e);
    if (!sheet.open) sheet.showModal();
    history.replaceState(null, "", `#b/${encodeURIComponent(e.id)}`);
  }

  sheet.addEventListener("close", () => {
    if (location.hash.startsWith("#b/")) history.replaceState(null, "", location.pathname + location.search);
  });
  sheet.addEventListener("click", (ev) => {
    if (ev.target === sheet) sheet.close();
  });
  $("#sheetFav").addEventListener("click", () => {
    if (!cur) return;
    const on = S.toggleFav(cur.id);
    $("#sheetFav").classList.toggle("on", on);
    $("#sheetFav").setAttribute("aria-pressed", String(on));
    renderSectors();
    renderGrid(true);
    toast(on ? "Added to favorites" : "Removed from favorites");
  });
  $("#copyBtn").addEventListener("click", async () => {
    if (!cur) return;
    const url = new URL(`#b/${encodeURIComponent(cur.id)}`, location.href).toString();
    try {
      await navigator.clipboard.writeText(url);
      toast("Link copied");
    } catch {
      window.prompt("Copy this link:", url);
    }
  });

  /* ------------------------------------------------ launch / recent */
  function launch(e) {
    location.href = S.playUrl(e);
  }

  function renderRecent() {
    const rec = S.recent();
    $("#recentWrap").hidden = rec.length === 0;
    $("#recentRail").replaceChildren(
      ...rec.map((r) => {
        const e = byId.get(r.id);
        const a = document.createElement("a");
        a.className = "chip-card";
        a.href = S.playUrl(e);
        a.innerHTML = `<canvas width="96" height="54"></canvas><span><b>${esc(e.title)}</b><small class="mono">${e.rt.toUpperCase()} · ${timeAgo(r.at)}</small></span>`;
        paint($("canvas", a), e);
        return a;
      }),
    );
    const last = rec[0] && byId.get(rec[0].id);
    const nav = $("#navContinue");
    nav.hidden = !last;
    if (last) {
      $("#navContinueLabel").textContent = `Continue ${last.title}`;
      nav.onclick = () => launch(last);
    }
    const target = last || byId.get("release-1.8.8") || ENTRIES[0];
    $("#heroLaunchLabel").textContent = last ? `Continue ${target.title}` : `Launch ${target.title}`;
    $("#heroLaunch").onclick = () => launch(target);
  }
  $("#clearRecent").onclick = () => {
    S.ls.set("recent", []);
    renderRecent();
  };

  function timeAgo(t) {
    const s = (Date.now() - t) / 1000;
    if (s < 60) return "just now";
    if (s < 3600) return Math.floor(s / 60) + "m ago";
    if (s < 86400) return Math.floor(s / 3600) + "h ago";
    return Math.floor(s / 86400) + "d ago";
  }

  /* ------------------------------------------------ hero satellites */
  function renderSatellites() {
    const picks = ["modern-26.3", "release-1.8.8", "beta-1.7.3"].map((id) => byId.get(id)).filter(Boolean);
    document.querySelectorAll(".satellite").forEach((b, i) => {
      const e = picks[i];
      if (!e) return (b.hidden = true);
      b.textContent = e.title;
      b.onclick = () => openSheet(e);
    });
  }

  /* ------------------------------------------------ sources */
  function renderSources() {
    // stored = the copy kept in builds/ came from this archive; listed = it had the build at all
    const counts = {};
    for (const e of ENTRIES)
      for (const sid of [e.from, ...(e.also || [])]) {
        counts[sid] ||= { listed: 0, stored: 0, bytes: 0, exclusive: 0 };
        counts[sid].listed++;
        if (sid === e.from) {
          counts[sid].stored++;
          counts[sid].bytes += e.size;
          if (!(e.also || []).length) counts[sid].exclusive++;
        }
      }
    $("#sourceGrid").replaceChildren(
      ...CAT.sources.map((s, i) => {
        const c = counts[s.id] || { listed: 0, stored: 0, bytes: 0, exclusive: 0 };
        const a = document.createElement("a");
        a.className = "source";
        a.href = `https://github.com/${s.repo}`;
        a.target = "_blank";
        a.rel = "noopener";
        a.innerHTML = `
          <span class="source-orb" style="--h:${(i * 67 + 200) % 360}"></span>
          <span class="source-body">
            <b>${esc(s.name)}</b>
            <small class="mono">${esc(s.repo)}</small>
            <span class="source-stats">
              <span><i class="mono">${c.listed}</i> builds</span>
              <span><i class="mono">${c.stored}</i> kept</span>
              <span><i class="mono">${c.exclusive}</i> exclusive</span>
              <span class="tag-kind page">${S.fmtBytes(c.bytes) || "0 MB"}</span>
            </span>
          </span>`;
        return a;
      }),
    );
    $("#genDate").textContent = CAT.generated;
  }

  /* ------------------------------------------------ toast */
  let tt;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(tt);
    tt = setTimeout(() => el.classList.remove("show"), 2000);
  }

  /* ------------------------------------------------ boot */
  function stats() {
    $("#heroCount").textContent = ENTRIES.length;
    $("#statEntries").textContent = ENTRIES.length;
    $("#statStored").textContent = S.fmtBytes(CAT.stats.bytes);
    $("#statSources").textContent = CAT.sources.length;
  }

  function handleHash() {
    const m = location.hash.match(/^#b\/(.+)$/);
    const e = m && byId.get(decodeURIComponent(m[1]));
    if (e) openSheet(e);
  }
  window.addEventListener("hashchange", handleHash);

  stats();
  renderSatellites();
  renderSectors();
  renderGrid();
  renderRecent();
  renderSources();
  handleHash();
})();
