// Haftalık ve aylık yorumların parçaları. Ev numarası, burca göre güneş evi (burcun kendisi 1. ev).
// Her evin iki ya da üç hâli var; hangisinin seçileceği haftaya göre değişir, böylece metin her hafta aynı dönmez.

export const TOPIC = ["", "kendine", "paraya ve değerlerine", "yakın çevrene ve konuşmalarına", "evine ve ailene", "aşka ve keyfine",
  "işlerine ve sağlığına", "ilişkilerine", "ortak paraya ve derin konulara", "yollara ve öğrenmeye", "kariyerine", "arkadaşlarına ve planlarına", "iç dünyana"];

export const SUN_WEEK = [null,
  ["Bu hafta ışık doğrudan senin üstünde. Görünmek, kendini anlatmak ve yeni bir başlangıç yapmak için uygun bir dönem; ertelediğin bir adımı atabilirsin.", "Kendine dönüp bakma haftası. Saçından dolabına, hedeflerinden alışkanlıklarına kadar neyi yenilemek istediğine karar ver; enerjin bunu taşıyacak kadar yüksek."],
  ["Gündemin para ve sahip oldukların. Harcamalarını bir gözden geçir; küçük bir düzenleme ay sonunu rahatlatabilir.", "Kendi değerini hatırladığın bir hafta. Emeğinin karşılığını istemekten çekinme, bu kez seni dinleyecekler."],
  ["Telefonun, mesajların ve sohbetlerin yoğun. Kısa yolculuklar, kardeşlerle ya da komşularla konuşmalar beklenmedik kapılar açabilir.", "Aklın hızlı çalışıyor. Yazmak, öğrenmek, bir şeyi anlatmak için iyi bir hafta; fikirlerini not et."],
  ["Ev ve aile öne çıkıyor. Evde küçük bir değişiklik, ailenle uzun bir akşam yemeği sana iyi gelecek.", "Biraz içe dönüp kökenlerine bakma zamanı. Yorgun hissediyorsan dinlenmeyi lüks değil ihtiyaç olarak gör."],
  ["Keyif ve aşk haftası. Sevdiğin şeylere vakit ayır; yaratıcı bir uğraş ya da flört enerjini yükseltir.", "İçindeki çocuğu dinle: oyun, müzik, dans, ne iyi geliyorsa. Kalbini hızlandıran biriyle karşılaşma ihtimali yüksek."],
  ["Günlük düzen ve sağlık konuşuluyor. Uykunu, beslenmeni ve iş listeni toparlamak için en iyi hafta bu.", "Yapılacaklar listesi kabarık ama içinden çıkabilirsin. Küçük adımlarla ilerle, kendini yorma."],
  ["İlişkiler sahnenin ortasında. Partnerinle, iş ortağınla ya da yakın bir dostunla dürüst bir konuşma işleri kolaylaştırır.", "Başkalarının desteği bu hafta her şeyi hızlandırıyor. Tek başına uğraşmak yerine yardım iste."],
  ["Derin konular gündemde: ortak hesaplar, borçlar, güven meselesi. Saklanan bir şey ortaya çıkabilir; telaşlanma, netleşmek iyidir.", "Bir şeyi bırakıp yenisine yer açma haftası. İçinde biriktirdiğin bir duyguyu konuşmak seni hafifletir."],
  ["Ufkun genişliyor. Bir yolculuk planı, yeni bir kurs ya da farklı bir bakış açısı seni heyecanlandırabilir.", "Rutinden sıkıldıysan çok normal; bu hafta yeni bir şey öğrenmek ya da bir yere kaçmak için ideal."],
  ["Kariyerin parlıyor. Yöneticilerin ve çevren seni fark ediyor; emeğini görünür kıl.", "Hedeflerine odaklanma zamanı. Atacağın ciddi bir adım uzun vadede karşılığını verir."],
  ["Arkadaşların ve sosyal çevren hareketli. Bir davet, bir grup planı ya da yeni bir tanışıklık seni beklenmedik yerlere götürebilir.", "Gelecekle ilgili hayallerini yeniden düşün. Seni destekleyen insanlarla vakit geçir."],
  ["Yavaşlamak isteyebilirsin, bu çok doğal. Bu hafta biraz geri çekilip kafanı toplamak gelecek ay için güç biriktirmek demek.", "Sezgilerin keskin; rüyalarına ve içinden geçenlere dikkat et. Yalnız geçirdiğin zaman seni toparlar."],
];

