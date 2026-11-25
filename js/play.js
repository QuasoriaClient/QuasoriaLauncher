/*
 * Player: boots one build in an iframe.
 *  - "page" mirrors (GitHub Pages) are embedded directly.
 *  - "raw" mirrors are streamed from raw.githubusercontent.com with a progress bar,
 *    cached with the Cache API, and booted from a same-origin blob: URL so worlds
 *    persist in this site's storage.
 */
(() => {
  "use strict";
  const S = window.QStore;
  const $ = (s) => document.querySelector(s);
  const CACHE = "quasoria-builds-v1";

  const q = new URLSearchParams(location.search);
  const entry = S.byId.get(q.get("id") || "");
  const frame = $("#game");
  const loader = $("#loader");

  if (!entry) {
    showError("Unknown build", "That build isn't in the catalog. It may have been renamed.", false);
    return;
  }

  let rt = S.runtimesOf(entry).includes(q.get("rt")) ? q.get("rt") : S.preferredRuntime(entry);
  let mi = Math.max(0, Math.min(Number(q.get("m") || 0), entry.runtimes[rt].length - 1));
  let blobUrl = null;
  let abort = null;

  document.title = `${entry.title} · Quasoria`;
  $("#pTitle").textContent = entry.title;

  /* ------------------------------------------------ controls */
  function fillControls() {
    const rts = S.runtimesOf(entry);
    const rsel = $("#pRuntime");
    rsel.innerHTML = rts.map((r) => `<option value="${r}" ${r === rt ? "selected" : ""}>${r === "wasm" ? "WebAssembly" : "JavaScript"}</option>`).join("");
    rsel.parentElement.hidden = rts.length < 2;
    const msel = $("#pMirror");
    msel.innerHTML = entry.runtimes[rt]
      .map((m, i) => `<option value="${i}" ${i === mi ? "selected" : ""}>${S.sourceById.get(m.s)?.name || m.s}${m.b ? " · " + S.fmtBytes(m.b) : ""}</option>`)
      .join("");
    msel.parentElement.hidden = entry.runtimes[rt].length < 2;
  }
  $("#pRuntime").onchange = (e) => {
    rt = e.target.value;
    mi = 0;
    S.ls.set("rt:" + entry.id, rt);
    boot();
  };
  $("#pMirror").onchange = (e) => {
    mi = Number(e.target.value);
    boot();
  };
  $("#pReload").onclick = () => boot();
  $("#lNext").onclick = () => nextMirror();
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

  /* ------------------------------------------------ loader UI */
  function setLoader(title, msg) {
    loader.hidden = false;
    loader.classList.remove("error");
    $("#lActions").hidden = true;
    $("#lTitle").textContent = title;
    $("#lMsg").textContent = msg;
  }
  function setProgress(done, total, from) {
    const p = $("#lProg");
    p.hidden = false;
    const pct = total ? Math.min(100, (done / total) * 100) : 0;
    $("#lBar").style.width = pct.toFixed(1) + "%";
    p.classList.toggle("indeterminate", !total);
    $("#lStats").textContent = `${S.fmtBytes(done)}${total ? " / " + S.fmtBytes(total) : ""} · ${from}`;
  }
  function showError(title, msg, canRetry = true) {
    loader.hidden = false;
    loader.classList.add("error");
    $("#lTitle").textContent = title;
    $("#lMsg").textContent = msg;
    $("#lProg").hidden = true;
    $("#lActions").hidden = false;
    $("#lNext").hidden = !canRetry || !hasNext();
  }
  function hideLoader() {
    loader.hidden = true;
    peek();
  }

  function hasNext() {
    return mi < entry.runtimes[rt].length - 1 || S.runtimesOf(entry).some((r) => r !== rt);
  }
  function nextMirror() {
    if (mi < entry.runtimes[rt].length - 1) mi++;
    else {
      const other = S.runtimesOf(entry).find((r) => r !== rt);
      if (!other) return;
      rt = other;
      mi = 0;
    }
    boot();
  }

  /* ------------------------------------------------ boot */
  async function boot() {
    abort?.abort();
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    blobUrl = null;
    frame.removeAttribute("src");
    fillControls();

    const m = entry.runtimes[rt][mi];
    const src = S.sourceById.get(m.s);
    $("#pSub").textContent = `${rt.toUpperCase()} · ${src?.name || m.s}`;
    $("#pPop").href = m.k === "page" ? m.u : location.href;
    history.replaceState(null, "", `?id=${encodeURIComponent(entry.id)}&rt=${rt}${mi ? "&m=" + mi : ""}`);
    S.pushRecent(entry.id, rt);
    $("#lStats").textContent = "";
    $("#lProg").hidden = true;

    if (m.k === "page") {
      setLoader("Opening a wormhole…", `Connecting to ${S.hostOf(m.u)}`);
      frame.onload = () => {
        hideLoader();
        frame.focus();
      };
      frame.src = m.u;
      // Cross-origin frames don't report errors, so offer an escape hatch if it's slow
      setTimeout(() => {
        if (!loader.hidden && frame.getAttribute("src") === m.u) {
          $("#lActions").hidden = false;
          $("#lNext").hidden = !hasNext();
          $("#lMsg").textContent = "Still connecting. You can wait, or try another mirror.";
        }
      }, 15000);
      return;
    }

    // raw: stream -> cache -> blob
    setLoader("Receiving transmission…", `Streaming from ${src?.name || "GitHub"}`);
    abort = new AbortController();
    try {
      const blob = await fetchBuild(m, abort.signal);
      blobUrl = URL.createObjectURL(blob);
      $("#lTitle").textContent = "Igniting core…";
      $("#lMsg").textContent = "Booting the game";
      frame.onload = () => {
        hideLoader();
        frame.focus();
      };
      frame.src = blobUrl;
    } catch (err) {
      if (err.name === "AbortError") return;
      console.error(err);
      if (hasNext()) {
        $("#lMsg").textContent = `That mirror failed (${err.message}). Trying the next one…`;
        setTimeout(nextMirror, 900);
      } else {
        showError("Signal lost", `Couldn't download this build: ${err.message}`);
      }
    }
  }

  async function fetchBuild(m, signal) {
    let cache = null;
    try {
      cache = await caches.open(CACHE);
      const hit = await cache.match(m.u);
      if (hit) {
        setProgress(m.b, m.b, "cached");
        const b = await hit.blob();
        return new Blob([b], { type: "text/html" });
      }
    } catch {
      cache = null; // Cache API unavailable (e.g. insecure context)
    }

    const res = await fetch(m.u, { signal, mode: "cors" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const total = m.b || Number(res.headers.get("content-length")) || 0;
    const reader = res.body.getReader();
    const chunks = [];
    let done = 0;
    const t0 = performance.now();
    for (;;) {
      const { value, done: end } = await reader.read();
      if (end) break;
      chunks.push(value);
      done += value.byteLength;
      const secs = (performance.now() - t0) / 1000;
      setProgress(done, total, `${S.fmtBytes(done / Math.max(secs, 0.1))}/s`);
    }
    // tiny responses are almost certainly an error page or LFS pointer, not a game
    if (done < 2048) throw new Error("mirror returned an empty file");
    const blob = new Blob(chunks, { type: "text/html" });
    if (cache) cache.put(m.u, new Response(blob, { headers: { "content-type": "text/html" } })).catch(() => {});
    return blob;
  }

  boot();
})();
