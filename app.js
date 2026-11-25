(() => {
  "use strict";

  const VERSIONS = window.QUASORIA_VERSIONS || [];
  const SOURCE = window.QUASORIA_SOURCE || {};
  const ORIGIN = "https://eaglercraft.com";
  const DEFAULT_ID = "1.8.8";
  const FEATURED_ID = "26.3";

  const CATEGORY_LABEL = {
    modern: "Modern",
    release: "Release",
    legacy: "Beta & Alpha",
    modded: "Modded",
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const byId = (id) => VERSIONS.find((v) => v.id === id);

  /* ---------- storage ---------- */
  const store = {
    get(key, fallback = null) {
      try {
        const raw = localStorage.getItem("quasoria:" + key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem("quasoria:" + key, JSON.stringify(value));
      } catch {
        /* storage unavailable (private mode etc.) */
      }
    },
  };

  /* ---------- helpers ---------- */
  function preferredRuntime(v) {
    const saved = store.get("rt:" + v.id);
    return v.runtimes.find((r) => r.id === saved) || v.runtimes[0];
  }

  function launchUrl(v, runtime = preferredRuntime(v)) {
    return runtime.slug
      ? `${ORIGIN}/play?version=${encodeURIComponent(runtime.slug)}`
      : `${ORIGIN}/play`;
  }

  /**
   * Load a version image from eaglercraft.com. Try the public file first, then the
   * Next.js image endpoint the site uses. If both fail, show a block-style placeholder.
   */
  function setArt(img, v) {
    const sources = [
      `${ORIGIN}/versions/${v.image}`,
      `${ORIGIN}/_next/image?url=${encodeURIComponent("/versions/" + v.image)}&w=1080&q=75`,
    ];
    let i = 0;
    const parent = img.parentElement;
    parent.querySelector(".fallback")?.remove();
    img.hidden = false;
    img.alt = `${v.name} artwork`;
    img.onerror = () => {
      i += 1;
      if (i < sources.length) {
        img.src = sources[i];
      } else {
        img.hidden = true;
        const fb = document.createElement("div");
        fb.className = "fallback";
        fb.textContent = v.short;
        parent.prepend(fb);
      }
    };
    img.src = sources[0];
  }

  let toastTimer;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
  }

  function launch(v, runtime = preferredRuntime(v)) {
    store.set("last", { id: v.id, runtime: runtime.id, at: Date.now() });
    store.set("rt:" + v.id, runtime.id);
    window.open(launchUrl(v, runtime), "_blank", "noopener");
    refreshLastPlayed();
    toast(`Launching ${v.name}…`);
  }

  /* ---------- grid ---------- */
  const state = { filter: "all", query: "" };
  const grid = $("#grid");

  function cardTemplate(v, index) {
    const last = store.get("last");
    const isLast = last && last.id === v.id;
    const runtimes = v.runtimes.length > 1 ? v.runtimes.map((r) => r.label === "WebAssembly" ? "WASM" : "JS").join(" · ") : "Browser";
    const el = document.createElement("button");
    el.type = "button";
    el.className = "card";
    el.style.animationDelay = `${index * 35}ms`;
    el.dataset.id = v.id;
    el.setAttribute("aria-label", `${v.name}: open details`);
    el.innerHTML = `
      <div class="card-art">
        <div class="card-badges">${v.badges.map((b) => `<span class="tag">${b}</span>`).join("")}</div>
        ${isLast ? `<span class="card-last">● Last played</span>` : ""}
        <img loading="lazy" alt="" />
      </div>
      <div class="card-body">
        <div class="card-top">
          <h3></h3>
          <span class="era"></span>
        </div>
        <p></p>
        <div class="card-foot">
          <span class="rt">${runtimes}</span>
          <span class="play" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14Z"/></svg>
          </span>
        </div>
      </div>`;
    $("h3", el).textContent = v.name;
    $(".era", el).textContent = v.era;
    $("p", el).textContent = v.description;
    setArt($("img", el), v);
    el.addEventListener("click", () => openSheet(v));
    return el;
  }

  function matches(v) {
    if (state.filter !== "all" && v.category !== state.filter) return false;
    if (!state.query) return true;
    const hay = [v.name, v.short, v.id, v.era, v.description, CATEGORY_LABEL[v.category], ...v.badges,
      ...v.runtimes.flatMap((r) => [r.label, r.slug || "", r.id])]
      .join(" ")
      .toLowerCase();
    return state.query
      .toLowerCase()
      .split(/\s+/)
      .every((term) => hay.includes(term));
  }

  function renderGrid() {
    const list = VERSIONS.filter(matches);
    grid.replaceChildren(...list.map(cardTemplate));
    $("#empty").hidden = list.length > 0;
  }

  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".chip").forEach((c) => {
        c.classList.toggle("active", c === chip);
        c.setAttribute("aria-selected", String(c === chip));
      });
      state.filter = chip.dataset.filter;
      renderGrid();
    });
  });

  const search = $("#search");
  search.addEventListener("input", () => {
    state.query = search.value.trim();
    renderGrid();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== search && !$("#sheet").open) {
      e.preventDefault();
      search.focus();
    }
  });

  /* ---------- detail sheet ---------- */
  const sheet = $("#sheet");
  let current = null;

  function selectedRuntime() {
    const checked = $('input[name="runtime"]:checked', sheet);
    return current.runtimes.find((r) => r.id === checked?.value) || current.runtimes[0];
  }

  function updateSheetUrl() {
    const url = launchUrl(current, selectedRuntime());
    $("#sheetUrl").textContent = url.replace(/^https:\/\//, "");
    $("#sheetLaunch").href = url;
  }

  function openSheet(v) {
    current = v;
    setArt($("#sheetImg"), v);
    $("#sheetName").textContent = v.name;
    $("#sheetDesc").textContent = v.description;
    $("#sheetCat").textContent = CATEGORY_LABEL[v.category] || v.category;
    $("#sheetEra").textContent = v.era;

    const pref = preferredRuntime(v);
    const opts = $("#runtimeOpts");
    opts.replaceChildren();
    $("#runtimeBox").hidden = v.runtimes.length < 2;
    v.runtimes.forEach((r) => {
      const label = document.createElement("label");
      label.className = "rt-opt";
      label.innerHTML = `<input type="radio" name="runtime" /><span><b></b><small></small></span>`;
      const input = $("input", label);
      input.value = r.id;
      input.checked = r.id === pref.id;
      input.addEventListener("change", () => {
        store.set("rt:" + v.id, r.id);
        updateSheetUrl();
      });
      $("b", label).textContent = r.label;
      $("small", label).textContent = r.note || "";
      opts.append(label);
    });

    updateSheetUrl();
    if (!sheet.open) sheet.showModal();
    history.replaceState(null, "", `#v/${v.id}`);
  }

  sheet.addEventListener("close", () => {
    if (location.hash.startsWith("#v/")) history.replaceState(null, "", location.pathname + location.search);
  });
  // close when clicking the backdrop
  sheet.addEventListener("click", (e) => {
    if (e.target === sheet) sheet.close();
  });

  $("#sheetLaunch").addEventListener("click", (e) => {
    e.preventDefault();
    launch(current, selectedRuntime());
    sheet.close();
  });

  $("#copyBtn").addEventListener("click", async () => {
    const url = launchUrl(current, selectedRuntime());
    try {
      await navigator.clipboard.writeText(url);
      toast("Link copied");
    } catch {
      window.prompt("Copy this link:", url);
    }
  });

  /* ---------- hero + last played ---------- */
  function refreshLastPlayed() {
    const last = store.get("last");
    const lastV = last && byId(last.id);
    const target = lastV || byId(DEFAULT_ID) || VERSIONS[0];

    $("#heroLaunchLabel").textContent = lastV ? `Continue ${target.short}` : `Play ${target.short}`;
    $("#heroLaunch").onclick = () => launch(target);

    const navBtn = $("#navContinue");
    navBtn.hidden = !lastV;
    if (lastV) {
      $("#navContinueLabel").textContent = `Continue ${lastV.short}`;
      navBtn.onclick = () => launch(lastV);
    }
    renderGrid();
  }

  function renderHero() {
    const f = byId(FEATURED_ID) || VERSIONS[0];
    setArt($("#heroImg"), f);
    $("#heroName").textContent = f.name;
    $("#heroDesc").textContent = f.description;
    $("#heroTag").textContent = f.badges[0] || "Featured";
    const card = $("#heroCard");
    card.onclick = () => openSheet(f);
    card.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openSheet(f);
      }
    };
  }

  function renderMeta() {
    const count = (c) => VERSIONS.filter((v) => v.category === c).length;
    $("#versionCount").textContent = VERSIONS.length;
    $("#statModern").textContent = count("modern");
    $("#statRelease").textContent = count("release");
    $("#statLegacy").textContent = count("legacy");
    if (SOURCE.url) $("#sourceLink").href = SOURCE.url;
    if (SOURCE.fetched) {
      const t = $("#sourceDate");
      t.dateTime = SOURCE.fetched;
      t.textContent = new Date(SOURCE.fetched + "T00:00:00").toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }
  }

  /* ---------- deep links: #v/<id> ---------- */
  function handleHash() {
    const m = location.hash.match(/^#v\/(.+)$/);
    const v = m && byId(decodeURIComponent(m[1]));
    if (v) openSheet(v);
  }
  window.addEventListener("hashchange", handleHash);

  renderMeta();
  renderHero();
  refreshLastPlayed();
  handleHash();
})();
