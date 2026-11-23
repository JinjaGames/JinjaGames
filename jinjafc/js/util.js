// JinjaFC ortak yardımcılar
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
let tt;
export function toast(msg) {
  let t = document.getElementById("toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.append(t); }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(tt);
  tt = setTimeout(() => t.classList.remove("show"), 2800);
}
export function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  setTimeout(() => (URL.revokeObjectURL(a.href), a.remove()), 1500);
}
/** Telefonda paylaşım menüsü (Instagram, WhatsApp…); olmazsa indirir. onlyDownload: doğrudan indir */
export async function shareOrDownload(blob, name, text, onlyDownload) {
  const file = new File([blob], name, { type: blob.type || "image/png" });
  if (!onlyDownload && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "JinjaFC", text: text || "" }); return; } catch (e) { if (e.name === "AbortError") return; }
  }
  download(blob, name);
  toast("Görsel kaydedildi.");
}
