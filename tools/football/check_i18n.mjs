// Jinja Football çeviri denetimi:  node tools/football/check_i18n.mjs [--list]
//  1) t('…') ile çağrılan her anahtarın İngilizce sözlükte karşılığı var mı
//  2) sözlükte kullanılmayan (ölü) anahtar var mı, aynı anahtar iki dosyada farklı mı çevrilmiş
//  3) t() dışında kalan, Türkçe görünen metinler (uyarı)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../football');
const JS = path.join(ROOT, 'js');
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== 'i18n') walk(p); } else if (e.name.endsWith('.js')) files.push(p);
  }
})(JS);
files.push(path.join(ROOT, 'index.html'));

// ---- sözlükler
const EN = {}; const where = {}; let bad = 0;
const dictDir = path.join(JS, 'i18n');
for (const f of fs.existsSync(dictDir) ? fs.readdirSync(dictDir).filter(x => x.endsWith('.js')) : []) {
  const m = (await import(pathToFileURL(path.join(dictDir, f)).href)).default;
  for (const [k, v] of Object.entries(m)) {
    if (k in EN && JSON.stringify(EN[k]) !== JSON.stringify(v)) { console.log(`ÇAKIŞMA  "${k}"  ${where[k]} ↔ ${f}`); bad++; }
    EN[k] = v; where[k] = f;
    // yer tutucular iki tarafta aynı olmalı
    const ph = s => (String(s).match(/\{\w+\}/g) || []).sort().join();
    const vs = Array.isArray(v) ? v : [v];
    for (const x of vs) if (ph(x) !== ph(k)) { console.log(`YER TUTUCU  ${f}: "${k}" → "${x}"`); bad++; }
  }
}