export const VENUS_LOVE = [null,
  ["Venüs burcunda; çekiciliğin yüksek, kendini güzel hissediyorsun. Flört için harika bir hafta.", "Sevilmeye açık bir dönemdesin. Kendine güzel bir şey almak bile moralini yükseltir."],
  ["Aşkta güven arıyorsun. Gösterişten çok samimi ilgi seni etkiliyor; küçük jestler büyük fark yaratıyor.", "Sevgini somut şeylerle gösterme haftası: bir hediye, bir yemek, birlikte geçirilen sakin bir akşam."],
  ["Aşk mesajlarda başlıyor. Uzun bir sohbet ya da beklenmedik bir mesaj kalbini hızlandırabilir.", "Hafif ve eğlenceli bir flört havası var. Ağır konuları bu haftaya saklama."],
  ["Evde, yakın çevrende romantik anlar. Sevdiğinle evde geçirilen bir akşam dışarıdaki her şeyden güzel olabilir.", "Duyguların derinleşiyor; aile ve ilişki arasındaki dengeyi gözet."],
  ["Aşk için şanslı bir hafta. Bekarsan gözüne birinin takılması çok olası; ilişkin varsa romantizmi yeniden yakın.", "Kalbin oyun istiyor: sürpriz bir buluşma, kahkaha, müzik. Kendini bırak."],
  ["İlişkide küçük ama anlamlı ilgiler önemli. Sevdiğinin işini kolaylaştırmak en güzel aşk ilanın olabilir.", "İş yerinde ya da gündelik rutinde biriyle tatlı bir yakınlık kurulabilir."],
  ["Venüs ilişkiler evinde; birliktelikler için çok güzel bir dönem. Barışmak, söz vermek, plan yapmak kolay.", "Partnerinle uyumunuz yüksek. Bekarsan ciddi bir başlangıç için kapı aralık."],
  ["Tutku yükseliyor ama kıskançlığa dikkat. Derin ve dürüst konuşmalar ilişkiyi güçlendirir.", "Aşkta ya hep ya hiç modundasın. Gizemli biri ilgini çekebilir."],
  ["Farklı bir kültürden, uzak bir yerden biri ilgini çekebilir. İlişkide birlikte yeni bir şey denemek iyi gelir.", "Aşkta özgürlük ve macera istiyorsun; birlikte bir kaçamak planlayın."],
  ["Aşkta ciddiyet zamanı. Uzun vadeli planlar konuşulabilir; birinin sana gerçekten değer verdiğini görürsün.", "İş ve aşk birbirine karışabilir; profesyonel çevrende tatlı bir ilgi olabilir."],
  ["Arkadaşlıktan aşka giden bir yol açılabilir. Grup ortamlarında gözün birine takılabilir.", "İlişkinde biraz alan istiyorsun; bunu sevgiyle söylersen anlaşılırsın."],
  ["Gizli duygular, söylenmemiş hisler… Kalbinden geçeni kendine itiraf etme haftası.", "Geçmişten biri aklına gelebilir. Acele karar verme, sadece hisset."],
];

export const MARS_WORK = [null,
  ["Enerjin tavan; yeni bir işe başlamak ya da cesur bir karar almak için güçlüsün. Sabırsızlığa dikkat.", "Rekabetten çekinmiyorsun; bu hafta kendini öne koymak sana kazandırır."],
  ["Para kazanmak için ekstra çaba gösteriyorsun ve bu karşılıksız kalmayacak. Aceleyle alışveriş yapma.", "Kazancını artırmak için somut bir adım atabilirsin; bir teklif, bir zam isteği, yeni bir iş fikri."],
  ["Toplantılar, yazışmalar, kısa yollar… Hızlı düşünüp hızlı hareket ediyorsun. Sert sözlerden kaçın.", "İkna gücün yüksek; bir sunum ya da önemli bir konuşma için uygun hafta."],
  ["Evle ilgili işlere enerji harcıyorsun; tadilat, taşınma, eşya düzenleme gibi. Aile içi tartışmaları büyütme.", "İş ile ev arasında sıkışabilirsin; öncelik sırası yapmak işini kolaylaştırır."],
  ["Yaratıcı projeler için enerjin yüksek. Hobi gibi başlayan bir şey işe dönüşebilir.", "Riskli işlere girme isteğin artıyor; eğlenceli ama hesabını yaparak."],
  ["İş temposu yoğun; çok çalışacaksın ama verimli olacaksın. Bedenini de dinle, mola vermeyi unutma.", "Bir görevi sonunda bitirmek için ideal hafta. Spor ve hareket sana iyi gelir."],
  ["Ortaklıklarda gerilim olabilir; anlaşmazlıkları masaya yatırıp çözmek için cesaretin var.", "Başkalarıyla birlikte çalışmak bu hafta seni ileri taşır; ama kontrolü tamamen bırakma."],
  ["Kaynakları yönetme, borç ve yatırım konularında kararlı adımlar atabilirsin. Gizli rekabete dikkat.", "Derin bir araştırma, detaylı bir analiz gerektiren işlerde çok başarılı olursun."],
  ["Eğitim, yayın, yurt dışı ya da hukukla ilgili işler hızlanıyor. Büyük düşün ama ayrıntıyı kaçırma.", "Yeni bir şey öğrenmek için motivasyonun yüksek; bir kursa başlamak için doğru zaman."],
  ["Kariyerinde atak bir dönem. Hedefin için mücadele ediyorsun ve bu görülüyor. Otoriteyle çatışmaktan kaçın.", "İşte sorumluluk alıyorsun; liderlik etmen beklenebilir."],
  ["Ekip çalışması ve ortak hedefler öne çıkıyor. Bir proje grubunda sesini duyurabilirsin.", "Arkadaşlarınla ortak bir iş fikri konuşulabilir; heyecan verici ama planlı ilerleyin."],
  ["Perde arkasında çalışmak sana daha uygun bu hafta. Enerjin düşük gelirse kendini zorlama.", "Bitmemiş işleri sessizce toparlama zamanı; yeni başlangıçları birkaç gün ertele."],
];

