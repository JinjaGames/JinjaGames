// Aynı tarayıcıdaki sekmeler birbirini görür (BroadcastChannel). Böylece:
//  - bir sekmede lobideyken öbür sekmede ikinci bir lobi kurulmaz / katılınmaz; istenirse lobi bu sekmeye taşınır,
//  - "Sekmeyi çoğalt" ile kopyalanan sekme aynı oyuncu kimliğini (ve kurucuysa aynı oyunu) ikinci kez açmaz.
// Farklı tarayıcılar (Chrome ve Edge gibi) birbirinin deposunu göremez; onlar ayrı cihaz sayılır.
const ch = typeof BroadcastChannel === "function" ? new BroadcastChannel("jq-tabs") : null;
export const TAB = Math.random().toString(36).slice(2, 12);
const FRESH = 12000; // bu kadar süredir ses vermeyen sekme kapanmış sayılır
const others = new Map(); // sekme -> { pid, role, code, at }
let stateFn = () => ({});
let handlers = {};

const post = (m) => { try { ch?.postMessage({ ...m, from: TAB }); } catch {} };
const here = () => post({ t: "here", ...stateFn() });

/** state(): bu sekmenin durumu { pid, role, code }; on: { change, give(to) -> veri, given(veri) } */
export function initTabs(state, on = {}) {
  stateFn = state;
  handlers = on;
  if (!ch) return;
  ch.onmessage = (e) => {
    const m = e.data || {};
    if (!m.from || m.from === TAB) return;
    if (m.t === "here") {
      const was = JSON.stringify(others.get(m.from)?.role + m.from + others.get(m.from)?.code);
      others.set(m.from, { pid: String(m.pid || ""), role: m.role || "", code: m.code || "", at: Date.now() });
      if (was !== JSON.stringify(m.role + m.from + m.code)) handlers.change?.();
    } else if (m.t === "who") here();
    else if (m.t === "bye") { if (others.delete(m.from)) handlers.change?.(); }
    else if (m.t === "take" && m.to === TAB) {
      // başka sekme lobiyi istiyor: durumu ver, bu sekmeden bırak
      const data = handlers.give?.();
      if (data) post({ t: "given", to: m.from, data });
    } else if (m.t === "given" && m.to === TAB && pendingTake) {
      const r = pendingTake;
      pendingTake = null;
      r(m.data);
    }
  };
  post({ t: "who" });
  here();
  setInterval(here, 4000);
  addEventListener("pagehide", () => post({ t: "bye" }));
}
/** Durum değişti (lobiye girildi / çıkıldı): öbür sekmelere hemen söyle. */
export const tabsUpdate = () => here();

const alive = () => [...others.entries()].filter(([, s]) => Date.now() - s.at < FRESH);
/** Başka bir sekmede açık lobi (kurucu ya da oyuncu): { tab, role, code } ya da null */
export function lobbyElsewhere() {
  const x = alive().find(([, s]) => (s.role === "host" || s.role === "guest") && s.code);
  return x ? { tab: x[0], ...x[1] } : null;
}
/** Bu oyuncu kimliği başka bir açık sekmede de kullanılıyor mu? (çoğaltılan sekme) Kısa süre dinler. */
export async function pidTaken(pid, ms = 350) {
  if (!ch || !pid) return false;
  post({ t: "who" });
  await new Promise((r) => setTimeout(r, ms));
  return alive().some(([, s]) => s.pid === pid);
}
let pendingTake = null;
/** Lobiyi öbür sekmeden bu sekmeye al. Dönüş: o sekmenin verdiği durum ya da (cevap gelmezse) null. */
export function takeLobby(tab) {
  if (!ch) return Promise.resolve(null);
  return new Promise((res) => {
    pendingTake = res;
    post({ t: "take", to: tab });
    setTimeout(() => { if (pendingTake === res) { pendingTake = null; res(null); } }, 2500);
  });
}
