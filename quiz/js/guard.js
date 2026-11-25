/* Başka bir sitenin JinjaQuiz'i görünmez bir çerçeveye gömüp kullanıcıya istemediği tıklamaları yaptırmasını
   (clickjacking) önler. Meta CSP frame-ancestors taşıyamaz ve GitHub Pages başlık koyamaz; bu yüzden sayfa,
   başka bir sitenin çerçevesi içindeyse oradan çıkar ya da (çıkamıyorsa) kendini gizler. */
(function () {
  try { if (window.top === window.self || window.top.location.origin === location.origin) return; } catch (e) { /* farklı site: çerçevede */ }
  try { window.top.location.href = window.self.location.href; } catch (e) { /* sandbox */ }
  document.documentElement.style.display = 'none';
})();
