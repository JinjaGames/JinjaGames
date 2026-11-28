// Google ile giriş ve cihazlar arası eşitleme (Firebase Authentication + Cloud Firestore).
// Giriş isteğe bağlıdır: girmeyen herkes eskisi gibi oynar. Giriş yapınca bu tarayıcıdaki oyuncu verileri
// (profil ve fotoğraf, kendi listelerin, favoriler, rekorlar, günün quizi sonuçları, gizlediğin quizler ve
// sıralamalardaki kimliğin) hesabına yazılır; başka cihazda aynı hesapla girince oraya gelir.
// Her kullanıcının tek bir belgesi vardır (users/<uid>); kurallar gereği yalnızca kendisi okuyup yazabilir.
// Firebase kütüphanesi yalnızca gerektiğinde (giriş düğmesi ya da önceden giriş yapılmışsa) yüklenir.
// Firebase web yapılandırması (herkese açık istemci kimlikleridir; erişimi Firestore kuralları ve yetkili alan adları sınırlar)
export const FIREBASE = {
  apiKey: "AIzaSyDd2VNBDJPiDGU2Oxj6rhmSZLUjmdqrkcc",
  authDomain: "jinjaquiz.firebaseapp.com",
  projectId: "jinjaquiz",
  appId: "1:601277947311:web:a7ea494e95c89a0705635a",
};

// Google ile giriş penceresi: tarayıcının kendi sade hesap seçicisi (Google Identity Services, FedCM).
// "jinjagames.com oturumunu google.com ile açın" diye açılır; uzun izin listesi gösteren eski pencere kullanılmaz.
export const GOOGLE_CLIENT = "601277947311-hnfats0hog6v7as6do71mah55c17f9uq.apps.googleusercontent.com";

const SYNC = ["jqProfile", "jqCustomLists", "jqFavs", "jqBest", "jqNumBest", "jqLbBest", "jqDaily", "jqPlays", "jqHidden", "jqNostrKey"];
const FLAG = "jqAuth"; // bu tarayıcıda giriş yapılmış (açılışta kütüphaneyi yüklemek için)
const SENT = "jqSyncSent"; // { uid, data: son eşitlenen değerler, at: anahtar başına değişiklik zamanı }
const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} };
const json = (s, d) => { try { return s == null ? d : JSON.parse(s) ?? d; } catch { return d; } };

let fb = null; // { auth, mod }
let user = null; // { uid, name, email, photo }
const listeners = new Set();
export const onAccount = (fn) => listeners.add(fn);
const tell = () => listeners.forEach((fn) => { try { fn(user); } catch {} });
export const account = () => user;
export const accountReady = () => !!FIREBASE;

async function load() {
  if (fb) return fb;
  if (!FIREBASE) throw Error("Giriş henüz hazır değil.");
  const app = await import("../vendor/firebase/firebase-app.js");
  const mod = await import("../vendor/firebase/firebase-auth.js");
  const a = app.initializeApp(FIREBASE);
  const auth = mod.initializeAuth(a, { persistence: [mod.indexedDBLocalPersistence, mod.browserLocalPersistence] });
  fb = { auth, mod };
  mod.onAuthStateChanged(auth, async (u) => {
    user = u ? { uid: u.uid, name: u.displayName || "", email: u.email || "", photo: u.photoURL || "" } : null;
    set(FLAG, u ? "1" : null);
    tell();
    if (u) await pull().catch(() => {});
  });
  return fb;
}

