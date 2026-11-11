// Applies the saved theme before first paint so there is no flash and no wrong-theme frame.
// Loaded as a blocking same-origin script (allowed by CSP `script-src 'self'`; no inline script needed).
(function () {
  try {
    var pref = localStorage.getItem("lt:theme") || "system";
    var dark = pref === "vault" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    var root = document.documentElement;
    root.classList.toggle("dark", dark);
    root.setAttribute("data-theme", dark ? "vault" : "paper");
    if (localStorage.getItem("lt:density") === "compact") root.setAttribute("data-density", "compact");
  } catch (e) {
    /* storage blocked: fall back to the default Pearl theme */
  }
})();
