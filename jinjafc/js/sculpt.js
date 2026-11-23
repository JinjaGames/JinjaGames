// EA SPORTS FC 27 oyuncu oluşturucu, Sculpt > Shape menüsünün yapısı.
// Kaynak: oyun içi ekran kayıtları (Clubs / Create Your Pro; Haaland, LeBron James, Neymar, Pessi ve Sophie Rain yüz videoları). Adlar oyundaki İngilizce hâliyle.
// Her kaydırıcı 0-100; çift yönlüler (Narrow–Widen gibi) 50'de nötr, "Neutral–X" olanlar 0'da nötr.
// Not: Weight ve Definition sekmelerinin içeriği bu kaynakta görünmüyor; bu yüzden listede yok.

// kaydırıcı türleri: [sol uç, sağ uç, nötr değer]
export const S = {
  NW: ["Narrow", "Widen", 50], DU: ["Down", "Up", 50], BF: ["Back", "Forward", 50], NF: ["Neutral", "Forward", 0],
  RA: ["Round", "Angular", 50], NR: ["Neutral", "Round", 0], SH: ["Shift Left", "Shift Right", 50], LS: ["Larger", "Smaller", 50],
  LM: ["Less", "More", 50], NL: ["Neutral", "Less", 0], NU: ["Neutral", "Up", 0],
};
const box = (...k) => k;
// LAYER > REGION > SUBREGION: kaydırıcılar
export const SCULPT = {
  Skeletal: {
    Head: { Skull: box("NW", "DU", "NF", "RA", "SH"), "Skull Crown": box("NW", "DU", "BF", "NR", "SH"), "Skull Back": box("NW", "DU", "BF", "RA", "SH"), Temples: box("NW", "DU", "BF", "RA") },
    Forehead: { "Lower Forehead": box("NW", "DU", "BF", "RA"), "Upper Forehead": box("NW", "BF", "NU", "RA", "SH") },
    "Brow Ridge": { Eyebrows: box("NW", "DU", "BF", "RA"), "Eyebrows Center": box("NW", "DU", "BF", "RA", "SH"), "Eyebrows Outside Top": box("NW", "DU", "BF", "RA") },
    Eyes: { Eyes: box("NW", "DU", "BF", "LS"), "Eye Sockets": box("NW", "DU", "BF", "LS") },
    Ears: { Ears: box("NW", "DU", "BF", "LS", "SH") },
    Nose: { Nose: box("NW", "DU", "BF", "RA", "SH"), "Nose Bridge Upper": box("NW", "DU", "BF", "RA", "SH"), "Nose Bridge Center": box("NW", "DU", "BF", "RA", "SH"), "Nose Bridge Sides": box("NW", "DU", "BF", "RA") },
    Cheeks: { Cheeks: box("NW", "DU", "BF", "RA") },
    Mouth: { Mouth: box("NW", "DU", "BF", "RA", "SH"), "Mouth Outside Top": box("NW", "DU", "BF", "RA") },
    Chin: { Chin: box("NW", "DU", "BF", "RA", "SH"), "Upper Chin": box("NW", "DU", "BF", "RA", "SH") },
    Jaw: { Jaw: box("NW", "DU", "BF", "RA"), "Inside Jaw Top": box("NW", "DU", "BF", "RA"), "Inside Jaw Bottom": box("NW", "DU", "BF", "RA") },
  },
  Flesh: {
    Head: { Temples: box("LM") },
    Forehead: { "Upper Forehead": box("NW", "BF", "NU", "RA", "SH") },
    "Brow Ridge": { "Eyebrows Center": box("DU", "LM"), "Eyebrow Gap": box("DU", "LM") },
    Eyes: { "Eye Corner Inner": box("NW", "DU", "LS"), "Eye Corner Outer": box("NW", "DU", "LS"), "Upper Inner Eyelid": box("NW", "DU", "LS"), "Eyelid Upper Outer": box("NW", "DU", "LS"),
      "Eyelid Fold Inner": box("NW", "DU", "BF", "LS"), "Eyelid Fold Center": box("NW", "DU", "BF", "LS"), "Eyelid Fold Outer": box("NW", "DU", "BF", "LS"),
      "Eyelid Lower Inner": box("NW", "DU", "LS"), "Eyelid Lower Center": box("NW", "DU", "LS"), "Eyelid Lower Outer": box("NW", "DU", "LS") },
    Ears: { Earlobe: box("NW", "DU", "BF"), "Ear Tragus": box("NW", "DU", "BF"), "Ear Outside Top": box("NW", "DU", "BF"), "Ear Outside Middle": box("NW", "DU", "BF"), "Ear Outside Bottom": box("NW", "DU", "BF"), "Ear Inside Top": box("NW", "DU", "BF"), "Ear Inside Bottom": box("NW", "DU", "BF") },
    Nose: { "Upper Nose Tip": box("NW", "DU", "BF", "RA", "SH"), "Nose Tip Upper": box("NW", "DU", "BF", "RA", "SH"), "Nose Tip Under": box("NW", "DU", "BF", "RA", "SH"), "Nose Tip Lower": box("NW", "DU", "BF", "RA", "SH"),
      "Nostril Upper": box("NW", "DU", "BF", "RA"), "Nostril Lower": box("NW", "DU", "BF", "RA"), "Nostril Outside": box("NW", "DU", "BF", "RA"), "Nostril Outside Center": box("NW", "DU", "BF", "RA") },
    Cheeks: { Cheeks: box("DU", "LM"), "Upper Inside Cheeks": box("DU", "LM"), "Upper Outside Cheeks": box("LM"), "Inside Cheeks": box("LM"), "Lower Inside Cheeks": box("NL"), "Lower Outside Cheeks": box("NL") },
    Mouth: { "Mouth Corners": box("NW", "DU", "BF", "RA"), "Mouth Corner Grooves": box("NL"), "Lip Gap Center": box("NW", "DU", "BF", "RA"), "Lip Gap Sides": box("NW", "DU", "BF", "RA"), Philtrum: box("NW", "DU", "BF", "RA", "SH"),
      "Upper Lip Fullness": box("NW", "DU", "BF", "RA"), "Upper Lip Top Center": box("NW", "DU", "BF", "RA", "SH"), "Upper Lip Top Sides": box("NW", "DU", "BF", "RA"), "Upper Lip Bottom Center": box("NW", "DU", "BF", "RA", "SH"), "Upper Lip Bottom Sides": box("NW", "DU", "BF", "RA"),
      "Lower Lip Fullness": box("NW", "DU", "BF", "RA"), "Lower Lip Top Center": box("NW", "DU", "BF", "RA", "SH"), "Lower Lip Top Sides": box("NW", "DU", "BF", "RA"), "Lower Lip Bottom Center": box("NW", "DU", "BF", "RA", "SH"), "Lower Lip Bottom Sides": box("NW", "DU", "BF", "RA") },
    Chin: { "Chin Sides": box("NL"), "Chin Cleft": box("DU", "SH") },
    Jaw: { Jaw: box("LM") },
  },
  Fat: {
    Head: { "Upper Neck": box("DU", "LM") },
    Forehead: { "Forehead Center": box("DU", "LM"), "Forehead Sides": box("DU", "LM") },
    Eyes: { "Eyelid Upper": box("DU", "LM"), "Eyelid Lower": box("DU", "LM"), "Under-Eye Lower": box("DU", "LM") },
    Ears: { "Ear Outside Top": box("LM"), "Ear Outside Bottom": box("LM") },
    Nose: { Nose: box("LM") },
    Cheeks: { "Upper Cheeks": box("DU", "LM"), "Lower Cheeks": box("DU", "LM"), Jowl: box("DU", "LM"), "Cheeks Inside": box("DU", "LM"), Temples: box("DU", "LM") },
    Mouth: { "Upper Lip": box("DU", "LM"), "Lower Lip": box("DU", "LM"), "Mouth Sides": box("DU", "LM") },
    Chin: { Chin: box("DU", "LM"), "Under Chin": box("DU", "LM") },
    Jaw: { Jaw: box("DU", "LM") },
  },
};
export const LAYER_TR = { Skeletal: "Kemik yapısı", Flesh: "Yumuşak doku", Fat: "Dolgunluk" };
export const REGION_TR = { Head: "Kafa", Forehead: "Alın", "Brow Ridge": "Kaş kemeri", Eyes: "Gözler", Ears: "Kulaklar", Nose: "Burun", Cheeks: "Elmacık ve yanaklar", Mouth: "Ağız ve dudaklar", Chin: "Çene ucu", Jaw: "Çene hattı" };
