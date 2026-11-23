/* Uzun sayfalarda sağ altta "başa dön" düğmesi. Biraz aşağı inince belirir, dokununca en üste kaydırır.
   Stil satır içi atanır (CSP'de ayrı stil dosyası gerekmez); her temada okunur: koyu yarı saydam zemin, beyaz ok. */
(function () {
  var b = document.createElement('button');
  b.type = 'button';
  b.setAttribute('aria-label', 'Sayfanın başına dön');
  b.title = 'Başa dön';
  b.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 14 6-6 6 6"/></svg>';
  var s = b.style;
  s.position = 'fixed'; s.right = '16px'; s.bottom = '18px'; s.zIndex = '60';
  s.width = '48px'; s.height = '48px'; s.borderRadius = '50%'; s.border = '1px solid rgba(255,255,255,.3)';
  s.background = 'rgba(22,18,44,.78)'; s.boxShadow = '0 10px 28px rgba(0,0,0,.35)'; s.cursor = 'pointer';
  s.display = 'grid'; s.placeItems = 'center'; s.padding = '0';
  s.backdropFilter = 'blur(8px)'; s.webkitBackdropFilter = 'blur(8px)';
  s.opacity = '0'; s.transform = 'translateY(14px)'; s.pointerEvents = 'none';
  s.transition = 'opacity .25s, transform .25s';
  b.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
  // telefondaki alt menünün (dock) üstüne otur
  function lift() {
    var d = document.querySelector('.dock'), r = d && d.getBoundingClientRect();
    s.bottom = r && r.height && getComputedStyle(d).display !== 'none' && r.top < window.innerHeight ? (window.innerHeight - r.top + 12) + 'px' : '18px';
  }
  function upd() {
    lift();
    var on = window.scrollY > 900;
    s.opacity = on ? '1' : '0'; s.transform = on ? 'none' : 'translateY(14px)'; s.pointerEvents = on ? 'auto' : 'none';
  }
  function add() { document.body.appendChild(b); upd(); }
  window.addEventListener('scroll', upd, { passive: true });
  window.addEventListener('resize', upd);
  if (document.body) add(); else document.addEventListener('DOMContentLoaded', add);
})();
