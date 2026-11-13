/**
 * Theme for dmitry.popov.engineer
 *
 * The palette follows the visitor's local clock:
 *   10:00 – 21:59  → light
 *   22:00 – 09:59  → dark
 *
 * Runs synchronously in <head>, before the stylesheet, so the right palette is
 * applied before the first paint. A one-minute timer re-checks the boundary so
 * a tab left open across it switches by itself.
 */
(function () {
  "use strict";

  var LIGHT_FROM_HOUR = 10; // inclusive
  var LIGHT_UNTIL_HOUR = 22; // exclusive
  var THEME_COLORS = { light: "#ffffff", dark: "#0d1117" };

  function resolve() {
    var hour = new Date().getHours();
    return hour >= LIGHT_FROM_HOUR && hour < LIGHT_UNTIL_HOUR
      ? "light"
      : "dark";
  }

  function apply(theme) {
    document.documentElement.dataset.theme = theme;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute("content", THEME_COLORS[theme] || THEME_COLORS.dark);
    }
  }

  // Preferences stored by the earlier, toggle-based builds are no longer used.
  try {
    localStorage.removeItem("theme");
    localStorage.removeItem("theme-version");
  } catch (e) {
    /* storage blocked: nothing to clean up */
  }

  apply(resolve());

  setInterval(function () {
    var next = resolve();
    if (next !== document.documentElement.dataset.theme) apply(next);
  }, 60 * 1000);
})();
