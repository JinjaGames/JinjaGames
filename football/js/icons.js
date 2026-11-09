// İkon seti: iki tonlu (yarı saydam dolgu + çizgi) ve hareketli. Hareketli parçalar `m` sınıfı taşır; animasyonlar css/icons.css'te.
// Renk currentColor'dan gelir; kartlar/sarı-kırmızı kart gibi sabit renkli olanlar kendi dolgusunu taşır.
const BALL = '<path d="M12 7.6l3.5 2.5-1.3 4.1H9.8L8.5 10.1z" fill="currentColor" stroke="none"/><path d="M12 7.6V3.3M15.5 10.1l4.2-1.4M14.2 14.2l2.6 3.6M9.8 14.2l-2.6 3.6M8.5 10.1L4.3 8.7"/>';

export const ICONS = {
  home: '<path class="a" d="M3 13.5c0-2.5 4-4.5 9-4.5s9 2 9 4.5v3c0 2.5-4 4.5-9 4.5s-9-2-9-4.5z"/><ellipse cx="12" cy="13.5" rx="9" ry="4.5"/><ellipse cx="12" cy="13.5" rx="4.4" ry="2"/><path d="M3 13.5v3c0 2.5 4 4.5 9 4.5s9-2 9-4.5v-3"/><g class="m fl"><rect x="3" y="2.8" width="5" height="3" rx=".7"/><path d="M5.5 5.8v3.9"/><rect x="16" y="2.8" width="5" height="3" rx=".7"/><path d="M18.5 5.8v3.9"/></g>',
  edit: '<circle class="a" cx="12" cy="13" r="8"/><path d="M4.3 12.2A8 8 0 1 1 6 17.2"/><path d="M4 7v5.2h5.2"/><path class="m hand" d="M12 8.5V13l3.2 2"/>',
  sim: '<rect class="a" x="2.5" y="5" width="19" height="14" rx="2.2"/><rect x="2.5" y="5" width="19" height="14" rx="2.2"/><path d="M12 5v14M2.5 9.5H6v5H2.5M21.5 9.5H18v5h3.5"/><circle cx="12" cy="12" r="2.6"/><circle class="m ball" cx="8.6" cy="16.6" r="1.35" fill="currentColor" stroke="none"/>',
  shield: '<path class="a" d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path class="m star" d="M12 8.1l1.4 2.8 3.1.5-2.3 2.1.6 3.1-2.8-1.5-2.8 1.5.6-3.1-2.3-2.1 3.1-.5z" fill="currentColor" stroke="none"/>',
  players: '<circle class="a" cx="9" cy="8.2" r="3.4"/><circle cx="9" cy="8.2" r="3.4"/><path d="M2.8 20c0-3.6 2.8-6.2 6.2-6.2s6.2 2.6 6.2 6.2"/><g class="m mate"><circle cx="17.2" cy="9" r="2.5"/><path d="M17.8 14.4c1.9.6 3.4 2.4 3.4 5.1"/></g>',
  search: '<circle class="a" cx="11" cy="11" r="6.6"/><g class="m lens"><circle cx="11" cy="11" r="6.6"/><path d="M20 20l-4.3-4.3"/></g>',
  sun: '<circle class="a" cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="4"/><g class="m rays"><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4L7 7M17 17l1.6 1.6M5.4 18.6L7 17M17 7l1.6-1.6"/></g>',
  moon: '<path class="a" d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/><g class="m tw"><path d="M17.5 3.5v3M16 5h3"/></g>',
  undo: '<g class="m back"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></g>',
  share: '<path class="a" d="M5 12.5v6.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6.5z"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/><g class="m up"><path d="M12 15V3M8 7l4-4 4 4"/></g>',
  news: '<rect class="a" x="3.5" y="4" width="14" height="16" rx="2"/><rect x="3.5" y="4" width="14" height="16" rx="2"/><path d="M17.5 8.5h3v9a2.5 2.5 0 0 1-2.5 2.5H8"/><path d="M7 8h7" stroke-width="2.4"/><g class="m ln"><path d="M7 12h7M7 15.6h4.2"/></g>',
  ball: '<circle class="a" cx="12" cy="12" r="9"/><g class="m spin"><circle cx="12" cy="12" r="9"/>' + BALL + '</g>',
  trophy: '<path class="a" d="M7.5 4h9v5a4.5 4.5 0 0 1-9 0z"/><path d="M7.5 4h9v5a4.5 4.5 0 0 1-9 0z"/><path d="M7.5 6H4.4c0 3 1.2 4.6 3.4 4.9M16.5 6h3.1c0 3-1.2 4.6-3.4 4.9"/><path d="M12 13.5V17M9.5 17h5v3.5h-5zM8 20.5h8"/><path class="m shine" d="M10.2 6.2v2.6"/>',
  table: '<rect class="a" x="3" y="4" width="18" height="16" rx="2"/><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 14.5h18M8.5 4v16"/><g class="m rowhl"><rect x="9.5" y="10" width="10" height="3.4" rx=".8" fill="currentColor" stroke="none" opacity=".55"/></g>',
  transfer: '<g class="m r"><path d="M4 8h14.5l-3.3-3.3"/></g><g class="m l"><path d="M20 16H5.5l3.3 3.3"/></g>',
  globe: '<circle class="a" cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="9"/><g class="m spin2"><path d="M12 3c3.2 3.2 3.2 14.8 0 18M12 3c-3.2 3.2-3.2 14.8 0 18"/></g><path d="M3 12h18M4.5 7.5h15M4.5 16.5h15"/>',
  manager: '<rect class="a" x="3" y="4" width="18" height="13" rx="2"/><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8.5 20.5h7M12 17v3.5"/><circle cx="8" cy="9" r="1.4"/><circle cx="15.5" cy="13" r="1.4"/><path class="m route" d="M9.4 9.7c2.6.3 3.4 1.6 4.6 2.8M13.2 9l2.6-2.2M13 6.9l2.8-.1-.1 2.8"/>',
  whistle: '<path class="a" d="M3 10h9.5a6.2 6.2 0 1 1-5.2 9.6L3 14.5z"/><path d="M3 10h9.5a6.2 6.2 0 1 1-5.2 9.6L3 14.5z"/><circle cx="14" cy="15.5" r="1.7"/><g class="m snd"><path d="M17 5.6l1.6-2.1M20.2 7.6l2-1.1M14.3 4.8l.2-2.7"/></g>',
  goal: '<path class="a" d="M3 20V8.5l3-3.5h12l3 3.5V20z"/><path d="M3 20V8.5l3-3.5h12l3 3.5V20"/><path d="M3 8.5h18M9 5v15M15 5v15M3 14h18" opacity=".7"/><circle class="m shot" cx="12" cy="17.3" r="1.7" fill="currentColor" stroke="none"/>',
  shirt: '<path class="a" d="M8.5 3.5L4 6l-1.5 4.5 3 1.3V20.5h13V11.8l3-1.3L20 6l-4.5-2.5c-.5 1.6-1.9 2.6-3.5 2.6s-3-1-3.5-2.6z"/><path d="M8.5 3.5L4 6l-1.5 4.5 3 1.3V20.5h13V11.8l3-1.3L20 6l-4.5-2.5c-.5 1.6-1.9 2.6-3.5 2.6s-3-1-3.5-2.6z"/><path class="m tw" d="M9.5 13.5h5M12 11v5"/>',
  boot: '<path class="a" d="M3 15.5c0-3 1.4-5.2 3.8-6.5l1.3 2.2c1.2.9 2.4 1.2 4.4 1.4 2.4.2 4.5 1.4 5.3 3.6V18H3z"/><path d="M3 15.5c0-3 1.4-5.2 3.8-6.5l1.3 2.2c1.2.9 2.4 1.2 4.4 1.4 2.4.2 4.5 1.4 5.3 3.6V18H3z"/><path d="M3 18v2h15.8v-2M7 20v-2M11 20v-2M15 20v-2"/><circle class="m kick" cx="20" cy="9" r="1.8" fill="currentColor" stroke="none"/>',
  penalty: '<rect class="a" x="2.5" y="5" width="19" height="14" rx="1.5"/><rect x="2.5" y="5" width="19" height="14" rx="1.5"/><path d="M7.5 5v5.2h9V5"/><circle class="m spot" cx="12" cy="14.8" r="1.5" fill="currentColor" stroke="none"/><path d="M9.5 19.2a3.2 3.2 0 0 1 5 0"/>',
  own: '<circle class="a" cx="9" cy="12" r="6"/><circle cx="9" cy="12" r="6"/><g class="m back"><path d="M21 12h-6.2M17.7 8.8L21 12l-3.3 3.2"/></g>',
  yellow: '<rect class="m card" x="6.5" y="3.5" width="11" height="17" rx="1.9" fill="#f5c518" stroke="#b58a05"/>',
  red: '<rect class="m card" x="6.5" y="3.5" width="11" height="17" rx="1.9" fill="#e5483b" stroke="#a82a20"/>',
  sub: '<g class="m up"><path d="M8 19V6M4.6 9.2L8 5.8l3.4 3.4" stroke="#2fae5a"/></g><g class="m dn"><path d="M16 5v13M12.6 14.8L16 18.2l3.4-3.4" stroke="#e5483b"/></g>',
  calendar: '<rect class="a" x="3.5" y="5" width="17" height="15.5" rx="2.2"/><rect x="3.5" y="5" width="17" height="15.5" rx="2.2"/><path d="M3.5 10h17M8 3v4M16 3v4"/><g class="m dot"><circle cx="12" cy="15" r="1.6" fill="currentColor" stroke="none"/></g>',
  chevl: '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
  chevr: '<path d="M9.5 5.5L16 12l-6.5 6.5"/>',
  spark: '<path class="a" d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/><path class="m tw" d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/>',
  fire: '<path class="a" d="M12 3c1 3.5 5.5 5.5 5.5 10.2A5.5 5.5 0 0 1 12 19a5.5 5.5 0 0 1-5.5-5.8c0-2 1-3.4 2-4.4.2 1.4.9 2.2 1.8 2.6C10 8.8 10.6 5.6 12 3z"/><path class="m flame" d="M12 3c1 3.5 5.5 5.5 5.5 10.2A5.5 5.5 0 0 1 12 19a5.5 5.5 0 0 1-5.5-5.8c0-2 1-3.4 2-4.4.2 1.4.9 2.2 1.8 2.6C10 8.8 10.6 5.6 12 3z"/>',
};

/** Satır içi SVG. name: ICONS anahtarı. */
export const icon = (name, size) => `<svg class="ico ico-${name}" viewBox="0 0 24 24" aria-hidden="true"${size ? ` width="${size}" height="${size}"` : ''}>${ICONS[name] || ''}</svg>`;
export const iconEl = (name, size) => { const t = document.createElement('template'); t.innerHTML = icon(name, size); return t.content.firstChild; };
