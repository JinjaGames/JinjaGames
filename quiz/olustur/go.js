// Eski /quiz/olustur/ adresi: parametreleri İngilizce karşılıklarıyla yeni adrese taşır.
var q = new URLSearchParams(location.search), n = new URLSearchParams();
if (q.get("duzenle")) n.set("edit", q.get("duzenle"));
if (q.get("tur")) n.set("type", q.get("tur"));
location.replace("/quiz/create/" + (n.toString() ? "?" + n : "") + location.hash);
