import { createFileRoute } from "@tanstack/react-router";

// GET /api/public/v1/identity.embed.js
// Tiny embeddable widget: renders a badge with the site's HN group ID and a
// "connect" button that signals the Hub (which relays to TVCC).

const SCRIPT = `(function () {
  var HUB = "https://hnsrv1.lovable.app";
  function boot() {
    var nodes = document.querySelectorAll("[data-hn-id]");
    for (var i = 0; i < nodes.length; i++) render(nodes[i]);
  }
  function render(el) {
    if (el.getAttribute("data-hn-ready") === "1") return;
    el.setAttribute("data-hn-ready", "1");
    var code = (el.getAttribute("data-hn-id") || "").toUpperCase();
    el.style.cssText = "display:inline-flex;align-items:center;gap:8px;font-family:system-ui,sans-serif;font-size:13px;border:1px solid rgba(127,127,127,.35);border-radius:9999px;padding:6px 10px";
    var label = document.createElement("span");
    label.textContent = "HN " + code;
    label.style.cssText = "font-weight:600;letter-spacing:.5px";
    var state = document.createElement("span");
    state.style.cssText = "opacity:.7";
    var btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "اتصال";
    btn.style.cssText = "cursor:pointer;border:0;border-radius:9999px;padding:4px 12px;background:#111;color:#fff;font-size:12px";
    btn.onclick = function () {
      btn.disabled = true;
      state.textContent = "جارٍ الاتصال...";
      fetch(HUB + "/api/public/v1/identity/announce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code, origin: location.origin })
      })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d && d.ok) {
            state.textContent = "متصل ✓";
            btn.style.display = "none";
            el.dispatchEvent(new CustomEvent("hn:connected", { detail: d, bubbles: true }));
          } else {
            state.textContent = "فشل: " + ((d && d.error) || "unknown");
            btn.disabled = false;
          }
        })
        .catch(function () {
          state.textContent = "تعذّر الاتصال";
          btn.disabled = false;
        });
    };
    el.appendChild(label);
    el.appendChild(btn);
    el.appendChild(state);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();`;

export const Route = createFileRoute("/api/public/v1/identity/embed.js")({
  server: {
    handlers: {
      GET: async () =>
        new Response(SCRIPT, {
          status: 200,
          headers: {
            "Content-Type": "application/javascript; charset=utf-8",
            "Cache-Control": "public, max-age=300",
            "Access-Control-Allow-Origin": "*",
          },
        }),
    },
  },
});