export const JUPITER_LUCK = [null,
  "Jüpiter burcunda; şans doğrudan senden yana, kendine yatırım yap.", "Jüpiter para evinde; kazanç kapıları genişliyor.", "Jüpiter iletişim evinde; yazmak, öğrenmek, yakın çevre şans getiriyor.",
  "Jüpiter ev ve aile evinde; ev hayatı genişliyor, taşınma ya da aile büyümesi gündemde olabilir.", "Jüpiter aşk ve keyif evinde; romantizm ve yaratıcılık için bereketli bir dönem.",
  "Jüpiter iş ve sağlık evinde; çalışma koşulların iyileşiyor.", "Jüpiter ilişkiler evinde; ortaklıklar ve evlilik için şanslı bir dönem.",
  "Jüpiter ortak kaynaklar evinde; destek, miras, yatırım konuları olumlu.", "Jüpiter uzak yollar evinde; seyahat ve eğitim için kapılar açık.",
  "Jüpiter kariyer evinde; terfi, tanınma ve yükseliş için çok iyi bir dönem.", "Jüpiter arkadaşlar evinde; çevren genişliyor, dileklerin gerçeğe yaklaşıyor.",
  "Jüpiter iç dünya evinde; görünmez bir koruma var, ruhsal olarak güçleniyorsun.",
];

export const TIP = {
  Ateş: ["Enerjini dağıtma; tek bir hedefe yönel.", "Hareket et: yürüyüş, spor, dans. Bedenin rahatlayınca kafan da açılacak.", "Söylemeden önce bir nefes al; dürüstlüğün kırıcı olmasın."],
  Toprak: ["Küçük bir keyfi kendine çok görme.", "Bir işi bitirip üstünü çizmenin tadını çıkar.", "Bu hafta değişikliğe biraz daha açık ol; her şey plana uymayabilir."],
  Hava: ["Telefonu biraz bırak, birisiyle yüz yüze konuş.", "Aklındaki fikirlerden birini seç ve gerçekten başla.", "Herkesi memnun etmeye çalışma; önce sen ne istiyorsun?"],
  Su: ["Duygularını yazmak seni rahatlatır.", "Sınır koymak sevgisizlik değildir; kendini koru.", "Suya yakın olmak, uzun bir banyo ya da deniz kenarı iyi gelir."],
};

export const MOON_IN_SIGN = ["Ay bu günlerde senin burcunda; duygusal olarak daha görünür ve sezgilerin daha güçlü.", "Ay burcunda dolaşırken içgüdülerine güven; bu günler senin için tazelenme günleri."];
export const MERC_RETRO = "Merkür geri hareketteyken sözleşmeleri, önemli mesajları ve teknik alışverişleri iki kez kontrol et; eski bir konu yeniden açılabilir.";
export const VENUS_RETRO = "Venüs geri harekette: eski ilişkiler, geçmişten gelen duygular gündeme gelebilir; büyük aşk kararlarını aceleye getirme.";
export const MARS_RETRO = "Mars geri harekette: enerjin dalgalı olabilir, yarım kalan işlere dönmek yeni bir şeye başlamaktan daha verimli.";

export const LUNATION = {
  new: (h, d) => `${d} tarihindeki Yeni Ay ${TOPIC[h]} yeni bir sayfa açmanı istiyor; niyetini bu günlerde belirle.`,
  full: (h, d) => `${d} tarihindeki Dolunay ${TOPIC[h]} ışık tutuyor; bir şey tamamlanıyor ya da netleşiyor.`,
};