/** Açılışta: bu tarayıcıda daha önce giriş yapıldıysa oturumu geri yükle (ve hesaptaki yenilikleri al). */
export function initAccount() {
  if (!FIREBASE || get(FLAG) !== "1") return;
  load().catch(() => {});
}
// Google'ın giriş betiği yalnızca giriş düğmesi gösterileceği zaman yüklenir
let gisP = null;
function gis() {
  gisP ??= new Promise((ok, no) => {
    if (window.google?.accounts?.id) return ok(window.google.accounts.id);
    const sc = document.createElement("script");
    sc.src = "https://accounts.google.com/gsi/client";
    sc.async = true;
    sc.onload = () => (window.google?.accounts?.id ? ok(window.google.accounts.id) : no(Error("Google girişi yüklenemedi.")));
    sc.onerror = () => { gisP = null; no(Error("Google girişi yüklenemedi.")); };
    document.head.append(sc);
  });
  return gisP;
}
let onError = () => {};
/** Google ile giriş düğmesini el içine çizer. Basınca tarayıcının hesap seçicisi açılır, seçilince giriş yapılır. */
export async function googleButton(el, { light = false, fail } = {}) {
  if (!el) return;
  if (fail) onError = fail;
  const id = await gis();
  id.initialize({
    client_id: GOOGLE_CLIENT,
    callback: (r) => credential(r?.credential).catch((e) => onError(e)),
    use_fedcm_for_prompt: true,
    use_fedcm_for_button: true,
    button_auto_select: false,
    auto_select: false,
    itp_support: true,
    context: "signin",
  });
  if (!el.isConnected) return;
  el.innerHTML = "";
  id.renderButton(el, { type: "standard", theme: light ? "outline" : "filled_black", size: "large", text: "continue_with", shape: "pill", logo_alignment: "center", locale: "tr", width: Math.max(200, Math.min(400, Math.round(el.clientWidth || 320))) });
}
async function credential(token) {
  if (!token) throw Error("Google girişi tamamlanamadı.");
  const { auth, mod } = await load();
  await mod.signInWithCredential(auth, mod.GoogleAuthProvider.credential(token));
}
export async function signOut() {
  if (!fb) return;
  await push().catch(() => {});
  await fb.mod.signOut(fb.auth);
  try { window.google?.accounts?.id?.disableAutoSelect(); } catch {}
  set(SENT, null);
}

