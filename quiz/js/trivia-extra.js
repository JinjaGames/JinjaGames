// Trivia soru havuzlarını büyütür: her quizde en az 50 soru olsun ki oyuncular ezberleyemesin.
// Parça dosyaları (trivia-x*.js) quiz kimliğine göre ek sorular verir; trivia.js bunları birleştirir.
import X1 from "./trivia-x1.js";
import X2 from "./trivia-x2.js";
import X3 from "./trivia-x3.js";
import X4 from "./trivia-x4.js";
import X5 from "./trivia-x5.js";
import X6 from "./trivia-x6.js";
import X7 from "./trivia-x7.js";

export const EXTRA = {};
for (const part of [X1, X2, X3, X4, X5, X6, X7])
  for (const [id, items] of Object.entries(part)) (EXTRA[id] ||= []).push(...items);

// Ülke ve başkent adından bayrak kodu (cevap açılınca bayrağı göstermek için).
const C = {
  tr: ["Türkiye", "Ankara"], ca: ["Kanada", "Ottawa"], ch: ["İsviçre", "Bern"], jp: ["Japonya", "Tokyo"], kr: ["Güney Kore", "Seul"],
  cn: ["Çin", "Pekin"], vn: ["Vietnam", "Hanoi"], au: ["Avustralya", "Canberra"], nz: ["Yeni Zelanda", "Wellington"], br: ["Brezilya", "Brasilia"],
  ar: ["Arjantin", "Buenos Aires"], mx: ["Meksika", "Meksiko"], us: ["ABD", "Amerika Birleşik Devletleri", "Washington"], gb: ["Birleşik Krallık", "İngiltere", "Londra"],
  fr: ["Fransa", "Paris"], de: ["Almanya", "Berlin"], it: ["İtalya", "Roma"], es: ["İspanya", "Madrid"], pt: ["Portekiz", "Lizbon"], nl: ["Hollanda", "Amsterdam"],
  be: ["Belçika", "Brüksel"], at: ["Avusturya", "Viyana"], gr: ["Yunanistan", "Atina"], se: ["İsveç", "Stockholm"], no: ["Norveç", "Oslo"], fi: ["Finlandiya", "Helsinki"],
  dk: ["Danimarka", "Kopenhag"], is: ["İzlanda", "Reykjavik"], ie: ["İrlanda", "Dublin"], pl: ["Polonya", "Varşova"], cz: ["Çekya", "Çek Cumhuriyeti", "Prag"],
  hu: ["Macaristan", "Budapeşte"], ro: ["Romanya", "Bükreş"], bg: ["Bulgaristan", "Sofya"], ua: ["Ukrayna", "Kiev"], ru: ["Rusya", "Moskova"],
  rs: ["Sırbistan", "Belgrad"], hr: ["Hırvatistan", "Zagreb"], si: ["Slovenya", "Ljubljana"], sk: ["Slovakya", "Bratislava"], al: ["Arnavutluk", "Tiran"],
  mk: ["Kuzey Makedonya", "Üsküp"], ba: ["Bosna-Hersek", "Bosna Hersek", "Saraybosna"], me: ["Karadağ", "Podgorica"], ge: ["Gürcistan", "Tiflis"], az: ["Azerbaycan", "Bakü"],
  am: ["Ermenistan", "Erivan"], kz: ["Kazakistan", "Astana"], uz: ["Özbekistan", "Taşkent"], tm: ["Türkmenistan", "Aşkabat"], kg: ["Kırgızistan", "Bişkek"],
  ir: ["İran", "Tahran"], iq: ["Irak", "Bağdat"], sy: ["Suriye", "Şam"], sa: ["Suudi Arabistan", "Riyad"], eg: ["Mısır", "Kahire"], ma: ["Fas", "Rabat"],
  dz: ["Cezayir"], tn: ["Tunus"], ly: ["Libya", "Trablus"], ng: ["Nijerya", "Abuja"], ke: ["Kenya", "Nairobi"], et: ["Etiyopya", "Addis Ababa"], za: ["Güney Afrika", "Pretoria"],
  in: ["Hindistan", "Yeni Delhi"], pk: ["Pakistan", "İslamabad"], bd: ["Bangladeş", "Dakka"], th: ["Tayland", "Bangkok"], id: ["Endonezya", "Cakarta"], my: ["Malezya", "Kuala Lumpur"],
  ph: ["Filipinler", "Manila"], sg: ["Singapur"], np: ["Nepal", "Katmandu"], mn: ["Moğolistan", "Ulan Batur"], af: ["Afganistan", "Kabil"], il: ["İsrail"], ps: ["Filistin"],
  jo: ["Ürdün", "Amman"], lb: ["Lübnan", "Beyrut"], qa: ["Katar", "Doha"], ae: ["Birleşik Arap Emirlikleri", "BAE", "Abu Dabi"], kw: ["Kuveyt"], om: ["Umman", "Maskat"],
  cl: ["Şili", "Santiago"], pe: ["Peru", "Lima"], co: ["Kolombiya", "Bogota"], ve: ["Venezuela", "Karakas"], cu: ["Küba", "Havana"], jm: ["Jamaika", "Kingston"],
  uy: ["Uruguay", "Montevideo"], py: ["Paraguay", "Asuncion"], bo: ["Bolivya", "La Paz"], ec: ["Ekvador", "Quito"], lt: ["Litvanya", "Vilnius"], lv: ["Letonya", "Riga"],
  ee: ["Estonya", "Tallinn"], by: ["Belarus", "Minsk"], md: ["Moldova", "Kişinev"], lu: ["Lüksemburg"], mt: ["Malta", "Valletta"], cy: ["Kıbrıs", "Lefkoşa"],
  mc: ["Monako"], va: ["Vatikan"], sm: ["San Marino"], ad: ["Andorra"], li: ["Lihtenştayn", "Vaduz"], gh: ["Gana", "Akra"], sn: ["Senegal", "Dakar"],
  cm: ["Kamerun"], ci: ["Fildişi Sahili"], tz: ["Tanzanya"], ug: ["Uganda", "Kampala"], sd: ["Sudan", "Hartum"], so: ["Somali", "Mogadişu"], mg: ["Madagaskar"],
  lk: ["Sri Lanka"], mm: ["Myanmar"], kh: ["Kamboçya", "Phnom Penh"], la: ["Laos"], kp: ["Kuzey Kore", "Pyongyang"], tw: ["Tayvan", "Taipei"],
  "gb-sct": ["İskoçya", "Edinburgh"], "gb-wls": ["Galler", "Cardiff"], ye: ["Yemen", "Sana"], bh: ["Bahreyn", "Manama"], pa: ["Panama"], cr: ["Kosta Rika"],
  bs: ["Bahamalar"], ht: ["Haiti"], do: ["Dominik Cumhuriyeti"], ml: ["Mali"], ne: ["Nijer"], td: ["Çad"], ao: ["Angola"], mz: ["Mozambik"], zw: ["Zimbabve"],
  bt: ["Butan"], bn: ["Brunei"], mv: ["Maldivler"], fj: ["Fiji"], pg: ["Papua Yeni Gine"], xk: ["Kosova", "Priştine"],
};
const CODE = new Map();
for (const [code, names] of Object.entries(C)) for (const n of names) CODE.set(n, code);
// Bu quizlerde doğru cevap bir ülke ya da başkentse bayrak gösterilir.
export const FLAG_QUIZZES = new Set(["t-bayraklar", "t-baskentler", "t-avrupa", "t-nereden"]);
export const flagFor = (answer) => CODE.get(answer) || "";
