// Deezer JSONP, isolated in a sandboxed iframe (see catalog.html). Only whitelisted API paths are requested.
(function () {
  'use strict';
  var seq = 0;
  var PATH = /^(search\/artist|search\/track|artist\/\d{1,12}(\/top)?|track\/\d{1,14})$/;
  function reply(id, ok, payload) {
    // The parent's origin is unknown to an opaque frame; the data is public catalog JSON.
    parent.postMessage({ dz: 1, id: id, ok: ok, data: ok ? payload : undefined, error: ok ? undefined : String(payload) }, '*');
  }
  addEventListener('message', function (e) {
    if (e.source !== parent) return;
    var m = e.data;
    if (!m || m.dz !== 1 || typeof m.id !== 'number' || typeof m.path !== 'string' || !PATH.test(m.path)) return;
    var params = new URLSearchParams();
    var src = m.params && typeof m.params === 'object' ? m.params : {};
    Object.keys(src).forEach(function (k) { if (/^(q|limit|index)$/.test(k)) params.set(k, String(src[k]).slice(0, 120)); });
    var cb = '__dz' + Date.now().toString(36) + (seq++);
    params.set('output', 'jsonp'); params.set('callback', cb);
    var s = document.createElement('script');
    var timer = setTimeout(function () { done(); reply(m.id, false, 'timeout'); }, 9000);
    function done() { clearTimeout(timer); try { delete window[cb]; } catch (x) { window[cb] = undefined; } s.remove(); }
    window[cb] = function (data) {
      done();
      // Round-trip through JSON so nothing but plain data (no functions, no DOM) is posted.
      var clean;
      try { clean = JSON.parse(JSON.stringify(data)); } catch (x) { return reply(m.id, false, 'bad data'); }
      if (clean && clean.error) reply(m.id, false, 'api'); else reply(m.id, true, clean);
    };
    s.onerror = function () { done(); reply(m.id, false, 'network'); };
    s.src = 'https://api.deezer.com/' + m.path + '?' + params;
    document.head.appendChild(s);
  });
  parent.postMessage({ dz: 1, ready: true }, '*');
})();
