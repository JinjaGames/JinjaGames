// Genel arama (Ctrl+K), yardım penceresi ve paylaşım bağlantısı.
import { t } from './i18n.js';
import { h, norm, toast, fmtMoney, go, u } from './util.js';
import { boot, pick } from './ui.js';
import { loadPlayers } from './data.js';
import * as store from './store.js';

let itemsP;
function items() {
  return itemsP ??= (async () => {
    const ctx = await boot();
    const out = [];
    for (const c of Object.values(ctx.comps)) {
      if (!ctx.idx[c.id]) continue;
      if (c.type === 'league') out.push({ id: `/lig/${c.id}`, label: `${c.name} · ${c.country}`, sub: t('lig'), tag: t('LİG'), tagCls: 'M' });
      else if (['cup', 'euro'].includes(c.type)) out.push({ id: `/kupa/${c.id}`, label: c.name, sub: t('kupa'), tag: t('KUPA'), tagCls: 'G' });
    }
    for (const [id, c] of Object.entries(ctx.clubs)) if (c.c && ctx.comps[c.c]?.type === 'league') out.push({ id: `/takim/${id}`, label: c.n, sub: ctx.compName(c.c), tag: t('TAKIM'), tagCls: 'D' });
    const P = await loadPlayers();
    for (const p of P.list.filter(x => x.value >= 3e6 || (x.peak || 0) >= 2e7).sort((a, b) => b.value - a.value).slice(0, 7000)) out.push({ id: `/oyuncu/${p.id}`, label: p.name, sub: p.nat || '', right: fmtMoney(p.value), tag: t('OYUNCU'), tagCls: 'A' });
    const PAGE = { sub: t('sayfa'), tag: t('SAYFA'), tagCls: 'M' };
    out.push({ id: '/milli', label: t('Milli takımlar'), ...PAGE }, { id: '/transfer', label: t('Transfer what-if'), ...PAGE }, { id: '/simulator', label: t('Maç simülatörü'), ...PAGE }, { id: '/senaryolar', label: t('Senaryolarım'), ...PAGE });
    return out;
  })();
}

export async function openPalette() {
  const all = await items();
  const id = await pick({ title: t('Ara'), items: all, placeholder: t('Takım, oyuncu, lig ya da kupa…'), limit: 40 });
  if (id) go(id);
}

export function openHelp() {
  const dlg = h('dialog', { 'aria-label': t('Nasıl kullanılır') });
  const step = (n, ti, d) => h('li', { style: 'display:grid;grid-template-columns:30px 1fr;gap:10px;padding:10px 0;border-bottom:1px solid var(--line-soft)' }, h('b', { class: 'mk', style: 'font:700 22px var(--font-c)' }, n), h('div', null, h('b', null, ti), h('div', { class: 'mute', style: 'font-size:13px' }, d)));
  dlg.append(h('div', { style: 'padding:16px 18px' },
    h('h3', { style: 'font-size:24px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px' }, t('Nasıl kullanılır?')),
    h('ul', { class: 'list-plain', style: 'padding:0' },
      step(1, t('Takımını seç'), t('Ana sayfada takımını yaz. Senaryo atölyesi, “şampiyon olmak için hangi maçlar?” sorusunu otomatik çözer.')),
      step(2, t('Bir şeyi değiştir'), t('“Geçmişi değiştir”den bir maç, transfer ya da kupa seç. Skora tıkla, transferi iptal et, penaltıyı çevir. Sarı renk = senin değişikliğin.')),
      step(3, t('Sonucunu gör'), t('Tablo, şampiyon, Avrupa ve küme düşme anında güncellenir. İstersen sonraki maçları ve sonraki sezonları da yeniden oynatıp olasılıkları görürsün.')),
      step(4, t('Maçı oyna'), t('“Maç oyna”da ilk 11’i ve taktiği seç; maçı 2D izle ya da binlerce kez oynatıp olasılıkları gör.')),
      step(5, t('Kaydet ve paylaş'), t('Senaryolar geçicidir: sekmeyi ya da siteyi kapatınca silinir. Saklamak istersen Senaryolar sayfasından bağlantısını kopyala ya da dosya olarak indir.'))),
    h('div', { class: 'dim', style: 'font-size:12.5px;margin-top:10px' }, t('Kısayollar: Ctrl+K arama · Esc pencereyi kapat')),
    h('div', { class: 'row', style: 'justify-content:flex-end;margin-top:12px' }, h('button', { class: 'btn primary', onclick: () => { dlg.close(); dlg.remove(); } }, t('Anladım')))));
  dlg.addEventListener('cancel', () => dlg.remove());
  document.body.append(dlg); dlg.showModal();
}

// ---- paylaşım bağlantısı (sunucusuz: senaryo URL içinde taşınır)
const b64 = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));
export const encodeScenario = sc => b64(JSON.stringify({ n: sc.name, e: sc.edits.map(({ at, ...rest }) => rest) }));
export const decodeScenario = s => { const o = JSON.parse(unb64(s)); return { name: o.n, edits: o.e }; };
export async function copyShareLink(sc) {
  const url = `${location.origin}${u(`/paylas/${encodeScenario(sc)}`)}`;
  if (await copyText(url)) toast(t('Bağlantı kopyalandı')); else prompt(t('Bağlantıyı kopyala:'), url);
}
/** Panoya yazar: önce Clipboard API, olmazsa gizli metin alanı + execCommand. */
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* izin yok ya da güvenli bağlam değil */ }
  try {
    const ta = h('textarea', { style: 'position:fixed;top:-1000px;opacity:0', readonly: true }); ta.value = text; document.body.append(ta);
    ta.select(); ta.setSelectionRange(0, text.length); const ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch { return false; }
}
export function importShared(sc) {
  const s = store.newScenario(sc.name || t('Paylaşılan senaryo'));
  s.edits = sc.edits.map(e => ({ ...e, at: Date.now() }));
  store.setActive(s.id);
}
