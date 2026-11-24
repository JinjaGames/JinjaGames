// İki doğum haritasının karşılaştırması (sinastri): açılar, ev yerleşimleri, puanlar ve yorum metinleri.
import * as E from "./ephem.js?v=14";

// Çift anahtarı: gezegenler bu sırada dizilir (yükselen en sonda)
export const BODIES = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "asc"];
export const BODY_NAME = { sun: "Güneş", moon: "Ay", mercury: "Merkür", venus: "Venüs", mars: "Mars", jupiter: "Jüpiter", saturn: "Satürn", asc: "Yükselen" };
const key = (a, b) => [a, b].sort((x, y) => BODIES.indexOf(x) - BODIES.indexOf(y)).join("-");

// Her çift için üç hâl: c = kavuşum, h = uyumlu (üçgen, altmışlık), t = gergin (kare, karşıt)
export const PAIR = {
  "sun-sun": { c: "Kimlikleriniz ve hedefleriniz çok benzer; aynı şeylere heyecanlanırsınız. Ama ikiniz de sahnenin ortasını isteyebilirsiniz.", h: "Kim olduğunuzu birbirinize anlatmanız gerekmiyor; birbirinizin hedeflerini doğal olarak desteklersiniz.", t: "Hayattan istedikleriniz farklı yönlere çekebilir. Bu fark, birbirinize alan açtığınızda ilişkiyi zenginleştirir." },
  "sun-moon": { c: "Klasik bir ruh eşi bağı: birinin kimliği, ötekinin duygusal ihtiyaçlarıyla birebir buluşuyor. Birlikteyken evinizde gibi hissedersiniz.", h: "Biri yön verir, öteki duygusal yuva olur. Uzun ilişkiler için en güçlü göstergelerden biri.", t: "Biri ilerlemek isterken öteki güvende hissetmek istiyor. Birbirinizin ritmine sabır gösterirseniz bu gerilim derin bir bağa dönüşür." },
  "sun-mercury": { c: "Biri konuştuğunda öteki tam olarak anlıyor; fikirleriniz birbirini besliyor.", h: "Sohbetleriniz akıcı ve keyifli; birbirinize iyi fikir verirsiniz.", t: "Konuşma tarzlarınız çatışabilir; biri hızlı, öteki dikkatli. Dinlemeye vakit ayırın." },
  "sun-venus": { c: "Birinin varlığı ötekine sevgi ve hayranlık uyandırıyor. Romantik ve sıcak bir bağ.", h: "Birbirinizi güzel bulursunuz; birlikte zaman geçirmek ikinize de keyif verir.", t: "Çekim var ama değerleriniz ve zevkleriniz her zaman örtüşmeyebilir. Küçük jestler arayı yumuşatır." },
  "sun-mars": { c: "Yoğun bir enerji ve çekim. Birlikte çok şey başarabilirsiniz ama rekabet de kıvılcım çıkarır.", h: "Birbirinizi harekete geçirirsiniz; ortak projelerde ve sporda harika bir ekipsiniz.", t: "Tutku ve sinir aynı kaynaktan geliyor. Tartışmaları kişiselleştirmemek önemli." },
  "sun-jupiter": { c: "Biri ötekini büyütüyor, cesaretlendiriyor. Birlikteyken şanslı ve iyimser hissedersiniz.", h: "Cömert ve destekleyici bir bağ; birbirinizin en iyi hâlini ortaya çıkarırsınız.", t: "Bazen birbirinizi aşırıya kaçmaya teşvik edebilirsiniz; büyük sözler yerine somut adımlar." },
  "sun-saturn": { c: "Ciddi ve kalıcı bir bağ; biri ötekine sorumluluk ve yapı kazandırıyor. Bazen ağır da gelebilir.", h: "Uzun vadeli ilişkilerin işaretlerinden: sadakat, güven ve birlikte inşa etme.", t: "Biri ötekini kısıtlıyor ya da eleştiriyor gibi hissedebilir. Takdiri dile getirmek dengeyi kurar." },
  "moon-moon": { c: "Duygusal ritminiz aynı; birbirinizin ruh hâlini sözsüz anlarsınız.", h: "Duygusal ihtiyaçlarınız uyumlu; birlikte rahat ve huzurlu hissedersiniz.", t: "Duygularınızı farklı yaşıyorsunuz; biri konuşmak isterken öteki yalnız kalmak isteyebilir." },
  "moon-mercury": { c: "Duygularınızı kolayca konuşabilirsiniz; biri hissettiğini söylediğinde öteki anlıyor.", h: "Birbirinizi dinlemek kolay; dertleşmek ve gülmek ilişkinizin parçası.", t: "Biri mantıkla, öteki duyguyla yaklaşabilir. 'Haklı olmak' yerine 'anlamak' hedef olsun." },
  "moon-venus": { c: "Çok tatlı ve şefkatli bir bağ; birbirinize iyi bakmayı seversiniz.", h: "Sevgi dilleriniz uyumlu; birlikte huzur ve güzellik yaratırsınız.", t: "Sevgi göstermeyi farklı biçimlerde bekliyorsunuz. Ne istediğinizi açıkça söyleyin." },
  "moon-mars": { c: "Duygusal ve fiziksel olarak yoğun bir bağ. Tutku yüksek ama alınganlık da.", h: "Biri ötekini korur ve harekete geçirir; sıcak ve canlı bir ilişki.", t: "Biri sert davrandığında öteki derinden incinebilir. Öfke anında ses tonuna dikkat." },
  "moon-jupiter": { c: "Birbirinize iyi gelir, moral verirsiniz; birlikte iyimser ve rahat hissedersiniz.", h: "Cömert ve destekleyici; zor günlerde birbirinizin yanında olursunuz.", t: "Duygusal beklentiler büyük olabilir; sözlerinizi tutabileceğiniz kadar verin." },
  "moon-saturn": { c: "Güven veren ama zaman zaman mesafeli hissettiren bir bağ. Sadakat yüksek.", h: "Birbirinize güven ve istikrar verirsiniz; zamanla derinleşen bir ilişki.", t: "Biri duygusal olarak soğuk ya da eleştirel algılanabilir. Sıcaklığı bilinçli olarak gösterin." },
  "mercury-mercury": { c: "Aynı dili konuşuyorsunuz; esprileriniz ve düşünce tarzınız çok benzer.", h: "Konuşmak, plan yapmak ve birlikte öğrenmek kolay; zihinsel uyumunuz yüksek.", t: "Düşünme tarzlarınız farklı; tartışmalarda birbirinizi yanlış anlayabilirsiniz. Önemli konuları yazıya dökün." },
  "mercury-venus": { c: "Birbirinize söylediğiniz sözler tatlı ve özenli; iltifat ve şakalaşma bol.", h: "Zevkleriniz hakkında konuşmayı seversiniz; sanat, müzik ve sohbet bağınızı güçlendirir.", t: "Bazen söylenenler kırıcı olabilir; nezaket ilişkinizin anahtarı." },
  "mercury-mars": { c: "Hararetli ve hızlı tartışmalar; fikir alışverişiniz enerjik.", h: "Birlikte hızlı karar verir, işleri çabuk bitirirsiniz.", t: "Tartışmalar kolayca sertleşebilir. Konuşmaya ara vermek gerektiğini bilin." },
  "mercury-saturn": { c: "Ciddi ve derin konuşmalar; birbirinizden çok şey öğrenirsiniz.", h: "Birlikte plan yapmak ve uzun vadeli kararlar almak kolay.", t: "Biri ötekinin fikirlerini fazla eleştirebilir; cesaretlendirmeyi unutmayın." },
  "venus-venus": { c: "Zevkleriniz, sevdiğiniz şeyler ve sevgi diliniz çok benzer.", h: "Birlikte eğlenmek, güzel şeylerden keyif almak kolay; uyumlu bir aşk dili.", t: "Sevgiyi farklı biçimlerde gösteriyorsunuz; birbirinizin diline merak duyun." },
  "venus-mars": { c: "Güçlü bir fiziksel çekim; romantizm ve tutku bir arada.", h: "Aşk ve arzu dengeli; birbirinize doğal olarak çekilirsiniz.", t: "Çekim yoğun ama gerilimli; tutku yüksekken kıskançlığa dikkat." },
  "venus-jupiter": { c: "Cömert, neşeli ve sevgi dolu bir bağ; birlikte keyif almayı bilirsiniz.", h: "Birbirinizi şımartmayı seversiniz; ilişkinizde bolluk duygusu var.", t: "Harcama ve keyif konusunda aşırıya kaçabilirsiniz; ortak bir denge bulun." },
  "venus-saturn": { c: "Sadık ve ciddi bir sevgi; ilişkiye uzun vadeli bakarsınız.", h: "Zamanla güçlenen, güven üzerine kurulu bir aşk.", t: "Sevgi gösterme konusunda biri çekingen kalabilir; sabır ve güvence gerekir." },
  "mars-mars": { c: "Aynı enerji, aynı hız. Birlikte çok güçlüsünüz ama çatışınca ikiniz de geri adım atmazsınız.", h: "Birlikte hareket etmek, spor yapmak ve hedef koymak kolay; iyi bir ekipsiniz.", t: "Enerjileriniz çarpışabilir; kimin önde olacağı konusunda anlaşın." },
  "mars-jupiter": { c: "Birlikte cesur ve girişimci olursunuz; büyük planlar heyecan verir.", h: "Birbirinizi motive edersiniz; ortak işlerde şanslı bir ikili.", t: "Risk alma isteğiniz birbirini körükleyebilir; hesap yapmadan atlamayın." },
  "mars-saturn": { c: "Biri hızlanmak isterken öteki fren yapar; sabırla çok sağlam işler çıkarırsınız.", h: "Disiplin ve enerji bir arada; uzun soluklu projelerde başarılısınız.", t: "Biri ötekini engelliyor gibi hissedebilir; rolleri açıkça paylaşın." },
  "asc-sun": { c: "Biri ötekinin karakterini ilk görüşte tanıyor; doğal bir yakınlık ve çekim.", h: "Birbirinizin dış dünyadaki hâlini seversiniz; birlikteyken rahatsınız.", t: "İlk izlenimler yanıltıcı olabilir; birbirinizi zamanla daha iyi anlarsınız." },
  "asc-moon": { c: "Birinin varlığı ötekine ev gibi geliyor; çok sıcak bir ilk bağ.", h: "Duygusal olarak birbirinize iyi gelirsiniz; yanınızdayken huzurlusunuz.", t: "Biri ötekinin tavırlarını fazla kişisel algılayabilir." },
  "asc-venus": { c: "Güçlü bir çekim; biri ötekini çok güzel ve çekici bulur.", h: "Birbirinize karşı nazik ve sevgi dolusunuz; uyumlu bir görünüm.", t: "Zevkleriniz ve tarzınız farklı olabilir; bu da çekimin bir parçası." },
  "asc-mars": { c: "Yoğun bir enerji ve fiziksel çekim; biri ötekini harekete geçirir.", h: "Birlikte cesur ve aktif olursunuz.", t: "Biri ötekini zaman zaman fazla baskın bulabilir." },
};

