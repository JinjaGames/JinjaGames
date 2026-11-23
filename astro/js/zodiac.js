// Burçlar, gök cisimleri ve yorum metinleri. Glifler metin olarak çizilsin diye U+FE0E ile.
const T = "︎";
export const SIGNS = [
  { id: "aries", n: "Koç", g: "♈" + T, el: "Ateş", mod: "Öncü", ruler: "mars", dates: "21 Mart – 19 Nisan", c: "#ff6b5e", kw: ["cesur", "aceleci", "dürüst"] },
  { id: "taurus", n: "Boğa", g: "♉" + T, el: "Toprak", mod: "Sabit", ruler: "venus", dates: "20 Nisan – 20 Mayıs", c: "#7fd08a", kw: ["sabırlı", "keyfine düşkün", "sadık"] },
  { id: "gemini", n: "İkizler", g: "♊" + T, el: "Hava", mod: "Değişken", ruler: "mercury", dates: "21 Mayıs – 20 Haziran", c: "#ffd45e", kw: ["meraklı", "hazırcevap", "kıpır kıpır"] },
  { id: "cancer", n: "Yengeç", g: "♋" + T, el: "Su", mod: "Öncü", ruler: "moon", dates: "21 Haziran – 22 Temmuz", c: "#9fc7ff", kw: ["koruyucu", "duygusal", "sezgili"] },
  { id: "leo", n: "Aslan", g: "♌" + T, el: "Ateş", mod: "Sabit", ruler: "sun", dates: "23 Temmuz – 22 Ağustos", c: "#ffb347", kw: ["cömert", "gösterişli", "sıcak"] },
  { id: "virgo", n: "Başak", g: "♍" + T, el: "Toprak", mod: "Değişken", ruler: "mercury", dates: "23 Ağustos – 22 Eylül", c: "#b5d98c", kw: ["titiz", "yardımsever", "pratik"] },
  { id: "libra", n: "Terazi", g: "♎" + T, el: "Hava", mod: "Öncü", ruler: "venus", dates: "23 Eylül – 22 Ekim", c: "#f6a8d0", kw: ["zarif", "uzlaştırıcı", "kararsız"] },
  { id: "scorpio", n: "Akrep", g: "♏" + T, el: "Su", mod: "Sabit", ruler: "pluto", dates: "23 Ekim – 21 Kasım", c: "#c46bff", kw: ["yoğun", "gizemli", "tutkulu"] },
  { id: "sagittarius", n: "Yay", g: "♐" + T, el: "Ateş", mod: "Değişken", ruler: "jupiter", dates: "22 Kasım – 21 Aralık", c: "#ff8a5c", kw: ["özgür ruhlu", "iyimser", "açık sözlü"] },
  { id: "capricorn", n: "Oğlak", g: "♑" + T, el: "Toprak", mod: "Öncü", ruler: "saturn", dates: "22 Aralık – 19 Ocak", c: "#a7b3c9", kw: ["hırslı", "ciddi", "dayanıklı"] },
  { id: "aquarius", n: "Kova", g: "♒" + T, el: "Hava", mod: "Sabit", ruler: "uranus", dates: "20 Ocak – 18 Şubat", c: "#6fe3ff", kw: ["sıra dışı", "bağımsız", "idealist"] },
  { id: "pisces", n: "Balık", g: "♓" + T, el: "Su", mod: "Değişken", ruler: "neptune", dates: "19 Şubat – 20 Mart", c: "#8fa8ff", kw: ["hayalperest", "şefkatli", "sezgisel"] },
];

export const PLANETS = {
  sun: { n: "Güneş", g: "☉" + T, c: "#ffcf5a", about: "Kim olduğun, seni parlatan şey" },
  moon: { n: "Ay", g: "☽" + T, c: "#e8ecff", about: "Duyguların, neyle huzur bulduğun" },
  mercury: { n: "Merkür", g: "☿" + T, c: "#b7e4ff", about: "Nasıl düşünüp konuştuğun" },
  venus: { n: "Venüs", g: "♀" + T, c: "#ff9ccf", about: "Sevme ve sevilme biçimin" },
  mars: { n: "Mars", g: "♂" + T, c: "#ff6b5e", about: "Enerjin, öfken, cesaretin" },
  jupiter: { n: "Jüpiter", g: "♃" + T, c: "#ffb873", about: "Şansın ve büyüdüğün alan" },
  saturn: { n: "Satürn", g: "♄" + T, c: "#d8c79a", about: "Sınavların ve olgunlaştığın yer" },
  uranus: { n: "Uranüs", g: "♅" + T, c: "#7ff0e3", about: "Sürprizler ve özgürlük isteğin" },
  neptune: { n: "Neptün", g: "♆" + T, c: "#8fa8ff", about: "Hayallerin ve sezgilerin" },
  pluto: { n: "Plüton", g: "♇" + T, c: "#c46bff", about: "Dönüşüm ve derin güç" },
};

