/**
 * Theme boot for dmitry.popov.engineer
 *
 * Loaded synchronously in <head>, before the stylesheet, so the palette is
 * resolved before the first paint — no flash of the default dark theme.
 *
 * Preferences: "auto" (follow the OS), "light", "dark".
 * Writes <html data-theme> (resolved) and <html data-theme-pref> (chosen).
 * Runtime switching lives in assets/terminal.js.
 */
(function () {
  "use strict";

  var pref = "auto";
  try {
    pref = localStorage.getItem("theme") || "auto";
  } catch (e) {
    /* storage unavailable (private mode): fall back to the OS preference */
  }
  if (pref !== "light" && pref !== "dark") pref = "auto";

  var prefersLight =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: light)").matches;

  var root = document.documentElement;
  root.dataset.theme = pref === "auto" ? (prefersLight ? "light" : "dark") : pref;
  root.dataset.themePref = pref;
})();
