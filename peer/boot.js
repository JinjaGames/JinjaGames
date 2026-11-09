/* Anti-framing. A meta CSP cannot carry frame-ancestors and GitHub Pages sets no headers, so a page that
   is embedded in someone else's frame leaves it, or (if the frame forbids that) hides itself. */
(function () {
  try { if (window.top === window.self) return; } catch (e) { /* cross-origin top: framed */ }
  try { window.top.location.href = window.self.location.href; } catch (e) { /* sandboxed */ }
  document.documentElement.style.display = 'none';
})();
/* Runs before first paint: theme + language (same keys as the rest of jinjagames.com). */
(function () {
  var d = document.documentElement;
  try {
    var t = localStorage.getItem('jg_theme');
    if (t !== 'light' && t !== 'dark') t = (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    d.setAttribute('data-theme', t);
  } catch (e) { d.setAttribute('data-theme', 'light'); }
  var l = null;
  try { l = localStorage.getItem('jg_lang'); } catch (e) {}
  if (l !== 'tr' && l !== 'en') l = /^tr\b/i.test((navigator.language || (navigator.languages && navigator.languages[0]) || '')) ? 'tr' : 'en';
  d.setAttribute('data-lang', l); d.lang = l;
})();