// ---------- Firestore (REST): kullanıcı başına tek belge ----------
const docUrl = (uid) => `https://firestore.googleapis.com/v1/projects/${FIREBASE.projectId}/databases/(default)/documents/users/${uid}`;
async function auth() {
  const u = fb?.auth.currentUser;
  if (!u) throw Error("Giriş yapılmamış.");
  return { Authorization: "Bearer " + (await u.getIdToken()) };
}
async function readDoc() {
  const r = await fetch(docUrl(user.uid), { headers: await auth() });
  if (r.status === 404) return null;
  if (!r.ok) throw Error("Hesap verisi okunamadı.");
  const f = (await r.json())?.fields || {};
  return { data: json(f.data?.stringValue, {}), at: json(f.at?.stringValue, {}) };
}
async function writeDoc(data, at) {
  const body = { fields: { data: { stringValue: JSON.stringify(data) }, at: { stringValue: JSON.stringify(at) }, updated: { timestampValue: new Date().toISOString() } } };
  const r = await fetch(docUrl(user.uid), { method: "PATCH", headers: { ...(await auth()), "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw Error("Hesaba yazılamadı.");
}
const snapshot = () => Object.fromEntries(SYNC.map((k) => [k, get(k)]).filter(([, v]) => v != null));
// Son eşitlemeden beri bu cihazda değişen anahtarlar, değişme zamanlarıyla
function localChanges(sent) {
  const now = Date.now(), at = { ...(sent?.at || {}) }, changed = new Set();
  for (const k of SYNC) if ((get(k) ?? null) !== (sent?.data?.[k] ?? null)) { at[k] = now; changed.add(k); }
  return { at, changed };
}

// ---------- ilk giriş: anonim oynarken biriken veriler hesaptakiyle birleşir ----------
const maxMap = (a, b) => { const o = { ...a }; for (const [k, v] of Object.entries(b || {})) o[k] = typeof v === "number" ? Math.max(Number(o[k]) || 0, v) : v && typeof v === "object" && o[k] && typeof o[k] === "object" ? maxMap(o[k], v) : o[k] ?? v; return o; };
function union(local, cloud) {
  const out = { ...cloud, ...local };
  const L = (k, d) => json(local[k], d), C = (k, d) => json(cloud[k], d);
  // profil ve sıralama kimliği: hesapta varsa hesabınki (her cihazda aynı ad, fotoğraf ve sıralama satırı)
  if (cloud.jqProfile) out.jqProfile = cloud.jqProfile;
  if (/^[0-9a-f]{64}$/.test(cloud.jqNostrKey || "")) out.jqNostrKey = cloud.jqNostrKey;
  const lists = new Map([...C("jqCustomLists", []), ...L("jqCustomLists", [])].filter((l) => l?.id).map((l) => [l.id, l]));
  out.jqCustomLists = JSON.stringify([...lists.values()]);
  out.jqFavs = JSON.stringify([...new Set([...L("jqFavs", []), ...C("jqFavs", [])])].slice(0, 300));
  const hid = new Map([...C("jqHidden", []), ...L("jqHidden", [])].map((x) => [typeof x === "string" ? x : x?.id, x]).filter(([id]) => id));
  out.jqHidden = JSON.stringify([...hid.values()].slice(-500));
  for (const k of ["jqBest", "jqNumBest", "jqLbBest", "jqPlays"]) out[k] = JSON.stringify(maxMap(C(k, {}), L(k, {})));
  out.jqDaily = JSON.stringify({ ...C("jqDaily", {}), ...L("jqDaily", {}) });
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v != null && v !== "null"));
}

/**
 * Açılışta / girişte: hesaptakiyle bu cihaz eşitlenir. Bu hesapla ilk kez eşitlenen cihazda ikisi birleşir;
 * sonrasında anahtar başına en son değiştirilen kazanır (bir cihazda silinen favori öbüründe geri gelmez).
 * Bu cihazın verisi değiştiyse sayfa bir kez yenilenir (oyun sürerken değil).
 */
// Google hesabının fotoğrafı küçük bir kopya olarak profile konur (sitenin profil fotoğrafı biçimi)
async function googlePhoto(url) {
  if (!/^https:\/\/lh\d\.googleusercontent\.com\//.test(url || "")) return "";
  try {
    const r = await fetch(url.replace(/=s\d+(-c)?$/, "") + "=s160-c", { mode: "cors", credentials: "omit" });
    if (!r.ok) return "";
    const bmp = await createImageBitmap(await r.blob());
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    c.getContext("2d").drawImage(bmp, 0, 0, 128, 128);
    const out = c.toDataURL("image/jpeg", 0.82);
    return /^data:image\/jpeg;base64,[A-Za-z0-9+/=]{1,30000}$/.test(out) ? out : "";
  } catch {
    return "";
  }
}
async function pull() {
  const found = await readDoc();
  const doc = found || { data: {}, at: {} };
  const sent = json(get(SENT), null);
  const local = snapshot();
  let data, at;
  if (!sent || sent.uid !== user.uid) {
    data = union(local, doc.data);
    // Bu hesapla ilk kez giriliyor (hesapta hiç profil yok): bu tarayıcıdaki ad hesaba yazılmaz;
    // ad ve fotoğraf Google hesabından gelir (simge ve renk bu cihazdaki gibi kalır).
    // Daha önce oynanmış hesapta ise hesabın profili gelir (union bunu yapar).
    if (!doc.data.jqProfile) {
      const lp = json(local.jqProfile, {}) || {};
      const name = String(user.name || "").replace(/\s+/g, " ").trim().slice(0, 20) || lp.name || "Oyuncu";
      data.jqProfile = JSON.stringify({ name, avatar: lp.avatar || "headphones", color: lp.color || "coral", photo: (await googlePhoto(user.photo)) || "" });
    }
    at = Object.fromEntries(Object.keys(data).map((k) => [k, Date.now()]));
  } else {
    const mine = localChanges(sent);
    data = { ...doc.data };
    at = { ...doc.at };
    for (const k of mine.changed) if (!(Number(doc.at[k]) > mine.at[k])) { data[k] = local[k]; at[k] = mine.at[k]; }
  }
  const changed = SYNC.some((k) => (data[k] ?? null) !== (local[k] ?? null));
  for (const k of SYNC) set(k, data[k] ?? null);
  await writeDoc(data, at);
  set(SENT, JSON.stringify({ uid: user.uid, data, at }));
  if (changed && !document.body.dataset.phase) location.reload();
}
/** Bu cihazdaki değişiklikleri hesaba yazar (değişmeyen anahtarlar hesaptaki gibi kalır; değişiklik yoksa hiç gönderilmez). */
export async function push() {
  if (!user || !fb) return;
  const sent = json(get(SENT), null);
  if (!sent || sent.uid !== user.uid) return pull();
  const mine = localChanges(sent);
  if (!mine.changed.size) return;
  const doc = (await readDoc()) || { data: {}, at: {} };
  const data = { ...doc.data }, at = { ...doc.at };
  for (const k of mine.changed) { const v = get(k); if (v == null) delete data[k]; else data[k] = v; at[k] = mine.at[k]; }
  await writeDoc(data, at);
  set(SENT, JSON.stringify({ uid: user.uid, data: { ...sent.data, ...Object.fromEntries([...mine.changed].map((k) => [k, get(k)])) }, at }));
}
// değişiklikler 30 sn'de bir ve sekme gizlenirken toplu gider
setInterval(() => { if (user && !document.hidden) push().catch(() => {}); }, 30000);
addEventListener("visibilitychange", () => { if (document.hidden && user) push().catch(() => {}); });