// Ev yerleşimleri: bir kişinin gezegeni ötekinin hangi evine düşüyor
export const HOUSE_N = ["", "kişilik ve görünüş", "para ve değerler", "iletişim ve yakın çevre", "ev ve aile", "aşk, eğlence ve yaratıcılık", "günlük düzen ve sağlık",
  "ilişkiler ve ortaklık", "ortak kaynaklar ve mahremiyet", "inançlar, eğitim ve yolculuk", "kariyer ve hedefler", "arkadaşlık ve gelecek planları", "iç dünya ve bilinçaltı"];
// Bir kişinin gezegeni ötekinin evine düşünce: "Deniz, Eren'in <ev> alanına … getirir." (fiil öbeği)
export const OVERLAY = { sun: "ışık tutar ve ilham verir", moon: "duygusal yakınlık ve güven getirir", mercury: "yeni fikirler getirir, bu konularda onun zihnini açar",
  venus: "sevgi, keyif ve uyum getirir", mars: "enerji ve heyecan getirir; zaman zaman da sürtüşme çıkarır", jupiter: "şans ve büyüme getirir", saturn: "ciddiyet, sorumluluk ve kalıcılık getirir" };

// Puan grupları: hangi çiftler hangi alt puanı etkiler, ağırlıklarıyla
const GROUPS = {
  ask: { "venus-mars": 3, "sun-venus": 2, "venus-venus": 1.5, "moon-venus": 1.5, "mars-mars": 1, "asc-venus": 2, "asc-mars": 1.5, "sun-mars": 1.5, "moon-mars": 1 },
  duygu: { "sun-moon": 3, "moon-moon": 2.5, "moon-venus": 2, "asc-moon": 2, "moon-mercury": 1, "moon-saturn": 1.5, "moon-jupiter": 1 },
  iletisim: { "mercury-mercury": 2.5, "sun-mercury": 1.5, "moon-mercury": 1.5, "mercury-venus": 1, "mercury-mars": 1, "mercury-saturn": 1 },
  kalicilik: { "sun-saturn": 2, "moon-saturn": 2, "venus-saturn": 2, "sun-sun": 1.5, "sun-jupiter": 1.5, "venus-jupiter": 1, "mars-saturn": 1, "asc-sun": 1.5 },
};
const HARM = { trine: 1, sext: 0.8, conj: 0.7, square: -0.6, opp: -0.35 };
// gerilim de bazı çiftlerde çekim demek (Venüs–Mars, Güneş–Mars)
const SPARK = new Set(["venus-mars", "sun-mars", "asc-mars", "mars-mars"]);
// Satürn kavuşumu bağlayıcı ama ağır: biraz daha düşük
const harmOf = (k, type) => (SPARK.has(k) && (type === "square" || type === "opp") ? 0.35 : k.includes("saturn") && type === "conj" ? 0.3 : HARM[type]);

