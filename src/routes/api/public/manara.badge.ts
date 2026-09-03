import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/public/manara/badge
 *
 * Serves the embeddable Manara badge script. Any site in the HN group adds:
 *
 *   <script src="https://<hub>/api/public/manara/badge" data-key="A000000"></script>
 *
 * The script renders a small Manara (lighthouse) badge fixed to the corner of
 * the page and links it back to the hub's Manara page for that group ID.
 */

const BADGE_JS = `(function () {
  if (window.__manaraBadge) return;
  window.__manaraBadge = true;

  var script = document.currentScript || (function () {
    var s = document.getElementsByTagName("script");
    return s[s.length - 1];
  })();
  var key = (script && script.getAttribute("data-key") || "").trim();
  var hub = "";
  try { hub = new URL(script.src).origin; } catch (e) { hub = "https://cour.hnapps.store"; }
  var target = hub + "/manara" + (key ? "?ref=" + encodeURIComponent(key) : "");

  var a = document.createElement("a");
  a.href = target;
  a.target = "_blank";
  a.rel = "noopener";
  a.setAttribute("aria-label", "Manara - HN Group");
  a.style.cssText =
    "position:fixed;bottom:16px;left:16px;z-index:99999;display:flex;align-items:center;gap:8px;" +
    "padding:8px 14px;border-radius:9999px;background:rgba(10,12,20,0.85);color:#f5d76e;" +
    "font:600 12px/1 system-ui,sans-serif;text-decoration:none;border:1px solid rgba(245,215,110,0.4);" +
    "box-shadow:0 0 18px rgba(245,215,110,0.35);backdrop-filter:blur(6px);transition:transform .2s,box-shadow .2s;";
  a.onmouseenter = function () { a.style.transform = "scale(1.06)"; a.style.boxShadow = "0 0 28px rgba(245,215,110,0.6)"; };
  a.onmouseleave = function () { a.style.transform = "scale(1)"; a.style.boxShadow = "0 0 18px rgba(245,215,110,0.35)"; };

  var svg =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f5d76e" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M12 2v3"/><path d="M5 5l2 2"/><path d="M19 5l-2 2"/>' +
    '<path d="M9 22l1-11h4l1 11z" fill="rgba(245,215,110,0.15)"/>' +
    '<path d="M10 8h4"/><circle cx="12" cy="7" r="1.4" fill="#f5d76e"/>' +
    '<path d="M7 22h10"/></svg>';

  a.innerHTML = svg + "<span>MANARA" + (key ? " · " + key.replace(/</g, "") : "") + "</span>";

  function mount() { document.body.appendChild(a); }
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();
`;

export const Route = createFileRoute("/api/public/manara/badge")({
  server: {
    handlers: {
      GET: async () =>
        new Response(BADGE_JS, {
          headers: {
            "Content-Type": "application/javascript; charset=utf-8",
            "Cache-Control": "public, max-age=300",
            "Access-Control-Allow-Origin": "*",
            "Cross-Origin-Resource-Policy": "cross-origin",
          },
        }),
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
          },
        }),
    },
  },
});
