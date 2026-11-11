// Milli takım adları (Türkçe) ve Transfermarkt uyruk eşleştirmesi.
export const TR = { Turkey: 'Türkiye', Germany: 'Almanya', France: 'Fransa', Spain: 'İspanya', Italy: 'İtalya', England: 'İngiltere', Netherlands: 'Hollanda', Belgium: 'Belçika', Portugal: 'Portekiz', Brazil: 'Brezilya', Argentina: 'Arjantin', Croatia: 'Hırvatistan', Switzerland: 'İsviçre', Denmark: 'Danimarka', Sweden: 'İsveç', Norway: 'Norveç', Poland: 'Polonya', Greece: 'Yunanistan', Russia: 'Rusya', Ukraine: 'Ukrayna', Scotland: 'İskoçya', Wales: 'Galler', Ireland: 'İrlanda', Austria: 'Avusturya', 'Czech Republic': 'Çekya', Serbia: 'Sırbistan', Romania: 'Romanya', Hungary: 'Macaristan', Japan: 'Japonya', 'South Korea': 'Güney Kore', 'United States': 'ABD', Mexico: 'Meksika', Morocco: 'Fas', Egypt: 'Mısır', Algeria: 'Cezayir', Tunisia: 'Tunus', Senegal: 'Senegal', Nigeria: 'Nijerya', Ghana: 'Gana', Cameroon: 'Kamerun', 'Saudi Arabia': 'Suudi Arabistan', Iran: 'İran', Australia: 'Avustralya', Colombia: 'Kolombiya', Uruguay: 'Uruguay', Chile: 'Şili', Azerbaijan: 'Azerbaycan', Georgia: 'Gürcistan', Albania: 'Arnavutluk', Bulgaria: 'Bulgaristan', Slovakia: 'Slovakya', Slovenia: 'Slovenya', Finland: 'Finlandiya', Iceland: 'İzlanda', Israel: 'İsrail' };
export const NAT_ALIAS = { Turkey: 'Türkiye', 'Bosnia and Herzegovina': 'Bosnia-Herzegovina', 'Ivory Coast': "Cote d'Ivoire", 'Republic of Ireland': 'Ireland', 'South Korea': 'Korea, South', Gambia: 'The Gambia', Taiwan: 'Chinese Taipei', 'Curaçao': 'Curacao' };
import { lang } from './i18n.js';
// Türkçe modda Türkçe ad; İngilizce modda veri zaten İngilizce olduğundan olduğu gibi döner.
export const tr = n => (lang === 'en' ? n : TR[n] || n);
// competitions.json ülke alanları Türkçe tutulur; İngilizce modda geri çevrilir ("İngiltere" → "England").
const EN_OF = Object.fromEntries(Object.entries(TR).map(([e, t]) => [t, e]));
EN_OF['Çekya'] = 'Czech Republic';
export const countryEn = c => (c === 'ABD' ? 'United States' : EN_OF[c] || c);
export const COMP_EN = { 'Rusya Kupası': 'Russian Cup', 'Danimarka Kupası': 'Danish Cup', 'Ukrayna Kupası': 'Ukrainian Cup', 'Süper Kupa': 'Turkish Super Cup',
  'Belçika Süper Kupası': 'Belgian Super Cup', 'Rusya Süper Kupası': 'Russian Super Cup', 'Şampiyonlar Ligi': 'Champions League', 'Avrupa Ligi': 'Europa League',
  'Konferans Ligi': 'Conference League', 'Şampiyonlar Ligi Elemeleri': 'Champions League Qualifying', 'Avrupa Ligi Elemeleri': 'Europa League Qualifying',
  'Konferans Ligi Elemeleri': 'Conference League Qualifying', 'UEFA Süper Kupa': 'UEFA Super Cup', 'Dünya Kupası': 'World Cup',
  'Afrika Uluslar Kupası': 'Africa Cup of Nations', 'Asya Kupası': 'AFC Asian Cup' };
