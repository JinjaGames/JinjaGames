// Profil simgeleri: müzik simgeleri ve harfler (Türk alfabesi + Q, W, X). Ağdan gelen değer bu listede değilse kulaklık olur.
export const ICON_AVATARS = ["headphones", "guitar", "mic-vocal", "disc-3", "radio", "drum"];
export const LETTER_AVATARS = [..."ABCÇDEFGĞHIİJKLMNOÖPQRSŞTUÜVWXYZ"];
export const AVATARS = [...ICON_AVATARS, ...LETTER_AVATARS];
export const okAvatar = (a) => (AVATARS.includes(a) ? a : "headphones");
export const isLetterAvatar = (a) => LETTER_AVATARS.includes(a);
