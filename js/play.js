/*
 * Player: boots one build in an iframe.
 * Every build is stored on this site in builds/<id>/, so the game loads from the same
 * origin as the launcher. Nothing is fetched from other hosts, and worlds and settings
 * are saved in this site's storage.
 */
(() => {
  "use strict";
  const S = window.QStore;
  const $ = (s) => document.querySelector(s);

  const q = new URLSearchParams(location.search);
  const entry = S.byId.get(q.get("id") || "");
  const frame = $("#game");
  const loader = $("#loader");

  /* ------------------------------------------------ loader UI */
  function setLoader(title, msg) {
    loader.hidden = false;
    loader.classList.remove("error");
    $("#lActions").hidden = true;
    $("#lTitle").textContent = title;
    $("#lMsg").textContent = msg;
  }
  function showError(title, msg, canRetry = true) {
    loader.hidden = false;
    loader.classList.add("error");
    $("#lTitle").textContent = title;
    $("#lMsg").textContent = msg;
    $("#lProg").hidden = true;
    $("#lStats").textContent = "";
    $("#lActions").hidden = false;
    $("#lRetry").hidden = !canRetry;
  }
  function hideLoader() {
    loader.hidden = true;
    peek();
  }

  if (!entry) {
    $("#pTitle").textContent = "Unknown build";
    showError("Unknown build", "That build isn't in the catalog. It may have been renamed.", false);
    return;
  }

  const url = S.buildUrl(entry);
  const src = S.sourceById.get(entry.from);
  document.title = `${entry.title} · Quasoria`;
  $("#pTitle").textContent = entry.title;
  $("#pSub").textContent = `${entry.rt.toUpperCase()} · ${S.fmtBytes(entry.size)}`;
  $("#pPop").href = url;

  /* ------------------------------------------------ controls */
  $("#pReload").onclick = () => boot();
  $("#lRetry").onclick = () => boot();
  $("#pFull").onclick = () => {
    const el = $("#stage");
    if (document.fullscreenElement) document.exitFullscreen();
    else (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
  };

  // auto-hide the top bar while playing; reveal when the pointer nears the top
  let hideT;
  function peek() {
    document.body.classList.remove("bar-hidden");
    clearTimeout(hideT);
    hideT = setTimeout(() => {
      if (!loader.hidden) return;
      document.body.classList.add("bar-hidden");
    }, 2500);
  }
  document.addEventListener("pointermove", (e) => {
    if (e.clientY < 70) peek();
  });
  $("#pbar").addEventListener("pointerenter", peek);

  /* ------------------------------------------------ boot */
  async function boot() {
    frame.removeAttribute("src");
    S.pushRecent(entry.id);
    setLoader("Igniting core…", `Loading ${entry.title} from this site`);
    $("#lProg").hidden = false;
    $("#lProg").classList.add("indeterminate");
    $("#lStats").textContent = `${S.fmtBytes(entry.size)} · ${entry.rt === "wasm" ? "WebAssembly" : "JavaScript"} · kept from ${src?.name || entry.from}`;

    if (entry.rt === "wasm" && !S.wasmReady()) {
      $("#lMsg").textContent = "Heads up: this WebAssembly build needs Chrome or Edge 137+ (WASM-GC and JSPI). Trying anyway…";
    }

    // make sure the stored copy is actually there before handing it to the iframe,
    // so a missing file shows a clear message instead of a blank 404 page
    try {
      const res = await fetch(url, { method: "HEAD", cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      // file:// pages can't HEAD; let the iframe try anyway
      if (location.protocol !== "file:") {
        showError("Signal lost", `This build's files are missing from builds/${entry.id}/ (${err.message}).`);
        return;
      }
    }

    frame.onload = () => {
      hideLoader();
      frame.focus();
    };
    frame.src = url;
  }

  boot();
})();