// ---- basit JS tarayıcı: yorumları atlar, dize/şablon parçalarını konumlarıyla döndürür
function scan(src) {
  const out = []; let i = 0, line = 1;
  const n = src.length;
  const strs = []; // {text, line, call}
  let lastIdent = ''; let prevSig = '';
  function readTemplate(startLine) {
    // i, açılış ` sonrası; ${…} içini özyinelemeli işle
    let buf = '', hasExpr = false, ln = startLine;
    while (i < n) {
      const c = src[i];
      if (c === '\\') { buf += src[i + 1] ?? ''; if (src[i + 1] === '\n') line++; i += 2; continue; }
      if (c === '`') { i++; break; }
      if (c === '$' && src[i + 1] === '{') {
        hasExpr = true; i += 2; let depth = 1;
        while (i < n && depth) {
          const d = src[i];
          if (d === '{') { depth++; i++; } else if (d === '}') { depth--; i++; }
          else if (d === '"' || d === "'") { readString(d); pendingCallee = null; }
          else if (/[A-Za-z_$]/.test(d)) { let j = i; while (j < n && /[\w$]/.test(src[j])) j++; lastIdent = src.slice(i, j); i = j; }
          else if (d === '(') { pendingCallee = lastIdent; lastIdent = ''; i++; }
          else if (d === '`') { i++; readTemplate(line); }
          else { if (d === '\n') line++; i++; }
        }
        buf += '\u0000'; continue;
      }
      if (c === '\n') line++;
      buf += c; i++;
    }
    strs.push({ text: buf, line: ln, tpl: hasExpr, quote: '`', callee: calleeAt.get(startLine + ':' + startPos) });
  }
  let startPos = 0; const calleeAt = new Map();
  function readString(q) {
    const ln = line; i++; let buf = '';
    while (i < n && src[i] !== q && src[i] !== '\n') { if (src[i] === '\\') { buf += src[i + 1]; i += 2; continue; } buf += src[i++]; }
    i++;
    strs.push({ text: buf, line: ln, tpl: false, quote: q, callee: pendingCallee });
  }
  let pendingCallee = null; // doğrudan "ad(" ardından gelen ilk argüman
  while (i < n) {
    const c = src[i];
    if (c === '\n') { line++; i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') line++; i++; } i += 2; continue; }
    // normal ifade (regex literal) basit tespit: önceki anlamlı karakter ( , = : [ ! & | ? { } ; ise
    if (c === '/' && /[(,=:\[!&|?{};]/.test(prevSig)) {
      i++; let cls = false; while (i < n && (src[i] !== '/' || cls) && src[i] !== '\n') { if (src[i] === '\\') i++; else if (src[i] === '[') cls = true; else if (src[i] === ']') cls = false; i++; }
      i++; while (/[a-z]/.test(src[i] || '')) i++; prevSig = ')'; continue;
    }
    if (c === '"' || c === "'") { readString(c); pendingCallee = null; prevSig = '"'; continue; }
    if (c === '`') { const ln = line; i++; const before = pendingCallee; readTemplateWith(ln, before); pendingCallee = null; prevSig = '`'; continue; }
    if (/[A-Za-z_$]/.test(c)) { let j = i; while (j < n && /[\w$]/.test(src[j])) j++; lastIdent = src.slice(i, j); i = j; prevSig = 'a'; continue; }
    if (c === '(') { pendingCallee = lastIdent; lastIdent = ''; i++; prevSig = '('; continue; }
    if (!/\s/.test(c)) { pendingCallee = null; lastIdent = ''; prevSig = c; }
    i++;
  }
  function readTemplateWith(ln, callee) {
    const before = strs.length; readTemplate(ln); strs[strs.length - 1].callee = callee; void before;
  }
  return strs;
}

const TR_CH = /[ğüşıöçĞÜŞİÖÇ]/;
const TR_WORD = /\b(Gol|Maç|Maçlar|Takım|Takımlar|Oyuncu|Oyuncular|Hoca|Sezon|Kupa|Geri|Kaydet|Sıfırla|Başla|Devam|Kapat|Paylaş|Haberler|Skor|Şut|Seri|Kale|Kaleci|Yeni|Tümü|Ara|Sil|Evet|Hayır|Tamam|Değiştir|Kaynak|ile|ve|için|bir|bu|yok)\b/;
const used = new Set(); let missing = 0, warn = 0, calls = 0;
const list = process.argv.includes('--list');
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const rel = path.relative(ROOT, f).replaceAll('\\', '/');
  if (f.endsWith('.html')) {
    for (const m of src.matchAll(/data-i18n(?:-html)?="([^"]+)"/g)) { used.add(m[1]); if (!(m[1] in EN)) { console.log(`EKSİK  ${rel}: "${m[1]}"`); missing++; } }
    for (const m of src.matchAll(/data-i18n-attr="([^"]+)"/g)) for (const pair of m[1].split('|')) { const k = pair.slice(pair.indexOf(':') + 1); used.add(k); if (!(k in EN)) { console.log(`EKSİK  ${rel}: "${k}"`); missing++; } }
    continue;
  }
  for (const s of scan(src)) {
    const isT = s.callee === 't' || s.callee === 'tp';
    if (isT) {
      calls++;
      if (s.tpl) { console.log(`ŞABLON  ${rel}:${s.line}: t(\`…\${…}…\`) kullanılamaz; {ad} yer tutucusu kullan`); missing++; continue; }
      used.add(s.text);
      if (!(s.text in EN)) { console.log(`EKSİK  ${rel}:${s.line}: "${s.text}"`); missing++; }
    } else if (s.callee !== 'import' && s.callee !== 'require') {
      const text = s.text.replace(/\u0000/g, ' ');
      if (TR_CH.test(text) || (/[A-Za-zÇĞİÖŞÜçğıöşü]{2}/.test(text) && TR_WORD.test(text) && text.length > 3 && /\s/.test(text))) {
        warn++; if (list || warn <= 400) console.log(`TÜRKÇE?  ${rel}:${s.line}: ${JSON.stringify(text.slice(0, 90))}`);
      }
    }
  }
}
let dead = 0;
for (const k of Object.keys(EN)) if (!used.has(k)) { dead++; if (list) console.log(`KULLANILMIYOR  ${where[k]}: "${k}"`); }
console.log(`\nt() çağrısı: ${calls} · sözlük: ${Object.keys(EN).length} · eksik: ${missing} · çakışma/yer tutucu: ${bad} · çevrilmemiş görünen: ${warn} · kullanılmayan anahtar: ${dead}`);
process.exit(missing || bad ? 1 : 0);
