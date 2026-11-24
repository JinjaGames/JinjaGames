/* JinjaGames ziyaret sayacı (GoatCounter, çerezsiz).
   - Çerez yok, kişisel veri yok, IP saklanmaz; yalnızca sayfa, yönlendiren site ve ekran boyutu sayılır.
   - "Do Not Track" ya da Global Privacy Control açık olan tarayıcılar sayılmaz.
   - Ziyaretçi /privacy/ sayfasından bu cihazda saymayı kapatabilir (localStorage "jg_noanalytics").
   - Steam, Google Play, GitHub ve e-posta bağlantılarına tıklamalar olay olarak sayılır (hangi ürüne gidildiği).
   - Site içi bağlantı tıklamaları ("nav:/nereden>/nereye") ve sayfada kalma süresi ("time:/sayfa|kova", ör. 1-3m) da olay olarak sayılır.
     Süre kişiye bağlanmaz; yalnızca kaba bir aralık gönderilir. JinjaDashboard bu olayları okur.
   CODE boşken hiçbir şey yapmaz. */
(function () {
  var CODE = "jinjagames"; // GoatCounter kod adı, ör. "jinjagames" → https://jinjagames.goatcounter.com
  if (!CODE || !/^[a-z0-9-]+$/.test(CODE)) return;
  try {
    if (localStorage.getItem("jg_noanalytics") === "1") return;
    if (navigator.doNotTrack === "1" || window.doNotTrack === "1" || navigator.globalPrivacyControl) return;
  } catch (e) {}
  if (!/^(www\.)?jinjagames\.com$/.test(location.hostname)) return; // yerel denemeleri sayma
  var END = "https://" + CODE + ".goatcounter.com/count";
  function send(path, title, ref, event) {
    var q = "p=" + encodeURIComponent(path) + "&t=" + encodeURIComponent(title || "") + "&r=" + encodeURIComponent(ref || "") +
      (event ? "&e=true" : "&s=" + encodeURIComponent(screen.width + "," + screen.height + "," + (window.devicePixelRatio || 1))) + "&rnd=" + Math.random().toString(36).slice(2);
    var img = new Image();
    img.referrerPolicy = "no-referrer-when-downgrade";
    img.src = END + "?" + q;
  }
  function page() {
    var ref = document.referrer && document.referrer.indexOf(location.origin) !== 0 ? document.referrer : "";
    send(location.pathname, document.title, ref, false);
  }
  if (document.visibilityState === "prerender") document.addEventListener("visibilitychange", page, { once: true });
  else page();
  // dışarı giden tıklamalar: mağazalara geçiş
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    var h = a.href, name = "";
    if (/store\.steampowered\.com\/app\/(\d+)(?:\/([^/?#]+))?/.test(h)) name = "steam/" + (RegExp.$2 || RegExp.$1);
    else if (/play\.google\.com\/store\/apps\/details\?id=([\w.]+)/.test(h)) name = "google-play/" + RegExp.$1;
    else if (/github\.com\/JinjaGames\/?([\w.-]*)/i.test(h)) name = "github/" + (RegExp.$1 || "org");
    else if (/^mailto:/.test(h)) name = "email/" + (decodeURIComponent((h.split("subject=")[1] || "").split("&")[0]) || "contact").slice(0, 40);
    else if (/curseforge\.com/.test(h)) name = "curseforge";
    if (name) send("out/" + name, "Çıkış: " + name + " (" + location.pathname + ")", location.pathname, true);
    else if (a.origin === location.origin && a.pathname !== location.pathname) // site içi geçiş: nereden > nereye
      send("nav:" + location.pathname + ">" + a.pathname, "Site içi: " + location.pathname + " → " + a.pathname, location.pathname, true);
  }, true);
  // sayfada kalma süresi: yalnız sekme görünürken geçen süre, sayfadan ayrılırken bir kez ve kova olarak gönderilir
  var shown = document.visibilityState === "visible" ? Date.now() : 0, spent = 0, sentTime = false;
  function bucket(s) { return s < 10 ? "0-10s" : s < 30 ? "10-30s" : s < 60 ? "30-60s" : s < 180 ? "1-3m" : s < 600 ? "3-10m" : "10m+"; }
  function flushTime() {
    if (shown) { spent += Date.now() - shown; shown = 0; }
    if (sentTime || spent < 1000) return;
    sentTime = true;
    var p = "time:" + location.pathname + "|" + bucket(spent / 1000);
    var q = "p=" + encodeURIComponent(p) + "&t=" + encodeURIComponent("Süre: " + location.pathname) + "&e=true&rnd=" + Math.random().toString(36).slice(2);
    try { if (navigator.sendBeacon && navigator.sendBeacon(END + "?" + q)) return; } catch (e) {}
    send(p, "Süre: " + location.pathname, location.pathname, true);
  }
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") { if (!sentTime) shown = Date.now(); }
    else flushTime();
  });
  window.addEventListener("pagehide", flushTime);
})();