export const HOUSES = [
  "", "Kendin, görünüşün ve hayata nasıl başladığın", "Para, sahip oldukların ve öz değerin", "Kardeşler, yakın çevre, gündelik konuşmalar",
  "Ev, aile ve köklerin", "Aşk, eğlence, yaratıcılık ve çocuklar", "Günlük işler, rutinler ve sağlık", "Evlilik, ortaklıklar ve yakın ilişkiler",
  "Ortak para, mahremiyet ve dönüşüm", "Uzak yollar, eğitim ve inançlar", "Kariyer, toplumdaki yerin ve hedeflerin",
  "Arkadaşlar, topluluklar ve gelecek planları", "İç dünyan, yalnızlık ve bilinçaltı",
];

// Güneş burcu: temel karakter
export const SUN = [
  "Bir şey kafana yattığında beklemeyi sevmiyorsun; önce harekete geçip sonra düşünmek sana daha doğal geliyor. Rekabet seni canlandırıyor, sıkılmak ise en büyük düşmanın. Kızgınlığın çabuk parlıyor ama aynı hızla geçiyor.",
  "Acele ettirilmekten hoşlanmıyorsun; kendi temponda ilerlediğinde neredeyse hiçbir şey seni durduramıyor. Güzel yemek, rahat bir koltuk, sevdiğin bir koku gibi küçük keyifler senin için lüks değil, ihtiyaç. Bir kez bağlandın mı kolay kolay vazgeçmiyorsun.",
  "Aklın aynı anda birkaç sekmede açık gibi; yeni bir konuyu kapmak senin için oyun. Sohbetin tadını çıkarıyorsun, espri yeteneğin çoğu zaman ortamın havasını değiştiriyor. Tek sorun, her şeyi aynı anda merak edince bazılarını yarım bırakman.",
  "Sevdiklerini korumak için gerekirse kabuğuna değil onların önüne geçiyorsun. Ev, aile ve tanıdık yüzler sana güç veriyor. Duyguların derin; kırıldığında belli etmesen de unutman zaman alıyor.",
  "Bir odaya girdiğinde fark edilmek hoşuna gidiyor ve bunu saklamıyorsun. Cömertliğin, sıcaklığın ve sadakatin insanları sana çekiyor. Takdir edilmediğini hissettiğinde ise ışığın biraz kısılıyor.",
  "Ayrıntıları başkalarından önce görüyorsun; bir işi yarım yamalak yapmak içini rahatsız ediyor. İnsanlara gösterişle değil, işe yarar şeylerle yardım ediyorsun. Kendine karşı da biraz daha yumuşak olsan fena olmaz.",
  "Gerginlikten hoşlanmıyorsun; bir ortamda herkesin rahat etmesi için farkında olmadan araya giriyorsun. Güzel şeylere, iyi giyinmiş insanlara, uyumlu renklere karşı zayıfsın. Karar vermek bazen uzun sürüyor çünkü her iki tarafı da anlıyorsun.",
  "Yüzeysel sohbetler seni çabuk sıkıyor; ya derin konuşursun ya hiç. İnsanları okuma konusunda iyisin ve kolay kolay kandırılmıyorsun. Güvenin bir kez sarsıldı mı yeniden kazanılması çok zor.",
  "Bir yere bağlanıp kalmak sana dar geliyor; yeni yerler, yeni fikirler, yeni insanlar ruhunu besliyor. İyimserliğin bulaşıcı. Açık sözlülüğün bazen kırıcı olabiliyor ama arkasında kötü niyet yok.",
  "Hedef koyduğunda adım adım tırmanıyorsun ve vazgeçmiyorsun. Dışarıdan ciddi görünsen de yakın çevren senin kuru mizahını iyi bilir. Sorumluluk almak sana doğal geliyor; dinlenmeyi ise bazen unutuyorsun.",
  "Herkesin gittiği yoldan gitmek sana pek cazip gelmiyor. Arkadaşlarına sadıksın ama alanına girilmesinden hoşlanmıyorsun. Kafandaki fikirler çoğu zaman zamanının biraz ilerisinde.",
  "Başkalarının hissettiğini neredeyse kendin hissediyorsun; bu seni şefkatli yapıyor ama yoruyor da. Hayal gücün güçlü, müzik, film ve sanat seni kolayca içine çekiyor. Arada bir dünyadan uzaklaşıp kendi kıyına çekilmen gerekiyor.",
];
// Ay burcu: duygusal ihtiyaçlar
export const MOON = [
  "Duygularını hemen yaşayıp hemen geçiriyorsun. Rahatlamak için hareket etmen, bir şeyi başlatman gerekiyor; beklemek seni gerer.",
  "Huzur bulmak için güven ve düzen istiyorsun. Tanıdık bir yemek, sevdiğin bir yer ve sakin bir akşam seni çabucak toparlar.",
  "Ne hissettiğini anlamak için onu konuşman ya da yazman gerekiyor. Can sıkıntısı seni en çok yoran duygu.",
  "Ay burada evinde; duyguların güçlü ve sezgilerin keskin. Sevildiğini hissettiğin bir yuva sana her şeyden çok iyi gelir.",
  "Görülmek ve sevildiğini duymak istiyorsun. Küçük bir iltifat bile moralini bütün gün yukarıda tutabilir.",
  "Kaygılandığında bir şeyleri düzene sokarak rahatlıyorsun. Sevgini sözle değil, birinin işini kolaylaştırarak gösteriyorsun.",
  "Duygusal dengen ilişkilerinle yakından bağlı. Gerginlik varken rahat edemiyorsun; konuşup tatlıya bağlamak istiyorsun.",
  "Duyguların yoğun ama herkese açmıyorsun. Bir kez güvendin mi sonuna kadar bağlanırsın; ihaneti ise kolay affetmezsin.",
  "Sıkıştığında kaçış planı yaparsın: bir yolculuk, yeni bir kitap, büyük bir hayal. Özgürlüğün kısıtlanınca duyguların da tıkanır.",
  "Duygularını kontrol altında tutmayı seviyorsun ve çoğu zaman güçlü görünüyorsun. Ama sen de arada birinin sana bakmasına ihtiyaç duyuyorsun.",
  "Duygularına biraz mesafeden bakıyorsun; önce anlamak, sonra hissetmek istiyorsun. Arkadaşların senin için aile kadar önemli.",
  "Duygusal süngersin; çevrendeki havayı hemen kaparsın. Yalnız kalıp müzik dinlemek ya da suya bakmak seni yeniden doldurur.",
];
// Yükselen burç: ilk izlenim ve hayata yaklaşım
export const ASC = [
  "İnsanlar seni enerjik ve doğrudan biri olarak görüyor. Yeni bir ortama girdiğinde ilk adımı genelde sen atıyorsun.",
  "Sakin, güven veren bir duruşun var. İnsanlar yanında rahatlıyor; acele etmeden konuşman bile dinginlik yayıyor.",
  "İlk izlenimde konuşkan, hareketli ve meraklı görünüyorsun. Yüz ifaden düşüncelerini çabucak ele veriyor.",
  "İlk anda yumuşak ve sıcak biri gibi görünüyorsun ama kendini açman zaman alıyor. Tanıdıkça insanlara kol kanat geriyorsun.",
  "Girdiğin yerde fark ediliyorsun; duruşunda bir sahne ışığı var. İnsanlar senin enerjinle ısınıyor.",
  "Derli toplu, dikkatli ve biraz mesafeli bir ilk izlenim bırakıyorsun. Gözün her şeyi fark ediyor ama hepsini söylemiyorsun.",
  "Nazik, şık ve hoş sohbet biri olarak görünüyorsun. İnsanlar seninle tartışmaktan çok anlaşmayı tercih ediyor.",
  "Bakışında bir derinlik var; insanlar seni hem merak ediyor hem de biraz çekiniyor. Kendinle ilgili her şeyi hemen anlatmıyorsun.",
  "Neşeli, rahat ve maceraya hazır görünüyorsun. Yabancılarla bile kısa sürede kaynaşıyorsun.",
  "Ciddi, olgun ve güvenilir bir ilk izlenim bırakıyorsun. Zamanla çok daha esprili olduğun ortaya çıkıyor.",
  "Biraz farklı, biraz sıra dışı görünüyorsun; tarzın kalabalığa uymuyor. İnsanlar seni kolay unutmuyor.",
  "Yumuşak, rüya gibi ve anlayışlı görünüyorsun. İnsanlar dertlerini sana anlatmaya çok yatkın.",
];
// Kişisel gezegenler burçlarda: kısa cümleler
export const MERCURY = [
  "Hızlı düşünüp hızlı konuşursun; lafı dolandırmazsın.", "Yavaş ama sağlam düşünürsün; bir kez karar verdin mi fikrin kolay değişmez.",
  "Zihnin çok hızlı; aynı anda birkaç konuyu takip edebilirsin.", "Duygularınla düşünürsün; konuşurken ses tonuna dikkat edersin.",
  "Kendinden emin konuşursun; anlatırken insanları etkilersin.", "Ayrıntılara takılırsın, analiz etmeden rahat etmezsin.",
  "Diplomatsın; sert bir şeyi bile kibarca söylemeyi bilirsin.", "Satır aralarını okursun; sorduğun sorular hep derine iner.",
  "Büyük resmi görürsün ama ayrıntılara sabrın azdır.", "Planlı ve gerçekçi düşünürsün; boş laftan hoşlanmazsın.",
  "Sıra dışı fikirlerin vardır; kalıpların dışında düşünürsün.", "Hayal gücüyle düşünürsün; mantıktan çok sezgine güvenirsin.",
];
export const VENUS = [
  "Aşkta ilk adımı atmaktan çekinmezsin; heyecan isterim dersin.", "Sevgini dokunarak, ilgilenerek ve emek vererek gösterirsin.",
  "Seni güldüren ve konuşmaktan sıkılmadığın biri seni kolayca kazanır.", "Sevdiğin insanı korursun; güven duymadan açılmazsın.",
  "Aşkta cömert ve gösterişlisin; sevilmeyi de açıkça istersin.", "Sevgini küçük ama düşünceli şeylerle gösterirsin.",
  "Uyumlu, zarif ve romantik ilişkiler istersin; kaba davranış seni hemen soğutur.", "Ya hep ya hiç; sevdiğinde bütün kalbinle seversin.",
  "Özgürlüğünü kısıtlamayan, seninle macera yaşayacak biri istersin.", "Ciddi ve uzun soluklu bağlar kurarsın; sözünü tutarsın.",
  "Önce arkadaşlık, sonra aşk; kendi alanına saygı istersin.", "Romantik ve fedakârsın; sevdiğin kişiyi idealize edebilirsin.",
];
export const MARS = [
  "Enerjin yüksek ve sabrın kısa; mücadeleden kaçmazsın.", "Yavaş başlarsın ama bir kez yola çıktın mı durdurulamazsın.",
  "Enerjini zihinsel işlere harcarsın; tartışmayı seversin.", "Duygularla hareket edersin; sevdiklerin için savaşırsın.",
  "Hırslı ve gururlusun; sahneye çıkmaktan çekinmezsin.", "Enerjini titiz ve planlı işlere verirsin.",
  "Doğrudan çatışmadan kaçınırsın; adalet duygun güçlüdür.", "Tutkulu ve kararlısın; bir şeyi kafana koydun mu bırakmazsın.",
  "Macera ve hareket istersin; yerinde duramazsın.", "Disiplinli ve dayanıklısın; uzun vadeli hedeflerde başarılısın.",
  "Kendi kurallarınla hareket edersin; özgürlüğün için direnirsin.", "Enerjin dalgalı; ilhamın geldiğinde harikalar çıkarırsın.",
];
export const ASPECT_TXT = {
  conj: "birlikte çalışıyor; bu iki taraf senin içinde iç içe geçmiş.",
  sext: "birbirine destek veriyor; fırsat geldiğinde kolayca uyum sağlıyorlar.",
  square: "arasında gerilim var; bu sürtüşme seni zorlarken büyütüyor da.",
  trine: "arasında doğal bir akış var; bu konular sana kendiliğinden kolay geliyor.",
  opp: "karşı karşıya duruyor; ikisi arasında denge kurmayı öğreniyorsun.",
};
// İki güneş burcu arasındaki ilişki türüne göre uyum (fark 0-6)
export const MATCH = [
  { score: 78, t: "Aynı burç", d: "Birbirinizi yarım kelimeden anlıyorsunuz ama aynı zaafları da paylaşıyorsunuz. Biriniz dengeyi kaybettiğinde öteki de kaydırabiliyor; ayrı alanlar tanımak işe yarar." },
  { score: 58, t: "Komşu burçlar", d: "Yaşamın ritmi farklı; biri hızlanırken öteki yavaşlamak istiyor. Bu fark sabırla birbirinize yeni şeyler öğretebilir." },
  { score: 84, t: "Altmışlık", d: "Arkadaşlık gibi rahat başlayan, eğlenceli bir bağ. Sohbet akıyor, ortak plan yapmak kolay." },
  { score: 52, t: "Kare", d: "Kıvılcım çok, sürtüşme de. Çekim güçlü ama uzlaşmayı öğrenmeden huzur gelmiyor. Doğru kurulursa en çok büyüten ilişkilerden biri." },
  { score: 92, t: "Üçgen", d: "Aynı elementtesiniz; birbirinizin enerjisini zorlamadan anlıyorsunuz. Rahat, akan, güvenli bir uyum." },
  { score: 63, t: "Yüz elli derece", d: "Birbirinize hem merak hem şaşkınlıkla bakıyorsunuz. Ortak dil bulmak emek istiyor ama bulduğunuzda çok özel bir bağ oluşuyor." },
  { score: 80, t: "Karşıt burçlar", d: "Zıtlar birbirini çekiyor: biri neyse öteki onun eksik parçası gibi. Denge kurulduğunda tamamlayıcı, kurulmadığında çekişmeli." },
];
