/* Açık / koyu tema: kayıtlı tercih sayfa çizilmeden uygulanır (koyu → açık yanıp sönmesin). Varsayılan koyu. */
(function () {
  try {
    var t = localStorage.getItem("jqTheme"); // JSON olarak saklanır: "\"light\""
    if (t !== "\"light\"" && t !== "light") return;
    document.documentElement.dataset.theme = "light";
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute("content", "#f6f3ee");
  } catch (e) {}
})();
