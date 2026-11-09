/* Web Apps menüsü: tıkla aç/kapa, fareyle üstüne gelince aç, Esc ve dışarı tıklama kapatır. */
(function () {
  'use strict';
  var menus = document.querySelectorAll('.apps-menu');
  Array.prototype.forEach.call(menus, function (m) {
    var btn = m.querySelector('.apps-trigger'), pop = m.querySelector('.apps-pop'), t = 0, viaHover = false;
    if (!btn || !pop) return;
    function set(open) {
      m.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    btn.addEventListener('click', function (e) { e.stopPropagation(); if (viaHover) { viaHover = false; set(true); return; } set(!m.classList.contains('open')); });
    var fine = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (fine) {
      m.addEventListener('mouseenter', function () { clearTimeout(t); if (!m.classList.contains('open')) viaHover = true; set(true); });
      m.addEventListener('mouseleave', function () { clearTimeout(t); t = setTimeout(function () { viaHover = false; set(false); }, 180); });
    }
    document.addEventListener('click', function (e) { if (!m.contains(e.target)) set(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && m.classList.contains('open')) { set(false); btn.focus(); } });
    m.addEventListener('focusout', function (e) { if (!m.contains(e.relatedTarget)) set(false); });
  });
})();