const lonsOf = (ch, withAsc) => { const o = {}; for (const b of BODIES) if (b === "asc") { if (withAsc) o.asc = ch.houses.asc; } else o[b] = ch.pos[b].lon; return o; };

/** İki harita arasındaki açılar. A ve B: { chart, noTime } */
export function compare(A, B) {
  const la = lonsOf(A.chart, !A.noTime), lb = lonsOf(B.chart, !B.noTime);
  const list = [];
  for (const [pa, a] of Object.entries(la)) for (const [pb, b] of Object.entries(lb)) {
    if (pa === "asc" && pb === "asc") continue;
    let d = Math.abs(a - b) % 360;
    if (d > 180) d = 360 - d;
    const asp = E.ASPECTS.find((t) => Math.abs(d - t.angle) <= t.orb * (pa === "asc" || pb === "asc" ? 0.8 : 1));
    if (!asp) continue;
    const k = key(pa, pb);
    if (!PAIR[k]) continue;
    const orb = Math.abs(d - asp.angle);
    list.push({ a: pa, b: pb, k, type: asp.id, asp, orb, tone: asp.id === "conj" ? "c" : asp.id === "trine" || asp.id === "sext" ? "h" : "t", w: 1 - orb / (asp.orb + 1) });
  }
  // puanlar
  const sub = {};
  for (const [g, pairs] of Object.entries(GROUPS)) {
    let sum = 0, wsum = 0;
    for (const x of list) if (pairs[x.k]) { sum += pairs[x.k] * x.w * harmOf(x.k, x.type); wsum += pairs[x.k] * x.w; }
    // hiç açı yoksa nötr (60); açılar ağırlığına göre 25..98 arasına yayılır
    sub[g] = Math.round(Math.max(25, Math.min(98, 60 + (wsum ? (sum / Math.max(wsum, 2.5)) * 38 : 0) + Math.min(8, wsum * 1.2) * (sum >= 0 ? 1 : -0.5))));
  }
  const total = Math.round(sub.ask * 0.3 + sub.duygu * 0.3 + sub.iletisim * 0.2 + sub.kalicilik * 0.2);
  list.sort((x, y) => (GROUPS.ask[y.k] || GROUPS.duygu[y.k] || GROUPS.iletisim[y.k] || GROUPS.kalicilik[y.k] || 0.5) * y.w - (GROUPS.ask[x.k] || GROUPS.duygu[x.k] || GROUPS.iletisim[x.k] || GROUPS.kalicilik[x.k] || 0.5) * x.w);
  return { list, sub, total, groups: GROUPS };
}

/** B kişisinin gezegenleri A'nın hangi evlerine düşüyor (A'nın saati biliniyorsa) */
export function overlays(A, B) {
  if (A.noTime) return [];
  return ["sun", "moon", "venus", "mars", "mercury", "jupiter", "saturn"].map((b) => ({ body: b, house: E.houseOf(B.chart.pos[b].lon, A.chart.houses.cusps) }));
}
