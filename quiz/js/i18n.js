// Arayüz dili (TR / EN). Site Türkçe yazılmıştır; İngilizce seçiliyken ekrana gelen arayüz metinleri bu sözlükle
// çevrilir (sayfa çizildikçe; MutationObserver). Quiz içerikleri (sorular, şarkı ve quiz adları) çevrilmez;
// oyuncu adları ve sohbet mesajları [data-noi18n] içinde olduğu için hiç dokunulmaz.
const KEY = "jqLang";
export let LANG = (() => {
  try { const v = localStorage.getItem(KEY); if (v === "en" || v === "tr") return v; } catch {}
  return /^tr\b/i.test(navigator.language || "tr") ? "tr" : "en";
})();
export function setLang(l) {
  try { localStorage.setItem(KEY, l === "en" ? "en" : "tr"); } catch {}
}
/** Dili sayfayı yenilemeden değiştirir: İngilizce'de çeviri başlar; Türkçe'de durur (sayfa yeniden çizilince Türkçe gelir). */
export function applyLang(l) {
  l = l === "en" ? "en" : "tr";
  setLang(l);
  LANG = l;
  document.documentElement.lang = l;
  if (l === "en") start();
  else stop();
}

const D = {
  // genel
  "Yükleniyor": "Loading", "Yükleniyor…": "Loading…", "Keşfet": "Explore", "Hepsi": "All", "Tümü": "All", "Hiçbiri": "None",
  "Vazgeç": "Cancel", "Kaydet": "Save", "Kapat": "Close", "Katıl": "Join", "Ayrıl": "Leave", "Çık": "Exit", "Başla": "Start", "Yeni": "New",
  "Profil": "Profile", "Profilin": "Your profile", "Profili düzenle": "Edit profile", "Adını seç": "Choose your name", "Oyuncu adı": "Player name",
  "Simge": "Icon", "Renk": "Color", "Fotoğraf yükle": "Upload photo", "Rastgele ad": "Random name", "Geç, rastgele bir ad ver": "Skip, give me a random name",
  "Geç (rastgele ad)": "Skip (random name)", "Boş bırakırsan ya da geçersen sana rastgele bir ad verilir; sonra istediğin zaman değiştirebilirsin.": "If you leave it empty or skip, you'll get a random name; you can change it anytime.",
  "Profil kaydedildi. Yeni lobilerde görünecek.": "Profile saved. It will show in new lobbies.",
  "JinjaGames ana sayfasına dön": "Back to JinjaGames home", "JinjaQuiz ana sayfasına dön": "Back to JinjaQuiz home", "JinjaQuiz ana sayfa": "JinjaQuiz home",
  "Lobiye dön": "Back to lobby", "Ses düzeyi": "Volume", "Ses efektleri": "Sound effects", "Gizlenen quizler": "Hidden quizzes",
  "Diğer web uygulamaları": "Other web apps", "Gizlilik": "Privacy", "Dil": "Language",
  // ana sayfa
  "Şarkıyı": "Name the", "ilk sen": "song", "bil.": "first.",
  "Bir saniyelik kesiti dinle ya da trivia sorusunu çöz; dört şıktan doğrusunu herkesten önce bul. Lobi kur, bağlantıyı gönder; arkadaşların tek tıkla katılsın.": "Hear a one-second clip or answer a trivia question; pick the right one of four before anyone else. Create a lobby, send the link, and your friends join in one tap.",
  "Lobi kur": "Create lobby", "Solo oyna": "Play solo", "Trivia": "Trivia", "Kodun mu var?": "Have a code?", "Lobi kodu": "Lobby code",
  "Rastgele bir quiz aç": "Open a random quiz", "Plağı çevir · ortasına dokun, rastgele quiz": "Spin the record · tap the center for a random quiz",
  "Oyun modları": "Game modes", "Şarkı Quizi": "Song Quiz", "Bir saniyelik kesitten şarkıyı bil": "Guess the song from a one-second clip",
  "Tersten Şarkı": "Reverse Song", "Sıralama": "Ranking", "En çok dinlenen 5 şarkıyı sırala": "Rank the 5 most-played songs", "Anime": "Anime",
  "Karakter, kapak ve yıl quizleri": "Character, cover and year quizzes", "Sayı Quizi": "Number Quiz", "Hangisi daha büyük? Seriyi bozma": "Which is bigger? Keep the streak",
  "Arkadaşlarla": "With friends", "Lobi kur, 12 kişiye kadar oynayın": "Create a lobby, play with up to 12 people",
  "Quiz, kategori ya da sanatçı ara…": "Search quizzes, categories or artists…", "Quiz, kategori ya da sanatçı ara": "Search quizzes, categories or artists",
  "Deezer'da sanatçı ara": "Search artists on Deezer", "Quiz türleri": "Quiz types", "Sanatçı bul": "Find artist", "Sayı": "Numbers",
  "Burada bir şey yok.": "Nothing here.", "\"Sanatçı bul\" ile Deezer'da ara; binlerce sanatçı var.": "Use \"Find artist\" to search Deezer; there are thousands of artists.",
  "Müzik": "Music", "Popüler sanatçılar": "Popular artists", "Sıralama quizleri": "Ranking quizzes", "Tersten şarkı quizi": "Reverse song quiz",
  "Anime quizleri": "Anime quizzes", "Topluluk quizleri": "Community quizzes", "Senin quizlerin": "Your quizzes", "Kendi quizin": "Your own quiz",
  "Kendi quizini yap, herkes oynasın.": "Make your own quiz and let everyone play.",
  "Şarkı, tersten şarkı, trivia, sıralama ya da anime opening: türünü seç, quizini kur. Herkese açık yayınlarsan Topluluk'ta herkes görür.": "Song, reverse song, trivia, ranking or anime opening: pick a type and build your quiz. Publish it and everyone sees it under Community.",
  "Kendi quizini oluştur": "Create your own quiz", "Tümünü gör": "See all",
  "Ne oynamak istersin?": "What do you want to play?", "Her türden seçmeler": "A bit of everything", "Ne dinlemek istersin?": "What do you want to hear?",
  "Kesitten şarkıyı bil": "Guess from a clip", "En çok dinlenenleri doğru sırala": "Put the most-played in order", "İlk 5'i doğru diz": "Order the top 5",
  "Tersten dinle, şarkıyı bil": "Hear it backwards, name the song", "Şarkı tersten çalar": "Songs play backwards", "Anime'yi ne kadar biliyorsun?": "How well do you know anime?",
  "Karakter, kapak, opening": "Characters, covers, openings", "Ne kadar biliyorsun?": "How much do you know?", "Bilgi yarışması": "Knowledge quiz",
  "Hangisi daha büyük?": "Which is bigger?", "Hangisi büyük, seriyi bozma": "Which is bigger, keep the streak", "Topluluğun quizleri": "Community quizzes",
  "Oyuncuların yaptıkları": "Made by players", "Kaydettiklerin": "Your saved ones", "Senin": "Yours", "Topluluk": "Community", "Tersten": "Reverse",
  "Topluluk quizleri yükleniyor": "Loading community quizzes", "Topluluk quizleri yükleniyor…": "Loading community quizzes…",
  "Topluluk quizlerine şu an ulaşılamadı. Biraz sonra tekrar dene.": "Couldn't reach community quizzes right now. Try again shortly.",
  "Topluluk quizlerine şu an ulaşılamadı.": "Couldn't reach community quizzes right now.", "Henüz topluluk quizi yok.": "No community quizzes yet.", "İlkini sen oluştur!": "Create the first one!",
  "Anime trivia": "Anime trivia", "Anime opening": "Anime opening", "ilk 5 şarkı": "top 5 songs", "Düzenle": "Edit", "Yayından kaldır": "Unpublish",
  "Bu quizi gizle": "Hide this quiz", "Listeden kaldır": "Remove from list", "Sonuç yok. Yazımı kontrol et.": "No results. Check the spelling.", "Doğru sanatçıyı seç:": "Pick the right artist:",
  "Önerilen": "Recommended", "En çok oynanan": "Most played", "En yeni": "Newest", "Sırala": "Sort", "En çok oynananlar": "Most played",
  "Henüz oynanmadı": "Not played yet", "Kategoriler": "Categories", "Yabancı": "International", "Türkçe Rap": "Turkish Rap", "Türkçe Pop": "Turkish Pop", "Türkçe Rock": "Turkish Rock",
  "Genel Kültür": "General Knowledge", "Tarih": "History", "Coğrafya": "Geography", "Bilim": "Science", "Spor": "Sports", "Film & Dizi": "Film & TV", "Oyun": "Games",
  "Edebiyat & Sanat": "Literature & Art", "Yemek": "Food", "Teknoloji": "Technology", "Eğlence": "Fun", "Rap": "Rap", "Pop": "Pop", "Rock": "Rock",
  // açık lobiler ve yeni ana sayfa
  "Canlı": "Live", "Şifreli lobi": "Locked lobby", "Şu an açık lobi yok": "No open lobbies right now", "İlk açık lobiyi sen kur; herkes buradan tek dokunuşla katılabilir.": "Create the first open lobby; anyone can join from here in one tap.",
  "Kodla katıl": "Join with code", "Şu an bir lobinin kurucususun. Devam edersen lobi herkes için kapanır.": "You're hosting a lobby right now. If you continue, it closes for everyone.", "Şu an açık bir lobin var. Devam edersen lobi kapanır.": "You have an open lobby. If you continue, it closes.", "Şu an bir lobidesin. Devam edersen lobiden ayrılırsın; puanın lobide kalır.": "You're in a lobby right now. If you continue, you leave it; your score stays there.", "Ayrıl ve devam et": "Leave and continue", "Puanlar sıfırlansın mı?": "Reset the scores?", "Herkesin genel puanı ve oynanan quizler listesi temizlenir. Bu işlem geri alınamaz.": "Everyone's overall score and the played quizzes list are cleared. This can't be undone.", "Sıfırla": "Reset", "Düzenlemeden çıkılsın mı?": "Leave without saving your edits?", "Quiz oluşturmaktan çıkılsın mı?": "Stop creating this quiz?", "Kaydetmediğin değişiklikler kaybolur.": "Your unsaved changes will be lost.", "Quiz türü değiştirilsin mi?": "Change the quiz type?", "Türü değiştirirsen eklediklerin silinir.": "Changing the type deletes what you added.", "Sil": "Delete", "Quizdeki tüm şarkılar çıkarılsın mı?": "Remove all songs from the quiz?", "Hepsini çıkar": "Remove all", "Evet": "Yes", "Sayı Quizinden çıkılsın mı?": "Quit the Number Quiz?", "Bu oyun burada biter.": "This game ends here.", "Quizden çıkılsın mı?": "Quit the quiz?", "Bu oyundaki ilerlemen kaybolur.": "Your progress in this game will be lost.", "Lobide başka kimse yok; ayrılırsan lobi kapanır.": "Nobody else is in the lobby; if you leave, it closes.", "Kurucu sensin; ayrılırsan lobi herkes için kapanır.": "You're the host; if you leave, the lobby closes for everyone.", "Bu oyundaki ilerlemen kaybolur. Puanın lobide kalır, kodla geri dönebilirsin.": "Your progress in this game will be lost. Your score stays in the lobby; you can come back with the code.", "Lobiden çıkarılsın mı?": "Remove from the lobby?", "Bu oyuncu lobiden çıkarılır. İstersen davet bağlantısıyla yeniden katılabilir.": "This player will be removed from the lobby. They can rejoin with the invite link if you let them.", "Bu quiz gizlensin mi?": "Hide this quiz?", "Yalnızca senden gizlenir; başkaları görmeye devam eder. Profilinin yanındaki göz simgesinden istediğin zaman geri açabilirsin.": "It's hidden only for you; others still see it. You can bring it back anytime from the eye icon next to your profile.", "Gizle": "Hide", "Listenden kaldırılsın mı?": "Remove from your list?", "Bu quiz yalnızca bu tarayıcıda kayıtlı. Kaldırırsan geri getirilemez.": "This quiz is saved only in this browser. If you remove it, it can't be restored.", "Listenden kalkar. İstersen sonra sanatçıyı yeniden arayıp ekleyebilirsin.": "It leaves your list. You can search for the artist and add it again later.", "Yayından kaldırılsın mı?": "Unpublish?", "Topluluktan kalkar; artık kimse göremez ve oynayamaz. Bu işlem geri alınamaz.": "It leaves Community; nobody can see or play it anymore. This can't be undone.", "Listenden kaldırıldı.": "Removed from your list.", "Bu quiz": "This quiz", "Daha az göster": "Show less", "Quiz oluştur": "Create quiz", "Türünü seç, birkaç dakikada kur. Herkese açık yayınlarsan Topluluk'ta herkes görür.": "Pick a type and build it in minutes. Publish it and everyone sees it under Community.",
  "Anime opening": "Anime opening", "Bölümler": "Sections", "Kategoriler": "Categories", "bugün oynayan": "played today", "Tekrar oyna": "Play again", "Puanın değişmez": "Your score won't change",
  "Sohbeti aç": "Open chat", "Sohbeti kapat": "Close chat", "Geçici · son 10 mesaj": "Temporary · last 10 messages",
  "Açık lobiler": "Open lobbies", "Listeyi yenile": "Refresh list", "Yenile": "Refresh", "Quiz seçiliyor": "Picking a quiz", "Şifreli": "Locked", "Şifreyle katıl": "Join with password",
  "Şu an katılınabilecek açık lobi yok.": "No open lobbies to join right now.", ", “Herkese açık” yap; burada herkes görsün.": ", set it to “Public” and everyone will see it here.",
  // günün quizi
  "Günün quizi": "Daily quiz", "Günün Quizi": "Daily Quiz", "Bugünün quizini çözdün!": "You solved today's quiz!", "Bugün herkes aynı 10 soruyu çözüyor": "Everyone gets the same 10 questions today",
  "Her gün yeni 10 soru, her biri farklı bir kategoriden. İlk oyunun günün sıralamasına yazılır.": "10 new questions every day, each from a different category. Your first game counts for today's leaderboard.",
  "Bugün herkes aynı 10 soruyu çözüyor. İlk oyunun günün sıralamasına yazılır.": "Everyone gets the same 10 questions today. Your first game counts for today's leaderboard.",
  "Hemen oyna": "Play now", "Sonucu paylaş": "Share result", "Günün sıralaması": "Today's leaderboard", "günlük seri": "day streak", "yeni quize kalan": "until the next quiz",
  "Günün quizi kaydedildi. Yarın yeni sorular!": "Daily quiz saved. New questions tomorrow!", "Sonucun kopyalandı; istediğin yere yapıştır.": "Result copied; paste it anywhere.",
  "doğru": "correct", "puan": "points",
  // lobi
  "Lobiye bağlanılıyor": "Connecting to lobby", "Kod": "Code", "Kurucu aranıyor…": "Looking for the host…",
  "Uzun sürüyorsa kodu kontrol et ve kurucunun sayfası açık mı sor. Bazı okul/iş ağları doğrudan bağlantıyı engelleyebilir.": "If this takes long, check the code and ask whether the host's page is open. Some school/work networks block direct connections.",
  "Kurucunun bağlantısı koptu, geri dönmesi bekleniyor…": "The host disconnected, waiting for them to return…", "Kurucunun bağlantısı koptu, bekleniyor…": "The host disconnected, waiting…",
  "Solo oyun": "Solo game", "Lobi": "Lobby", "Hazır mısın?": "Ready?", "Arkadaşlarını çağır": "Invite your friends", "Kurucu hazırlanıyor": "The host is getting ready",
  "Davet bağlantısı": "Invite link", "Kodu kopyala": "Copy code", "Lobi görünürlüğü": "Lobby visibility", "Özel": "Private", "Herkese açık": "Public",
  "Yalnızca bağlantıyı ya da kodu bilenler katılabilir.": "Only people with the link or code can join.",
  "Ana sayfadaki “Açık lobiler” listesinde görünür; oyun başlayınca listeden düşer.": "Shows in “Open lobbies” on the home page; it disappears once the game starts.",
  "Listede kilitli görünür; yalnızca şifreyi girenler katılabilir. Davet bağlantısı şifreyi de içerir.": "Shows as locked in the list; only people with the password can join. The invite link includes the password.",
  "Lobi şifresi": "Lobby password", "Oyuncular": "Players", "Genel sıralama": "Overall ranking", "Kurucu": "Host", "(sen)": "(you)",
  "Bağlantıyı gönder; açan herkes buraya düşer.": "Send the link; everyone who opens it lands here.", "Quiz sırası": "Quiz queue",
  "Aşağıdan bir quiz seç; sıraya eklenir.": "Pick a quiz below to add it to the queue.", "Kurucu henüz quiz eklemedi": "The host hasn't added a quiz yet",
  "Şıklı": "Multiple choice", "Yazarak": "Typed", "Yukarı": "Up", "Aşağı": "Down", "Kaldır": "Remove", "Cevap süresi": "Answer time",
  "Oyunu başlat": "Start game", "Önce quiz ekle": "Add a quiz first", "Kurucunun oyunu başlatması bekleniyor": "Waiting for the host to start",
  "Quiz ekle": "Add quiz", "Quiz ara ya da sanatçı bul…": "Search quizzes or find an artist…", "Quiz ara": "Search quizzes", "Sıraya ekle": "Add to queue",
  "Şarkılar yükleniyor…": "Loading songs…", "20 şık · 5 sıra": "20 options · 5 slots", "Oynanan quizler": "Played quizzes", "Puanları sıfırla": "Reset scores",
  "Tekrar ekle": "Add again", "Kaydedince buraya gelir": "Comes here once saved", "Aramana uyan quiz yok.": "No quiz matches your search.",
  "Bu türde henüz quiz yok; ilkini sen oluştur.": "No quizzes of this type yet; create the first one.",
  "Quizini yeni sekmede oluştur; kaydedince burada sıraya eklemeye hazır açılır.": "Create your quiz in the new tab; once saved it opens here, ready to add to the queue.",
  "Yeni sekme açılamadı. Tarayıcının açılır pencere engelini kaldırıp tekrar dene.": "Couldn't open a new tab. Allow pop-ups and try again.",
  "Lobin artık ana sayfadaki “Açık lobiler”de görünüyor.": "Your lobby now shows in “Open lobbies” on the home page.",
  "Şifre boş olamaz.": "The password can't be empty.", "Şifre kaydedildi. Yeni katılanlar bu şifreyi girmeli.": "Password saved. New players must enter it.",
  "Davet bağlantısı kopyalandı. Arkadaşlarına gönder!": "Invite link copied. Send it to your friends!", "Kod kopyalandı.": "Code copied.",
  "Lobiden ayrılsın mı?": "Leave the lobby?", "Kurucu sensin; ayrılırsan oyun herkes için biter.": "You're the host; if you leave, the game ends for everyone.",
  "Puanın bu lobide kalır, kodla geri dönebilirsin.": "Your score stays in this lobby; you can come back with the code.",
  "Lobiden ayrılmak istediğine emin misin?": "Are you sure you want to leave the lobby?",
  "Quizden çıkmak istediğine emin misin? Bu oyundaki ilerlemen kaybolur.": "Are you sure you want to quit? Your progress in this game will be lost.",
  "Bu lobide oyun başladı. Sıradaki sorudan itibaren sen de oynarsın.": "A game is already running in this lobby. You'll play from the next question.",
  "Kurucu herkesi lobiye döndürdü.": "The host brought everyone back to the lobby.", "Kurucu geri döndü.": "The host is back.",
  "Kurucu seni lobiden çıkardı.": "The host removed you from the lobby.", "Kurucu lobiyi kapattı.": "The host closed the lobby.", "Kurucu ayrıldı, lobi kapandı.": "The host left, the lobby is closed.",
  "Kurucuya bağlı değilsin.": "You're not connected to the host.", "Lobi dolu.": "The lobby is full.", "Bu kimlikle katılamazsın.": "You can't join with this identity.",
  "Bu oyuncu lobide zaten bağlı. Birkaç saniye sonra tekrar dene.": "This player is already connected. Try again in a few seconds.",
  "Bu cihazdan yeniden bağlandın; eski bağlantı kapatıldı.": "You reconnected from this device; the old connection was closed.",
  "Bu lobi şifreli.": "This lobby is password-protected.", "Çok fazla yanlış şifre. Bir dakika sonra tekrar dene.": "Too many wrong passwords. Try again in a minute.", "Şifre yanlış, tekrar dene.": "Wrong password, try again.", "Şifreli lobi": "Locked lobby", "Şifre": "Password",
  "Katılmak için kurucunun verdiği şifreyi yaz.": "Enter the password the host gave you.",
  // sohbet
  "Sohbet": "Chat", "Lobi sohbeti": "Lobby chat", "Geçici · son 10 mesaj · kaydedilmez": "Temporary · last 10 messages · not saved", "Mesaj yaz…": "Type a message…",
  "Mesaj yaz": "Type a message", "Gönder": "Send", "Henüz mesaj yok. Selam ver! 👋": "No messages yet. Say hi! 👋", "Sohbeti genişlet ya da daralt": "Expand or collapse chat",
  "Biraz yavaş: birkaç saniye sonra tekrar yaz.": "Slow down: try again in a few seconds.",
  // quiz ayarları ve detay
  "Şarkı quizi": "Song quiz", "Sıralama quizi": "Ranking quiz", "Anime opening quizi": "Anime opening quiz", "En çok dinlenen şarkılar getiriliyor…": "Fetching the most-played songs…",
  "Sorular hazırlanıyor…": "Preparing questions…", "Bu sanatçı için sıralama hazırlanamadı. Biraz sonra tekrar dene.": "Couldn't prepare a ranking for this artist. Try again later.",
  "doğru yerdeki her şarkı": "each song in the right spot", "ilk 5'te ama yeri yanlış": "in the top 5 but wrong spot", "sıranın tamamı doğruysa": "if the whole order is right",
  "Hız": "Speed", "erken kilitleyen tam puan, son saniyede %60": "lock early for full points, 60% at the last second", "Görüntü": "Video", "Sadece ses": "Audio only",
  "Video açık": "Video on", "Soru sayısı": "Questions", "ikisi birden": "both", "Dönem": "Era", "Cevap": "Answer", "Kesit uzunluğu": "Clip length",
  "Şarkıları seç": "Pick songs", "Kolay": "Easy", "Orta": "Medium", "Zor": "Hard", "Listede ara": "Search the list",
  "Şıklara dokunarak 1'den 5'e sırayla yerleştir, sonra kilitle.": "Tap options to place them from 1 to 5, then lock.",
  "Opening çalarken hem animeyi hem şarkıyı seç; birini bilmek de puan getirir.": "While the opening plays, pick both the anime and the song; getting one right also scores.",
  "Süre bitmeden doğru şıkkı seç; ne kadar hızlıysan o kadar puan. Cevap süresini lobiden değiştirebilirsin.": "Pick the right answer before time runs out; the faster, the more points. You can change the answer time in the lobby.",
  "Oyun modu": "Game mode", "Puanlı": "Ranked", "Serbest": "Casual", "Hayatta Kalma": "Survival", "Soru sayısını ve şarkıları sen seç": "You choose the count and the songs",
  "Soru sayısını sen seç": "You choose the number of questions", "İlk yanlışta oyun biter": "The game ends at the first mistake", "Tüm quizler": "All quizzes",
  "İlk 5 · 20 şık": "Top 5 · 20 options", "Oluşturan": "Created by", "Nasıl oynamak istersin?": "How do you want to play?", "Solo": "Solo", "Tek başına oyna": "Play alone",
  "Lobi kur, bağlantıyı gönder": "Create a lobby, send the link", "Quizi düzenle": "Edit quiz", "ad, yazar, sorular, tür": "name, author, questions, type",
  "Rekorların:": "Your records:", "Kesiti dinle, şarkının adını herkesten önce bul.": "Listen to the clip and name the song before everyone else.",
  "Opening'i dinle; animeyi ve şarkının adını bul. İkisini birden bilen en çok puanı alır.": "Listen to the opening; name the anime and the song. Getting both scores the most.",
  "Dört şıktan doğrusunu süre bitmeden bul; ne kadar hızlıysan o kadar puan.": "Find the right one of four before time runs out; the faster, the more points.",
  "Bu quiz için soru bulunamadı.": "No questions found for this quiz.", "Sorular hazırlanıyor, birazdan tekrar dene.": "Questions are being prepared, try again shortly.",
  "Şarkılar henüz yüklenmedi.": "Songs haven't loaded yet.", "En az bir şarkı seç.": "Pick at least one song.", "Bu dönem için soru bulunamadı.": "No questions found for this era.",
  "Anime verisine şu an ulaşılamadı.": "Couldn't reach anime data right now.", "Sıralama verisine şu an ulaşılamadı.": "Couldn't reach ranking data right now.",
  "Bu quiz şu an açılamadı. Biraz sonra tekrar dene.": "This quiz can't be opened right now. Try again later.",
  "Openingler YouTube'dan her gün toplanıyor; bu quiz çok yakında hazır olacak.": "Openings are collected from YouTube every day; this quiz will be ready very soon.",
  "Sonucun bu quizin puan sıralamasına yazılır; rekor kırarsan eski puanının yerine geçer.": "Your result goes on this quiz's leaderboard; a new record replaces your old score.",
  "tüm şarkılardan karışık": "mixed from all songs",
  // oyun
  "Soru": "Question", "Bu quizdeki puanın": "Your score in this quiz", "açık": "on", "kapalı": "off", "Sıradaki şarkı hazırlanıyor…": "Preparing the next song…",
  "Başlıyor": "Starting", "İlk 5'i doğru sırala · tam isabete +300": "Put the top 5 in order · +300 for a perfect order", "ilk yanlışta oyun biter": "game ends at the first mistake",
  "hızlı olan kazanır": "the fastest wins", "Doğru": "True", "Yanlış": "False", "Süre doldu": "Time's up", "Doğru cevap": "Correct answer", "YouTube'da aç": "Open on YouTube",
  "Kesiti dinle": "Play clip", "Cevabın:": "Your answer:", "Şarkının adını yaz…": "Type the song title…", "Şarkı adı": "Song title", "Quiz sıralaması": "Quiz ranking",
  "Bu soru · Toplam": "This question · Total", "Bu soru": "This question", "Toplam": "Total", "Sonuçları gör": "See results", "Sonraki soru": "Next question", "Sıradaki soru birazdan": "Next question shortly",
  "Cevabın kilitlendi": "Your answer is locked", "Boş kaldı": "Left empty", "Doğru yerde": "Right spot", "İlk 5'te, aslında": "In the top 5, actually", "İlk 5'te değil": "Not in the top 5",
  "doğru yerde": "in the right spot", "kaçtı": "missed", "Hiçbiri tutmadı": "None matched", "Aşağıdan bir şarkı seç": "Pick a song below",
  "Sıralaman kilitlendi": "Your order is locked", "Temizle": "Clear", "Sıralamayı kilitle": "Lock order", "Opening": "Opening",
  "Cevabın kilitlendi, şarkı durduruldu": "Answer locked, song paused", "Ses gelmiyor mu? Dokun": "No sound? Tap", "Anime doğru": "Anime right", "Şarkı doğru": "Song right",
  "Şarkı": "Song", "Dinlemeye devam et": "Keep listening", "Durdur": "Pause", "Dinle": "Listen", "Görüntü kapalı": "Video hidden", "Video açılamadı": "Video unavailable",
  "Bu opening şu an oynatılamıyor": "This opening can't be played right now", "Bu opening'in videosu açılamadı, sıradakine geçiliyor.": "This opening's video won't play, skipping to the next.",
  "Henüz kimse yok. Puanlı modda bir oyun bitir, ilk sen ol!": "Nobody yet. Finish a ranked game and be the first!", "Puan sıralaması": "Leaderboard", "İlk": "Top",
  "Sıralama şu an yüklenemedi.": "Couldn't load the leaderboard right now.", "Bazı şarkılar açılamadığı için bu oyun sıralamaya girmedi.": "Some songs couldn't load, so this game wasn't ranked.",
  "Yeni rekor!": "New record!", "Sıralama puanın": "Your ranking score", "Bu oyunda doğru cevap olmadığı için sıralamaya puan gitmedi. Bir tur daha?": "No correct answers this game, so nothing went to the leaderboard. One more round?",
  "Hepsini bildin, inanılmaz!": "You got them all, incredible!", "Çok iyi gidiyordun!": "You were doing great!", "Bir daha dene, seriyi uzat.": "Try again and extend the streak.",
  "Oyun bitti": "Game over", "Bilgin sağlam!": "You know your stuff!", "Kulağın keskin!": "Sharp ears!", "Fena değil, bir tur daha?": "Not bad, one more round?",
  "Isınma turuydu sayalım.": "Let's call it a warm-up.", "Quiz": "Quiz", "Sıradaki quiz": "Next quiz", "Herkesi lobiye döndür": "Bring everyone back to the lobby", "Lobiyi kapat": "Close lobby",
  "Kurucu lobiye dönünce yeni quizlerle devam edebilirsiniz": "When the host returns to the lobby you can continue with new quizzes",
  "Kurucu başlatınca ya da süre dolunca başlıyor": "Starts when the host starts it or the timer runs out", "Çalıyor…": "Playing…", "Cevap verildi": "Answered", "Hazırlan": "Get ready",
  "Dinlemek için dokun": "Tap to listen", "Dinleme hakkın bitti": "No listens left", "Tekrar dinle": "Listen again", "Sıradaki soru": "Next question", "Tekrar oyna": "Play again",
  "Dinlemek için butona dokun.": "Tap the button to listen.", "Kesit yüklenemedi. Tekrar dinle'ye bas.": "The clip didn't load. Press Listen again.", "Seçmek için dokun": "Tap to choose",
  "Seri": "Streak", "Seri:": "Streak:", "cevapladı": "answered", "Arkadaşlarla oyna": "Play with friends", "Gizlenen quiz yok.": "No hidden quizzes.", "Geri göster": "Show again",
  "Bunlar yalnızca sana gösterilmiyor. Yanlışlıkla gizlediysen geri açabilirsin.": "These are hidden only for you. If you hid one by mistake you can bring it back.",
  "Adsız quiz": "Untitled quiz", "Quiz yayından kaldırıldı.": "Quiz unpublished.", "Gizlendi. Profilinin yanındaki göz simgesinden geri açabilirsin.": "Hidden. You can bring it back from the eye icon next to your profile.",
  "Quiz yeniden gösteriliyor.": "Quiz is visible again.", "Kod 5 karakter olmalı (ör. K7QXM).": "The code must be 5 characters (e.g. K7QXM).",
  "Bu soru cevap almıyor.": "This question isn't taking answers.", "Hem animeyi hem şarkıyı seç.": "Pick both the anime and the song.", "Bir cevap yaz.": "Type an answer.",
  "Geçerli bir şık seç.": "Pick a valid option.", "Bunu yalnızca kurucu yapabilir.": "Only the host can do that.", "Bu soru kapandı.": "This question is closed.",
  "Oyun başladı.": "The game has started.", "Oyun zaten başladı.": "The game already started.", "Oyun sürüyor.": "The game is in progress.", "Bu quiz artık yok.": "This quiz no longer exists.",
  "Kuyrukta en fazla 12 quiz olabilir.": "The queue can hold at most 12 quizzes.", "Önce kuyruğa bir quiz ekle.": "Add a quiz to the queue first.",
  "Bu opening hangi animenin, şarkının adı ne?": "Which anime is this opening from, and what's the song?", "Anonim": "Anonymous",
  "Müzik kataloğu hata verdi.": "The music catalog returned an error.", "Müzik kataloğu yanıt vermedi. Bağlantını kontrol et.": "The music catalog didn't respond. Check your connection.",
  "Müzik kataloğuna ulaşılamadı.": "Couldn't reach the music catalog.", "Bu liste için çalınabilir şarkı bulunamadı.": "No playable songs found for this list.", "Önizleme yok.": "No preview.",
  // sayı quizi
  "Ülke Nüfusu": "Country Population", "Hangisinin nüfusu daha fazla?": "Which has more people?", "Ülke Yüzölçümü": "Country Area", "Hangisinin yüzölçümü daha büyük?": "Which is larger in area?",
  "Dağların Yüksekliği": "Mountain Heights", "Hangisi daha yüksek?": "Which is higher?", "Yapıların Yüksekliği": "Building Heights", "Nehirlerin Uzunluğu": "River Lengths",
  "Hangisi daha uzun?": "Which is longer?", "Hayvanların Ağırlığı": "Animal Weights", "Hangisi daha ağır?": "Which is heavier?", "Hayvanların Hızı": "Animal Speeds",
  "Hangisi daha hızlı?": "Which is faster?", "Hangisi Daha Yeni?": "Which Is Newer?", "Hangisi daha sonra oldu?": "Which happened later?",
  // anime ve sıralama quizleri
  "Bu Karakter Hangi Animeden?": "Which Anime Is This Character From?", "Karakterin görseline bak, hangi animeden olduğunu bil.": "Look at the character and name the anime.",
  "Bu Anime Karakteri Kim?": "Who Is This Anime Character?", "Görseldeki karakterin adını dört şıktan bul.": "Find the character's name among four options.",
  "Kapaktan Animeyi Bil": "Guess the Anime from the Cover", "Anime kapak görselinden hangi anime olduğunu bil.": "Name the anime from its cover art.",
  "Anime Opening Quizi": "Anime Opening Quiz", "Bu Anime Hangi Yıl Çıktı?": "What Year Did This Anime Come Out?", "Popüler animelerin çıkış yılını tahmin et.": "Guess the release year of popular anime.",
  "YouTube'da en çok izlenen 5 şarkısını sırala": "Rank their 5 most-watched songs on YouTube", "En çok dinlenen 5 şarkısını sırala": "Rank their 5 most-played songs",
  // oluşturma sayfası
  "Quiz oluştur": "Create quiz", "Yeni quiz": "New quiz", "Ne tür bir quiz oluşturmak istersin?": "What kind of quiz do you want to create?",
  "Sanatçı ya da şarkı ara, listeni kur. Oyuncular kesiti dinleyip şarkıyı bilir.": "Search artists or songs and build your list. Players hear a clip and name the song.",
  "Şarkı quizi gibi listeni kur; oyunda kesitler tersten çalar.": "Build a list like a song quiz; in the game the clips play backwards.",
  "Kendi sorularını ve şıklarını yaz, istersen görsel ekle.": "Write your own questions and options, add images if you like.",
  "Bir sanatçı seç; en çok dinlenen 5 şarkısı ve 20 şık otomatik hazırlanır.": "Pick an artist; their 5 most-played songs and 20 options are prepared automatically.",
  "YouTube bağlantısını yapıştır, animenin ve şarkının adını yaz.": "Paste a YouTube link and type the anime and song names.", "Anime Opening": "Anime Opening",
  "Quiz adı": "Quiz name", "Kısa açıklama": "Short description", "(isteğe bağlı)": "(optional)", "Bu quiz ne hakkında?": "What is this quiz about?", "Quizdeki şarkılar": "Songs in the quiz",
  "Quiz türü": "Quiz type", "Değiştir": "Change", "Normal": "Normal", "Quiz hazır": "Quiz ready", "Şıkları yeniden karıştır": "Reshuffle options", "Gizli": "Hidden",
  "Sanatçı bulunamadı. Yazımı kontrol et.": "No artist found. Check the spelling.", "Opening ekle": "Add opening", "YouTube bağlantısı": "YouTube link", "Anime adı": "Anime name",
  "Herkese açık yayınla": "Publish publicly", "Topluluk sekmesinde herkes görür ve oynar.": "Everyone sees and plays it under Community.", "Yazar adı": "Author name",
  "Quizde görünecek adın": "Your name shown on the quiz", "Yayınlanıyor…": "Publishing…", "Kaydediliyor…": "Saving…", "Güncelle ve yayınla": "Update and publish", "Yayınla": "Publish",
  "Trivia adı": "Trivia name", "Bu trivia ne hakkında?": "What is this trivia about?", "Kategori": "Category", "Soru ekle": "Add question", "Sorularını buraya yapıştır…": "Paste your questions here…",
  "Soruları ekle": "Add questions", "Çoktan seçmeli": "Multiple choice", "Doğru / Yanlış": "True / False", "Yukarı taşı": "Move up", "Aşağı taşı": "Move down", "Görsel ekle": "Add image",
  "Soruyu sil": "Delete question", "Soruyla göster": "Show with question", "Cevapla göster": "Show with answer", "Görseli kaldır": "Remove image", "Yanlış şık": "Wrong option",
  "Sanatçı": "Artist", "Şarkı bulunamadı.": "No songs found.", "Sanatçı sonuçlarına dön": "Back to artist results", "Popüler şarkılar": "Popular songs", "İlk 15'i ekle": "Add top 15",
  "Hepsini ekle": "Add all", "Albümler": "Albums", "Tüm albümlerdeki şarkıları ekle": "Add songs from all albums", "Albümü ekle": "Add album", "Quize bir ad ver.": "Give the quiz a name.",
  "Önce bir sanatçı seç.": "Pick an artist first.", "Bunlar zaten ekli.": "These are already added.", "Önizlemeyi dinle": "Play preview", "Çıkar": "Remove",
  "Önizleme çalınamadı.": "Couldn't play the preview.", "Yeni şarkı yok.": "No new songs.", "Quizdeki tüm şarkılar çıkarılsın mı?": "Remove all songs from the quiz?",
  "Quiz türünü değiştirirsen eklediklerin silinir. Devam edilsin mi?": "Changing the quiz type deletes what you added. Continue?", "Lobiye gönderildi": "Sent to the lobby",
  "Bu sekmeyi kapatıp lobi sekmesine dönebilirsin.": "You can close this tab and go back to the lobby tab.", "Bu quiz bulunamadı ya da senin değil.": "This quiz wasn't found or isn't yours.",
  "Quiz yayınlanamadı. İnternet bağlantını kontrol edip tekrar dene.": "Couldn't publish the quiz. Check your connection and try again.", "Kaldırılamadı. Bağlantını kontrol et.": "Couldn't remove. Check your connection.",
  "Dinlenme verileri alınıyor": "Fetching play data", "En çok dinlenen 5 şarkı sıralanıyor": "Ranking the 5 most-played songs", "15 şaşırtmaca şık seçiliyor": "Choosing 15 decoy options",
  "Aranıyor": "Searching", "Görsel alanı": "Image area", "Doğru cevap açılınca görünür.": "Shown when the answer is revealed.", "Soru sorulurken görünür (ör. “Bu kim?”).": "Shown with the question (e.g. “Who is this?”).",
  "Tek tek şarkı ara ve ekle. Farklı sanatçılardan karışık bir quiz yapabilirsin.": "Search and add songs one by one. You can mix songs from different artists.",
  // lobi: istekler, kuruculuk, emoji, oluşturma, tema
  "Quiz öner": "Suggest a quiz", "İstekler": "Requests", "Ekle": "Add", "İsteği kaldır": "Remove request", "Ben de istiyorum": "I want this too", "Oyunu geri al": "Take back your vote",
  "Oynamak istediğin quize dokun; kurucuya ve herkese istek olarak gider. Başkasının isteğine dokunursan oy vermiş olursun.": "Tap a quiz you want to play; it goes to the host and everyone as a request. Tapping someone else's request counts as a vote.",
  "Oyuncuların görmek istediği quizler. “Ekle” ile ayarlarını seçip sıraya koyabilirsin.": "Quizzes players want to play. Use “Add” to pick settings and queue them.",
  "Kurucu henüz quiz eklemedi. Aşağıdan istediğin quizi öner.": "The host hasn't added a quiz yet. Suggest one below.",
  "İsteğin kurucuya ve herkese gitti.": "Your request went to the host and everyone.", "En fazla 3 isteğe oy verebilirsin; birini geri al.": "You can vote for up to 3 requests; take one back.",
  "İstek listesi dolu. Kurucu birkaçını eklesin ya da silsin.": "The request list is full. The host should add or remove some.", "Bu quiz kurucuda bulunamadı. Başka bir quiz seç.": "The host doesn't have this quiz. Pick another one.",
  "Oyun sürerken istek gönderilemez.": "You can't send requests during a game.", "Geçersiz istek.": "Invalid request.", "Bu quiz artık bulunamıyor.": "This quiz can't be found anymore.",
  "Kurucu yap": "Make host", "Kurucu yapılsın mı?": "Make them host?", "Kurucu değişiyor": "Host is changing", "Yeni kurucuya bağlanılıyor…": "Connecting to the new host…",
  "Lobiyi artık o yönetir: quiz ekler, oyunu başlatır. Sen oyuncu olarak lobide kalırsın; quiz sırası, puanlar ve sohbet olduğu gibi sürer.": "They'll run the lobby now: add quizzes, start the game. You stay in the lobby as a player; the queue, scores and chat carry on.",
  "Artık lobinin kurucususun: quiz ekleyip oyunu başlatabilirsin.": "You're the host now: add quizzes and start the game.", "Yeni kurucuya bağlandın.": "Connected to the new host.",
  "Kuruculuk yalnızca lobideyken devredilebilir.": "Host can only be handed over in the lobby.", "Bu oyuncu şu an bağlı değil.": "This player isn't connected right now.",
  "Emoji gönder": "Send emoji", "Biraz yavaş!": "Slow down a bit!", "Lobi oluştur": "Create lobby",
  "Lobi herkese açılsın mı?": "Make the lobby public?", "Herkese aç": "Make public",
  "Lobin ana sayfadaki “Açık lobiler” listesinde görünür; kodu bilmeyen herkes de katılabilir. Oyun başlayınca listeden düşer, istediğin zaman yeniden özel yapabilirsin.": "Your lobby shows in “Open lobbies” on the home page; anyone can join, even without the code. It leaves the list when the game starts, and you can make it private again anytime.",
  "Lobin artık özel: yalnızca kodu ya da bağlantıyı bilenler katılabilir.": "Your lobby is private now: only people with the code or link can join.",
  "Yeni quiz oluştur": "Create a new quiz", "Lobiden çıkmadan; kaydedince sıraya eklemeye hazır açılır": "Without leaving the lobby; once saved it opens ready to queue", "Lobiden çıkmadan oluştur": "Create without leaving",
  "Tüm quizlerde ara ya da sanatçı bul…": "Search all quizzes or find an artist…", "Quizler yükleniyor…": "Loading quizzes…",
  "Quiz oluşturmaktan çıkılsın mı?": "Leave quiz creation?", "Kaydetmediğin değişiklikler kaybolur. Lobin açık kalır.": "Unsaved changes will be lost. Your lobby stays open.",
  "Açık tema": "Light theme", "Koyu tema": "Dark theme", "Açık temaya geç": "Switch to light theme", "Koyu temaya geç": "Switch to dark theme",
  "Quizin bağlantısını kopyala": "Copy quiz link", "Quizin bağlantısı kopyalandı.": "Quiz link copied.", "Quizin yayında! Bağlantısını kopyalayıp paylaşabilirsin.": "Your quiz is live! Copy its link and share it.",
  "Bu bağlantıdaki quiz bulunamadı; adı değişmiş ya da kaldırılmış olabilir.": "The quiz at this link wasn't found; it may have been renamed or removed.",
  "Quiz adında uygunsuz bir kelime var. Lütfen değiştir.": "The quiz name has an inappropriate word. Please change it.", "Açıklamada uygunsuz bir kelime var. Lütfen değiştir.": "The description has an inappropriate word. Please change it.",
  "Yazar adında uygunsuz bir kelime var. Lütfen değiştir.": "The author name has an inappropriate word. Please change it.",
  "Cevapları gör": "See answers", "Bugünün cevapları": "Today's answers", "cevap vermedin": "no answer", "Quizin yükleniyor…": "Loading your quiz…", "Quizi düzenle": "Edit quiz",
  "Topluluktaki son hali getiriliyor.": "Fetching the latest version from Community.", "Doğru cevaplar (bu oyundaki kendi cevapların kaydedilmemiş).": "Correct answers (your own answers from this game weren't saved).", "Bayrak": "Flag", "Ülkenin haritadaki şekli": "Country shape on the map",
};
const EN = new Map(Object.entries(D));
const DAYS = { Pazar: "Sunday", Pazartesi: "Monday", Salı: "Tuesday", Çarşamba: "Wednesday", Perşembe: "Thursday", Cuma: "Friday", Cumartesi: "Saturday" };
const MONTHS = { Ocak: "January", Şubat: "February", Mart: "March", Nisan: "April", Mayıs: "May", Haziran: "June", Temmuz: "July", Ağustos: "August", Eylül: "September", Ekim: "October", Kasım: "November", Aralık: "December" };
const KINDS = { "şarkı": "song", "sıralama": "ranking", "tersten şarkı": "reverse song", "anime opening": "anime opening", "trivia": "trivia" };
const pl = (n, one, many) => `${n} ${Number(String(n).replace(/\D/g, "")) === 1 ? one : many}`;
const RX = [
  [/^([\d.]+) soru$/, (_, n) => pl(n, "question", "questions")],
  [/^([\d.]+) şarkı$/, (_, n) => pl(n, "song", "songs")],
  [/^([\d.]+) quiz$/, (_, n) => pl(n, "quiz", "quizzes")],
  [/^([\d.]+) sanatçı$/, (_, n) => pl(n, "artist", "artists")],
  [/^([\d.]+) opening$/, (_, n) => pl(n, "opening", "openings")],
  [/^([\d.]+) öğe$/, (_, n) => pl(n, "item", "items")],
  [/^([\d.]+) şık$/, (_, n) => pl(n, "option", "options")],
  [/^(\d+) sn$/, "$1 s"],
  [/^(\d+) sn içinde$/, "in $1 s"],
  [/^([\d.]+) kez oynandı$/, (_, n) => `Played ${n} ${n === "1" ? "time" : "times"}`],
  [/^([\d.]+) soruluk seri$/, "$1-question streak"],
  [/^([\d.]+) hayran$/, "$1 fans"],
  [/^(\d+) karma liste, şarkı tersten çalar$/, "$1 mixed lists, songs play backwards"],
  [/^(\d+) quiz, binlerce soru$/, "$1 quizzes, thousands of questions"],
  [/^Hepsi \((\d+)\)$/, "All ($1)"],
  [/^(\d+)\/(\d+) seçildi$/, "$1/$2 selected"],
  [/^(\d+) soru · sıralamaya girer$/, "$1 questions · counts for the leaderboard"],
  [/^“(.+)” sıraya eklendi\.$/, "“$1” added to the queue."],
  [/^(.+) lobiye katıldı\.$/, "$1 joined the lobby."],
  [/^Adın: (.+)\. Sağ üstten istediğin zaman değiştirebilirsin\.$/, "Your name: $1. You can change it anytime from the top right."],
  [/^Lobin listede kilitli görünüyor\. Şifre: (\S+) \(değiştirebilirsin\)$/, "Your lobby shows as locked in the list. Password: $1 (you can change it)"],
  [/^Sıradaki quiz: (.+)$/, "Next quiz: $1"],
  [/^(.+) quizlerinde ara…$/, (_, t) => `Search ${tr1(t) || t} quizzes…`],
  [/^Yeni (.+) quizi oluştur$/, (_, k) => `Create a new ${KINDS[k] || k} quiz`],
  [/^Yeni quiz oluştur$/, "Create a new quiz"],
  [/^(.+) için en çok dinlenen 5 şarkıyı 20 şık arasından bul ve doğru sıraya diz\.$/, "Find $1's 5 most-played songs among 20 options and put them in order."],
  [/^(.+) quizini aç$/, "Open quiz $1"],
  [/^(.+) lobisine katıl$/, "Join $1's lobby"],
  [/^(.+) lobiden çıkar$/, "Remove $1 from the lobby"],
  [/^(\d+) (\S+) (\S+)$/, (m, d, mo, day) => (MONTHS[mo] && DAYS[day] ? `${DAYS[day]}, ${d} ${MONTHS[mo]}` : null)],
  [/^Simge (.+)$/, "Icon $1"],
  [/^(\d+)\/(\d+) oyuncu$/, "$1/$2 players"],
  [/^(\d+)\. (soru|opening) silinsin mi\?$/, (_, n, w) => `Delete ${w === "soru" ? "question" : "opening"} ${n}?`],
  [/^“(.+)” topluluktan kalkar; artık kimse göremez ve oynayamaz\. Bu işlem geri alınamaz\.$/, "“$1” will leave Community; nobody can see or play it anymore. This can't be undone."],
  [/^(\d+) soruluk serin burada biter\.( Rekorun (\d+)\.)?$/, (_, n, __, b) => `Your ${n}-question streak ends here.${b ? ` Your record is ${b}.` : ""}`],
  [/^Tüm lobileri gör \((\d+)\)$/, "See all lobbies ($1)"],
  [/^Sohbeti aç \((\d+) yeni mesaj\)$/, "Open chat ($1 new messages)"],
  [/^Trivia · (.+)$/, (_, c) => `Trivia · ${tr1(c) || c}`],
  [/^(.+) için YouTube'daki gerçek en çok izlenen şarkılar hazırlanıyor\. Liste her gün güncellenir; en geç 1–2 gün içinde oynanabilir\.$/, "$1's real most-watched songs on YouTube are being prepared. The list updates daily; it'll be playable within 1–2 days."],
  [/^"(.+)" yayından kaldırılsın mı\? Başkaları artık göremez\.$/, "Unpublish \"$1\"? Others won't see it anymore."],
  [/^"(.+)" hazır\. Ayarlarını seçip sıraya ekle\.$/, "\"$1\" is ready. Pick its settings and add it to the queue."],
  [/^Rekorun (.+)$/, "Your record $1"],
  [/^(.+) istiyor: (.+)$/, "$1 wants: $2"],
  [/^Senin cevabın: (.+)$/, "Your answer: $1"],
  [/^(\d+)\/(\d+) doğru · (\d+) puan$/, "$1/$2 correct · $3 points"],
  [/^“(.+)” kurucuya istek olarak gitti\.$/, "“$1” went to the host as a request."],
  [/^Kuruculuk (.+) devredildi\. Lobide oyuncu olarak devam ediyorsun\.$/, "Host handed over to $1. You continue in the lobby as a player."],
  [/^(.+) kurucu olsun$/, "Make $1 host"],
  [/^(\d+) oy$/, (_, n) => pl(n, "vote", "votes")],
  [/^“(.+)” adında bir quiz zaten var \((.+)\)\. Lütfen farklı bir ad seç\.$/, "A quiz named “$1” already exists ($2). Please choose a different name."],
  [/^rekorun (.+)$/, "your record $1"],
];
function tr1(t) {
  if (EN.has(t)) return EN.get(t);
  for (const [re, f] of RX) {
    const m = t.match(re);
    if (!m) continue;
    const r = typeof f === "function" ? f(...m) : t.replace(re, f);
    if (r != null) return r;
  }
  return null;
}
const HAS_LETTER = /[A-Za-zÇĞİÖŞÜçğıöşü]/;
/** Bir metni çevirir; bilinmiyorsa null. Baştaki/sondaki "·" ve " · " ile ayrılmış parçalar ayrı ayrı denenir. */
export function T(text) {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!t || !HAS_LETTER.test(t)) return null;
  let r = tr1(t);
  if (r == null) {
    const m = t.match(/^([·•:]\s*)?(.*?)(\s*[·•:])?$/);
    if (m && (m[1] || m[3])) { const c = tr1(m[2]); if (c != null) r = (m[1] || "") + c + (m[3] || ""); }
  }
  if (r == null) {
    // başta simge/emoji varsa ("👥 Ülke Nüfusu")
    const m = t.match(/^([^A-Za-zÇĞİÖŞÜçğıöşü"“(]+)(.+)$/u);
    if (m) { const c = T(m[2]); if (c != null) r = m[1] + c; }
  }
  if (r == null && t.includes(" · ")) {
    const parts = t.split(" · ");
    const out = parts.map((p) => tr1(p) ?? p);
    if (out.some((p, i) => p !== parts[i])) r = out.join(" · ");
  }
  return r;
}
const ATTRS = ["placeholder", "title", "aria-label"];
function fixText(node) {
  const v = node.nodeValue;
  const r = T(v);
  if (r != null) {
    const t = v.replace(/\s+/g, " ").trim();
    const nv = v.includes(t) ? v.replace(t, r) : r;
    if (nv !== v) node.nodeValue = nv;
  }
}
function fixAttrs(el) {
  for (const a of ATTRS) {
    const v = el.getAttribute?.(a);
    if (v) { const r = T(v); if (r != null && r !== v) el.setAttribute(a, r); }
  }
}
function walk(root) {
  if (root.nodeType === 3) { if (!root.parentElement?.closest("[data-noi18n],script,style")) fixText(root); return; }
  if (root.nodeType !== 1 || root.closest("[data-noi18n],script,style")) return;
  fixAttrs(root);
  const it = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.nodeType === 1 && (n.hasAttribute("data-noi18n") || n.tagName === "SCRIPT" || n.tagName === "STYLE") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let n = it.nextNode(); n; n = it.nextNode()) n.nodeType === 3 ? fixText(n) : fixAttrs(n);
}
let obs = null;
const c0 = window.confirm.bind(window);
window.confirm = (m) => c0(LANG === "en" ? T(m) ?? m : m);
function start() {
  walk(document.body);
  if (obs) return;
  obs = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === "characterData") walk(m.target);
      else if (m.type === "attributes") fixAttrs(m.target);
      else m.addedNodes.forEach(walk);
    }
  });
  obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}
function stop() {
  obs?.disconnect();
  obs = null;
}
/** İngilizce seçiliyse sayfayı çevirmeye başlar (sonradan çizilen her şey de çevrilir). */
export function initI18n() {
  document.documentElement.lang = LANG;
  if (LANG === "en") start();
}
