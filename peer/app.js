/* JinjaPeer web: UI. Protocol lives in core.js / session.js / transfer.js. */
import * as C from './core.js';
import { PeerSession, S, buildIceServers } from './session.js';
import { TransferService, isFinal, makeZip } from './transfer.js';
import { t, setLangCode, getLang, applyStatic } from './i18n.js';

const $ = (id) => document.getElementById(id);
const root = document.documentElement;

/* ---------- tiny helpers ---------- */
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid !== null && kid !== undefined) el.append(kid);
  return el;
}
function lsGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } }
const fmtB = (n) => C.formatBytes(n, getLang());
const MEMORY_LIMIT = 1024 * 1024 * 1024; // receiving into browser memory is capped at 1 GB
const fmtD = (s) => C.formatDuration(s, getLang());

function toast(text, kind) {
  const el = h('div', { class: 'toast' + (kind === 'error' || kind === 'err' ? ' err' : ''), text });
  $('toasts').append(el);
  setTimeout(() => el.remove(), 4500);
}

async function copyText(text, fallbackEl) {
  try {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* fall through */ }
  try {
    const ta = fallbackEl || h('textarea', { 'aria-hidden': 'true', readonly: true, tabindex: '-1' });
    if (!fallbackEl) { ta.value = text; ta.className = 'sr'; document.body.append(ta); }
    const ro = ta.readOnly; ta.readOnly = false; ta.focus(); ta.select(); ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    ta.readOnly = ro;
    if (!fallbackEl) ta.remove();
    return ok;
  } catch { return false; }
}
async function readClip() {
  try { if (navigator.clipboard && navigator.clipboard.readText) return await navigator.clipboard.readText(); } catch { /* denied */ }
  return null;
}
function flashCopied(btn) {
  const label = btn.querySelector('span') || btn;
  const old = label.getAttribute('data-orig') || label.textContent;
  label.setAttribute('data-orig', old);
  label.textContent = t('copied'); btn.classList.add('done');
  $('copy-live').textContent = t('copied');
  setTimeout(() => { label.textContent = old; btn.classList.remove('done'); $('copy-live').textContent = ''; }, 2000);
}

/* ---------- feature detection ---------- */
const FEAT = {
  webrtc: typeof RTCPeerConnection === 'function',
  gzip: typeof CompressionStream === 'function' && typeof DecompressionStream === 'function',
  rand: !!(window.crypto && crypto.getRandomValues),
  fsa: typeof window.showDirectoryPicker === 'function',
  share: typeof navigator.share === 'function',
  clipRead: !!(navigator.clipboard && navigator.clipboard.readText) && window.isSecureContext,
  dirInput: 'webkitdirectory' in document.createElement('input'),
  dirDrop: typeof DataTransferItem !== 'undefined' && 'webkitGetAsEntry' in DataTransferItem.prototype,
  touch: (navigator.maxTouchPoints || 0) > 0,
};

/* ---------- settings + identity ---------- */
const settings = (() => {
  let s = {};
  try { s = JSON.parse(lsGet('jp_settings') || '{}') || {}; } catch { s = {}; }
  s.turn = s.turn || { url: '', user: '', pass: '' };
  if (!s.name) s.name = 'Web ' + (100 + (C.randomBytes(2)[0] * 256 + C.randomBytes(1)[0]) % 900);
  return s;
})();
function saveSettings() { lsSet('jp_settings', JSON.stringify(settings)); }
let identity = (() => {
  try {
    const raw = lsGet('jp_identity');
    if (raw) { const seed = C.unb64(raw); if (seed.length === 32) return C.newIdentity(seed); }
  } catch { /* regenerate */ }
  const id = C.newIdentity();
  lsSet('jp_identity', C.b64(id.seed));
  return id;
})();

/* ---------- state ---------- */
let session = null;
let view = 'start';
let queue = [];
let fsaRoot = null; // FileSystemDirectoryHandle chosen by the user
let expiryTimer = null;
let lostInfo = null;
const svc = new TransferService({
  onUpdate: () => renderTransfers(),
  onNotice: (kind, key, params) => toast(t(key, params), kind),
});

/* ---------- language / theme ---------- */
function setLang(l) {
  setLangCode(l); root.setAttribute('data-lang', l); root.lang = l; lsSet('jg_lang', l);
  $('lang-cur').textContent = l === 'tr' ? 'TR' : 'EN';
  applyStatic();
  document.title = l === 'tr' ? 'JinjaPeer | Dosyaları doğrudan ve uçtan uca şifreli gönder' : 'JinjaPeer | Send files directly, end to end encrypted';
  document.querySelectorAll('#set-lang button').forEach((b) => b.classList.toggle('on', b.dataset.langSet === l));
  renderSupport(); renderAll();
}
function setTheme(th) {
  root.setAttribute('data-theme', th); lsSet('jg_theme', th);
  document.querySelectorAll('#set-theme button').forEach((b) => b.classList.toggle('on', b.dataset.themeSet === th));
}

/* ---------- views ---------- */
function showView(name) {
  view = name;
  for (const v of ['start', 'invite', 'join', 'live']) $('view-' + v).hidden = v !== name;
  $('steps').hidden = name === 'start';
  $('hero').hidden = name !== 'start';
  $('info').hidden = name === 'live' ? false : false;
  window.scrollTo({ top: 0 });
}
function setSteps(n) { // n = current step (1..3)
  document.querySelectorAll('#steps li').forEach((li) => {
    const i = Number(li.dataset.step);
    li.classList.toggle('on', i === n); li.classList.toggle('ok', i < n || (n === 3 && i === 3));
  });
}
function status(el, text, kind) { el.textContent = text || ''; el.className = 'status' + (kind ? ' ' + kind : ''); }
function codeErr(e) { return e && e.key ? t('e.' + e.key, e.params) : String(e && e.message || e); }
function sesErr(err) { return err ? t('e.' + err.key, err.params) : ''; }

function resetAll() {
  if (session) { const s = session; session = null; s.onended = null; s.onchange = null; s.close('userClosed'); svc.sessionEnded(s); }
  clearInterval(expiryTimer); lostInfo = null;
  $('inv-setup').hidden = false; $('inv-code').hidden = true; $('inv-answer').hidden = true;
  $('inv-out').value = ''; $('ans-in').value = ''; $('inv-pw').value = '';
  $('join-in').hidden = false; $('join-out-card').hidden = true; $('join-code').value = ''; $('join-out').value = '';
  $('join-pw').value = ''; $('join-pw-wrap').hidden = true; $('join-who').textContent = ''; $('join-count').textContent = '';
  $('inv-create').disabled = false; $('join-go').disabled = false; $('ans-go').disabled = false;
  status($('inv-status'), ''); status($('join-status'), ''); status($('join-wait'), '');
  $('lost').hidden = true; $('send-card').hidden = false;
  joinParsed = null; queue = []; renderQueue();
  showView('start');
}
document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', resetAll));

/* ---------- code boxes (copy / share / qr / expiry) ---------- */
function linkFor(code) { return location.origin + location.pathname + '#' + code; }
function fillCodeBox(outId, countId, code) {
  $(outId).value = code;
  $(countId).textContent = t('charCount', { n: code.length.toLocaleString(getLang() === 'tr' ? 'tr-TR' : 'en-US') });
}
function startExpiry(spanId, expiresAt) {
  clearInterval(expiryTimer);
  const tick = () => {
    const left = Math.round((expiresAt - Date.now()) / 1000);
    const el = $(spanId);
    if (left <= 0) { el.textContent = t('expired'); el.classList.add('low'); clearInterval(expiryTimer); return; }
    el.classList.toggle('low', left < 120);
    el.textContent = t('expiresIn', { t: `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` });
  };
  tick(); expiryTimer = setInterval(tick, 1000);
}
document.querySelectorAll('[data-copy]').forEach((btn) => btn.addEventListener('click', async () => {
  const ta = $(btn.dataset.copy);
  if (await copyText(ta.value, ta)) flashCopied(btn); else toast(t('copyFail'), 'error');
}));
$('inv-copylink').addEventListener('click', async (e) => {
  if (await copyText(linkFor($('inv-out').value))) flashCopied(e.currentTarget); else toast(t('copyFail'), 'error');
});
async function doShare(data) { try { await navigator.share(data); } catch { /* canceled */ } }
if (FEAT.share) {
  $('inv-share').hidden = false; $('join-share').hidden = false;
  $('inv-share').addEventListener('click', () => doShare({ title: t('sharedCodeTitle'), text: t('shareText'), url: linkFor($('inv-out').value) }));
  $('join-share').addEventListener('click', () => doShare({ title: t('sharedCodeTitle'), text: $('join-out').value }));
}
async function renderQr(code) {
  const box = $('inv-qrbox'); box.hidden = true;
  if (code.length > 2300) return;
  try {
    const { qrcode } = await import('./vendor/qr.js');
    const q = qrcode(0, 'L'); q.addData(code, 'Byte'); q.make();
    $('inv-qr').src = q.createDataURL(4, 8); box.hidden = false;
  } catch { box.hidden = true; }
}

/* ---------- session wiring ---------- */
function sessionOpts(password) {
  return {
    identity, myName: C.sanitizeDisplayName(settings.name, 'Web'), iceServers: buildIceServers(settings.turn), password,
  };
}
function wire(s) {
  session = s;
  svc.attach(s);
  s.onchange = onSessionChange;
  s.onconnected = () => { goLive(); };
  s.onended = onSessionEnded;
}
function onSessionChange(s) {
  if (s !== session) return;
  if (view === 'live') renderPeer();
  if (s.state === S.CONNECTING || s.state === S.SECURING) {
    const key = s.state === S.CONNECTING ? 'connecting' : 'securing';
    if (view === 'invite') status($('inv-status'), t(key), 'wait');
    if (view === 'join') status($('join-wait'), t(key), 'wait');
  }
}
function onSessionEnded(s) {
  if (s !== session) return;
  svc.sessionEnded(s);
  const msg = sesErr(s.error) || t('e.lost');
  if (view === 'live') {
    lostInfo = msg; renderPeer();
  } else if (view === 'invite') {
    status($('inv-status'), msg, 'err'); $('ans-go').disabled = true; $('inv-create').disabled = false;
  } else if (view === 'join') {
    status($('join-status'), msg, 'err'); status($('join-wait'), '');
  }
}
function goLive() {
  clearInterval(expiryTimer);
  showView('live'); setSteps(3);
  $('lost').hidden = true; lostInfo = null;
  renderPeer(); renderTransfers(); renderQueue();
  toast(t('connectedTo') + ': ' + session.peerName);
}

/* ---------- inviter ---------- */
$('go-send').addEventListener('click', () => { showView('invite'); setSteps(1); $('inv-setup').hidden = false; $('inv-pw').focus(); });
$('inv-create').addEventListener('click', async () => {
  if (!supportedOrWarn()) return;
  const btn = $('inv-create'); btn.disabled = true;
  status($('inv-status'), '');
  const minutes = Number($('inv-valid').value) || 60;
  const pw = $('inv-pw').value;
  $('inv-create').textContent = t('creating');
  const s = await PeerSession.createInvite(sessionOpts(pw), minutes * 60);
  $('inv-create').textContent = t('invCreate');
  btn.disabled = false;
  if (s.state === S.FAILED) { toast(sesErr(s.error), 'error'); status($('inv-status'), sesErr(s.error), 'err'); return; }
  wire(s);
  $('inv-setup').hidden = true; $('inv-code').hidden = false; $('inv-answer').hidden = false;
  fillCodeBox('inv-out', 'inv-count', s.myCode.encoded);
  startExpiry('inv-expiry', s.myCode.expiresAt);
  renderQr(s.myCode.encoded);
  setSteps(2); $('steps').querySelector('[data-step="1"]').classList.add('ok');
  status($('inv-status'), t('waitingAnswer'), 'wait');
});

async function connectWithAnswer(raw) {
  const text = C.extractCode(raw);
  const out = $('inv-status');
  if (!text) { status(out, t('pasteCodeFirst'), 'err'); return; }
  if (C.sniffKind(text) === 'invite') {
    status(out, t('inviteInAnswer'), 'err'); return;
  }
  if (!session || session.role !== 'inviter') { status(out, t('e.notWaiting'), 'err'); return; }
  $('ans-go').disabled = true;
  try {
    const code = await C.parseCode(text, { expect: 'answer' });
    status(out, t('connecting'), 'wait');
    await session.applyAnswer(code);
  } catch (e) { status(out, codeErr(e), 'err'); }
  $('ans-go').disabled = false;
}
$('ans-go').addEventListener('click', () => connectWithAnswer($('ans-in').value));
$('ans-in').addEventListener('paste', (e) => {
  const txt = (e.clipboardData && e.clipboardData.getData('text')) || '';
  if (/JP1[IA]-/.test(txt)) { e.preventDefault(); $('ans-in').value = C.extractCode(txt); connectWithAnswer(txt); }
});
$('ans-paste').addEventListener('click', async () => {
  const txt = await readClip();
  if (txt === null) { $('ans-in').focus(); toast(t('pasteFail')); return; }
  $('ans-in').value = C.extractCode(txt); connectWithAnswer(txt);
});

/* ---------- joiner ---------- */
let joinParsed = null;
$('go-join').addEventListener('click', () => { showView('join'); setSteps(1); $('join-code').focus(); });

async function handleJoinText(raw, auto) {
  const text = C.extractCode(raw);
  $('join-count').textContent = text ? t('charCount', { n: text.length }) : '';
  const out = $('join-status');
  joinParsed = null; $('join-who').textContent = ''; $('join-pw-wrap').hidden = true;
  if (!text) { status(out, ''); return; }
  const kind = C.sniffKind(text);
  if (kind === 'answer') {
    if (session && session.role === 'inviter' && session.state === S.WAITING_ANSWER) {
      // an answer pasted on the wrong screen: route it to the open invite
      showView('invite'); setSteps(2); $('steps').querySelector('[data-step="1"]').classList.add('ok');
      $('ans-in').value = text; connectWithAnswer(text); return;
    }
    status(out, t('answerNotHere'), 'err'); return;
  }
  if (kind !== 'invite') { status(out, auto ? '' : t('e.notJp'), auto ? '' : 'err'); return; }
  try {
    joinParsed = await C.parseCode(text, { expect: 'invite' });
    status(out, '');
    $('join-who').textContent = t('joinerDetected', { name: joinParsed.name });
    $('join-pw-wrap').hidden = !joinParsed.passwordRequired;
    if (joinParsed.passwordRequired) $('join-pw').focus();
    else if (auto) doJoin();
  } catch (e) { status(out, codeErr(e), 'err'); }
}
$('join-code').addEventListener('input', () => handleJoinText($('join-code').value, false));
$('join-code').addEventListener('paste', (e) => {
  const txt = (e.clipboardData && e.clipboardData.getData('text')) || '';
  if (/JP1[IA]-/.test(txt)) { e.preventDefault(); $('join-code').value = C.extractCode(txt); handleJoinText(txt, true); }
});
$('join-paste').addEventListener('click', async () => {
  const txt = await readClip();
  if (txt === null) { $('join-code').focus(); toast(t('pasteFail')); return; }
  $('join-code').value = C.extractCode(txt); handleJoinText(txt, true);
});
async function doJoin() {
  if (!supportedOrWarn()) return;
  const out = $('join-status');
  if (!joinParsed) { await handleJoinText($('join-code').value, false); if (!joinParsed) { if (!$('join-code').value.trim()) status(out, t('pasteCodeFirst'), 'err'); return; } }
  const pw = $('join-pw').value;
  if (joinParsed.passwordRequired && !pw) { status(out, t('needPw'), 'err'); $('join-pw').focus(); return; }
  if (session) return;
  $('join-go').disabled = true; status(out, t('creating'), 'wait');
  const s = await PeerSession.acceptInvite(sessionOpts(joinParsed.passwordRequired ? pw : ''), joinParsed);
  $('join-go').disabled = false;
  if (s.state === S.FAILED) { status(out, sesErr(s.error), 'err'); return; }
  wire(s);
  status(out, '');
  $('join-in').hidden = true; $('join-out-card').hidden = false;
  fillCodeBox('join-out', 'join-out-count', s.myCode.encoded);
  startExpiry('join-out-expiry', s.myCode.expiresAt);
  setSteps(2); $('steps').querySelector('[data-step="1"]').classList.add('ok');
  status($('join-wait'), t('waitInviter'), 'wait');
}
$('join-go').addEventListener('click', doJoin);
$('join-pw').addEventListener('keydown', (e) => { if (e.key === 'Enter') doJoin(); });

/* ---------- global paste / share link ---------- */
document.addEventListener('paste', (e) => {
  const tag = (document.activeElement && document.activeElement.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  const txt = (e.clipboardData && e.clipboardData.getData('text')) || '';
  if (!/JP1[IA]-/.test(txt)) return;
  e.preventDefault();
  if (view === 'start') { showView('join'); setSteps(1); }
  if (view === 'join') { $('join-code').value = C.extractCode(txt); handleJoinText(txt, true); }
  else if (view === 'invite' && !$('inv-answer').hidden) { $('ans-in').value = C.extractCode(txt); connectWithAnswer(txt); }
});
function consumeHash() {
  const m = /^#?(JP1[IA]-[A-Za-z0-9_\-]+)/.exec(location.hash || '');
  if (!m) return;
  history.replaceState(null, '', location.pathname + location.search); // fragment never leaves the browser; drop it from the bar
  showView('join'); setSteps(1);
  $('join-code').value = m[1]; handleJoinText(m[1], true);
}

/* ---------- live: peer + verification ---------- */
function renderPeer() {
  if (!session) return;
  $('peer-name').textContent = session.peerName;
  const bits = [`${t('fingerprint')} ${session.peerFingerprint}`];
  if (session.route) bits.push(t('route_' + session.route));
  if (session.rttMs !== null) bits.push(t('rtt', { n: session.rttMs }));
  $('peer-meta').textContent = bits.join(' · ');
  $('vcode').textContent = session.verificationCode;
  const lost = !session.isLive;
  $('lost').hidden = !lost;
  $('send-card').hidden = lost;
  $('disconnect').hidden = lost;
  if (lost) { $('lost-title').textContent = t('lostTitle'); $('lost-text').textContent = (lostInfo || '') + ' ' + t('lostHint'); }
}
$('disconnect').addEventListener('click', () => { resetAll(); });
$('lost-new').addEventListener('click', () => {
  const hasBlobs = svc.batches.some((b) => b.tasks.some((x) => x.blob));
  if (hasBlobs && !confirm(t('memoryNote'))) return;
  svc.batches.slice().forEach((b) => { b.tasks.forEach((x) => { x.blob = null; }); });
  svc.clearFinished(); resetAll();
});

/* ---------- send queue ---------- */
function addToQueue(items) {
  for (const it of items) queue.push(it);
  if (queue.length > 10000) { queue.length = 10000; toast(t('tooManyFiles'), 'error'); }
  renderQueue();
}
function renderQueue() {
  const ul = $('queue'); ul.textContent = '';
  queue.slice(0, 300).forEach((it, i) => {
    ul.append(h('li', {},
      h('span', { class: 'nm', text: it.relDir ? `${it.relDir}/${it.name}` : it.name }),
      h('span', { class: 'sz', text: fmtB(it.size) }),
      h('button', { class: 'rm', type: 'button', 'aria-label': t('removeItem'), title: t('removeItem'), text: '×', onclick: () => { queue.splice(i, 1); renderQueue(); } })));
  });
  if (queue.length > 300) ul.append(h('li', {}, h('span', { class: 'nm', text: `… +${queue.length - 300}` })));
  $('queue-actions').hidden = queue.length === 0;
  $('queue-total').textContent = t('queueTotal', { n: queue.length, size: fmtB(queue.reduce((a, x) => a + x.size, 0)) });
}
function fromFileList(list) {
  return Array.from(list).map((f) => {
    const rel = f.webkitRelativePath || '';
    const i = rel.lastIndexOf('/');
    return { name: f.name, size: f.size, relDir: i > 0 ? rel.slice(0, i) : '', file: f };
  });
}
$('add-files').addEventListener('click', () => $('pick-files').click());
$('add-folder').addEventListener('click', () => $('pick-folder').click());
$('drop').addEventListener('click', () => $('pick-files').click());
$('drop').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('pick-files').click(); } });
$('pick-files').addEventListener('change', (e) => { addToQueue(fromFileList(e.target.files)); e.target.value = ''; });
$('pick-folder').addEventListener('change', (e) => {
  const items = fromFileList(e.target.files); e.target.value = '';
  if (!items.length) toast(t('emptyFolder')); else addToQueue(items);
});
$('queue-clear').addEventListener('click', () => { queue = []; renderQueue(); });
$('queue-send').addEventListener('click', async () => {
  if (!session || !session.isLive) { toast(t('noConn'), 'error'); return; }
  const items = queue; queue = []; renderQueue();
  await svc.offer(session, items);
  $('xfer-card').hidden = false; renderTransfers();
});

function entryFile(entry) { return new Promise((res, rej) => entry.file(res, rej)); }
function readAll(reader) {
  return new Promise((res, rej) => {
    const all = [];
    const next = () => reader.readEntries((batch) => { if (!batch.length) res(all); else { all.push(...batch); next(); } }, rej);
    next();
  });
}
async function walk(entry, out) {
  if (out.length >= 10000) return;
  if (entry.isFile) {
    const f = await entryFile(entry);
    const full = entry.fullPath || '/' + f.name;
    const i = full.lastIndexOf('/');
    out.push({ name: f.name, size: f.size, relDir: full.slice(0, i).replace(/^\/+/, ''), file: f });
  } else if (entry.isDirectory) {
    for (const child of await readAll(entry.createReader())) await walk(child, out);
  }
}
const dropEl = $('drop');
['dragenter', 'dragover'].forEach((ev) => document.addEventListener(ev, (e) => {
  if (view !== 'live' || !session || !session.isLive || !e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return;
  e.preventDefault(); dropEl.classList.add('over');
}));
['dragleave', 'drop'].forEach((ev) => document.addEventListener(ev, (e) => { if (ev === 'drop' || e.target === document.documentElement || e.target === dropEl) dropEl.classList.remove('over'); }));
document.addEventListener('drop', async (e) => {
  if (view !== 'live' || !session || !session.isLive || !e.dataTransfer) return;
  e.preventDefault(); dropEl.classList.remove('over');
  const dt = e.dataTransfer;
  const out = [];
  try {
    if (dt.items && dt.items.length && FEAT.dirDrop) {
      const entries = Array.from(dt.items).filter((i) => i.kind === 'file').map((i) => i.webkitGetAsEntry()); // must be sync
      for (const en of entries) if (en) await walk(en, out);
    } else out.push(...fromFileList(dt.files));
  } catch { toast(t('folderReadFail'), 'error'); }
  if (out.length) addToQueue(out); else toast(t('emptyFolder'));
});

/* ---------- transfers ---------- */
const views = new Map();
function batchTitle(b) {
  if (b.tasks.length === 1) return b.tasks[0].name;
  const folders = new Set(b.tasks.map((x) => x.relDir.split('/')[0]));
  if (folders.size === 1 && [...folders][0]) return t('titleFolder', { f: [...folders][0], n: b.tasks.length });
  return t('titleMore', { a: b.tasks[0].name, n: b.tasks.length - 1 });
}
async function chooseFolder() {
  if (fsaRoot) {
    try { if ((await fsaRoot.queryPermission({ mode: 'readwrite' })) === 'granted' || (await fsaRoot.requestPermission({ mode: 'readwrite' })) === 'granted') return fsaRoot; } catch { /* pick again */ }
  }
  try {
    fsaRoot = await window.showDirectoryPicker({ id: 'jinjapeer', mode: 'readwrite' });
    return fsaRoot;
  } catch (e) {
    toast(e && e.name === 'AbortError' ? t('folderPickCanceled') : t('folderPickFail'), 'error');
    return null;
  }
}
function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name, rel: 'noopener' });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function makeBatchView(b) {
  const el = h('div', { class: 'batch' });
  const title = h('b'); const badge = h('span', { class: 'badge' });
  const sub = h('p', { class: 'hint' });
  const head = h('div', { class: 'bt' }, title, badge);
  const warn = h('p', { class: 'warnline' });
  const pendActions = h('div', { class: 'actions' });
  const bar = h('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100' }, h('i'));
  const stats = h('div', { class: 'stats' });
  const bActions = h('div', { class: 'actions' });
  const note = h('p', { class: 'warnline' });
  const reason = h('p', { class: 'errline' });
  const list = h('ul', { class: 'files' });
  const small = b.tasks.length <= 300;
  const details = h('details', {}, h('summary', { class: 'hint', text: t('fileCount', { n: b.tasks.length }) }), list);

  const rows = small ? b.tasks.map((task) => {
    const nm = h('span', { class: 'fn' }); const st = h('span', { class: 'fs' });
    const pb = h('div', { class: 'bar sm' }, h('i'));
    const btns = h('span', { class: 'fb' });
    const li = h('li', {}, nm, btns, st, pb);
    nm.textContent = task.path;
    list.append(li);
    return { task, st, pb, btns, dlBtn: null, cancelBtn: null };
  }) : [];

  const pause = h('button', { class: 'btn sm', type: 'button', onclick: () => svc.setPaused(b, !b.paused) });
  const cancel = h('button', { class: 'btn g sm', type: 'button', text: t('cancel2'), onclick: () => svc.cancelBatch(b) });
  const zipBtn = h('button', { class: 'btn sm', type: 'button', text: t('downloadAll'), onclick: () => {
    const done = b.tasks.filter((x) => x.blob);
    if (done.reduce((a, x) => a + x.size, 0) > 4e9) { toast(t('zipLimit'), 'error'); return; }
    downloadBlob(makeZip(done.map((x) => ({ path: x.path, blob: x.blob, size: x.size, crc: x.crc }))), 'JinjaPeer.zip');
  } });
  bActions.append(pause, cancel, zipBtn);

  const acc = (mode) => async () => {
    let dest = { mode: 'memory' };
    if (mode === 'fsa') { const hnd = await chooseFolder(); if (!hnd) return; dest = { mode: 'fsa', handle: hnd, label: hnd.name }; }
    else if (b.totalSize > MEMORY_LIMIT) { toast(t('memTooBig', { size: fmtB(MEMORY_LIMIT) }), 'error'); return; } // a tab that holds it all in RAM would crash
    await svc.accept(b, dest); renderTransfers();
  };
  const rejBtn = h('button', { class: 'btn g', type: 'button', text: t('reject'), onclick: () => svc.reject(b) });

  el.append(head, sub, warn, pendActions, bar, stats, bActions, note, reason, details);
  if (b.direction === 'receive') {
    const risky = b.tasks.some((x) => x.risky);
    if (risky) warn.textContent = '⚠ ' + t('riskyWarn');
    if (FEAT.fsa) pendActions.append(h('button', { class: 'btn p', type: 'button', text: fsaRoot ? `${t('accept')} · ${fsaRoot.name}` : t('acceptFolder'), onclick: acc('fsa') }),
      h('button', { class: 'btn', type: 'button', text: t('acceptMemory'), onclick: acc('memory') }), rejBtn);
    else pendActions.append(h('button', { class: 'btn p', type: 'button', text: t('accept'), onclick: acc('memory') }), rejBtn);
  }

  function update() {
    const total = b.totalSize, done = b.transferred;
    const pct = total === 0 ? (b.status === 'done' ? 100 : 0) : Math.min(100, (done / total) * 100);
    const pending = b.status === 'pending';
    el.classList.toggle('pending', pending && b.direction === 'receive');
    title.textContent = batchTitle(b);
    const st = b.paused && b.status === 'accepted' ? 'paused' : null;
    badge.textContent = st ? t('st_paused') : t('bs_' + b.status);
    badge.className = 'badge ' + (b.status === 'accepted' ? 'active' : b.status);
    sub.textContent = `${b.direction === 'send' ? t('dirSend') : t('dirRecv')} · ${b.peerName} · ${t('fileCount', { n: b.tasks.length })} · ${fmtB(total)}`;
    pendActions.hidden = !(pending && b.direction === 'receive');
    warn.hidden = !(b.direction === 'receive' && b.tasks.some((x) => x.risky) && pending);
    const showProg = b.status === 'accepted' || b.status === 'done';
    bar.hidden = !showProg; stats.hidden = !showProg;
    bar.firstChild.style.width = pct.toFixed(1) + '%'; bar.setAttribute('aria-valuenow', Math.round(pct));
    const sp = b.speed, rem = total - done;
    stats.textContent = '';
    stats.append(h('span', { text: `${fmtB(done)} / ${fmtB(total)} (${Math.floor(pct)}%)` }),
      h('span', { text: t('filesOf', { a: b.doneCount, b: b.tasks.length }) }));
    if (b.status === 'accepted') stats.append(h('span', { text: `${t('speed')}: ${sp > 0 ? fmtB(sp) + '/s' : '-'}` }),
      h('span', { text: `${t('eta')}: ${sp > 1 ? fmtD(rem / sp) : t('calc')}` }));
    if (pending && b.direction === 'send') { sub.textContent += ' · ' + t('waitAccept'); }
    if (b.pausedByPeer && b.paused) stats.append(h('span', { text: t('pausedByPeer') }));
    bActions.hidden = !(b.status === 'accepted' || (b.direction === 'send' && pending) || b.tasks.some((x) => x.blob));
    pause.hidden = b.status !== 'accepted';
    pause.textContent = b.paused ? t('resume') : t('pause');
    cancel.hidden = b.isFinished;
    const blobs = b.tasks.filter((x) => x.blob);
    zipBtn.hidden = blobs.length < 2 || !b.isFinished && b.doneCount < b.tasks.length;
    note.hidden = true;
    if (b.direction === 'receive' && b.dest && b.dest.mode === 'memory') {
      note.hidden = false; note.textContent = t('memoryNote') + (FEAT.touch && !FEAT.fsa ? ' ' + t('mobileNote') : '');
    } else if (b.direction === 'receive' && pending && !FEAT.fsa && total > 1.5e9) { note.hidden = false; note.textContent = t('bigWarn', { size: fmtB(total) }); }
    else if (b.direction === 'receive' && b.dest && b.dest.mode === 'fsa') { note.hidden = false; note.textContent = t('savedTo', { where: b.dest.label }); }
    reason.textContent = b.reason && b.isFinished ? t(b.reason.startsWith('r_') ? b.reason : b.reason) : '';
    for (const r of rows) {
      const task = r.task;
      const p = task.size === 0 ? (task.status === 'done' ? 100 : 0) : Math.min(100, (task.transferred / task.size) * 100);
      r.st.textContent = `${fmtB(task.size)} · ${t('st_' + task.status)}${task.error ? ' · ' + t(task.error) : ''}${task.risky ? ' ⚠' : ''}`;
      r.pb.firstChild.style.width = (task.status === 'done' ? 100 : p).toFixed(1) + '%';
      const canCancel = !isFinal(task.status) && (b.status === 'accepted' || (b.status === 'pending' && b.direction === 'send'));
      if (canCancel && !r.cancelBtn) { r.cancelBtn = h('button', { class: 'rm', type: 'button', text: '×', title: t('cancelFile'), 'aria-label': t('cancelFile') + ': ' + task.name, onclick: () => svc.cancelTask(task) }); r.btns.append(r.cancelBtn); }
      if (!canCancel && r.cancelBtn) { r.cancelBtn.remove(); r.cancelBtn = null; }
      if (task.blob && !r.dlBtn) { r.dlBtn = h('button', { class: 'btn sm', type: 'button', text: t('download'), onclick: () => downloadBlob(task.blob, task.name) }); r.btns.append(r.dlBtn); }
      if (task.savedAs && !r.saved) { r.saved = true; r.st.textContent += ' · ' + task.savedAs; }
    }
    if (b.direction === 'receive' && rows.length) for (const r of rows) if (r.task.savedAs) r.st.textContent = `${fmtB(r.task.size)} · ${t('st_' + r.task.status)} · ${r.task.savedAs}`;
  }
  return { b, el, update };
}

function renderTransfers() {
  const live = new Set(svc.batches);
  for (const [b, v] of views) if (!live.has(b)) { v.el.remove(); views.delete(b); }
  const inc = $('incoming'), xf = $('xfers');
  let any = false;
  for (const b of svc.batches) {
    let v = views.get(b);
    if (!v) { v = makeBatchView(b); views.set(b, v); }
    const incoming = b.direction === 'receive' && b.status === 'pending';
    const target = incoming ? inc : xf;
    if (v.el.parentNode !== target) target.prepend(v.el);
    if (!incoming) any = true;
    v.update();
  }
  $('xfer-card').hidden = !any;
  renderHistory();
  if (view === 'live') document.title = (svc.batches.some((b) => b.status === 'accepted') ? '↕ ' : '') + (getLang() === 'tr' ? 'JinjaPeer' : 'JinjaPeer');
}
$('xfer-clear').addEventListener('click', () => svc.clearFinished());

let lastHist = -1;
function renderHistory() {
  const n = svc.history.length;
  if (n === lastHist) return; lastHist = n;
  const ul = $('hist'); ul.textContent = '';
  if (!n) { ul.append(h('li', { text: t('histEmpty') })); return; }
  for (const x of svc.history.slice(0, 100)) {
    ul.append(h('li', {}, h('span', { text: `${x.direction === 'send' ? '↑' : '↓'} ${x.name}` }),
      h('span', { class: 'hm', text: `${fmtB(x.size)} · ${t('st_' + x.status)} · ${x.peer} · ${new Date(x.at).toLocaleTimeString(getLang() === 'tr' ? 'tr-TR' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}` })));
  }
}

/* ---------- support list ---------- */
function renderSupport() {
  const ul = $('support'); ul.textContent = '';
  const add = (ok, key) => ul.append(h('li', { class: ok ? 'yes' : 'no' }, h('span', { class: 'mk', 'aria-hidden': 'true', text: ok ? '✓' : '!' }), h('span', { text: t(key) })));
  add(FEAT.fsa, FEAT.fsa ? 'sup_fsa_y' : 'sup_fsa_n');
  add(FEAT.dirInput, FEAT.dirInput ? 'sup_dir_y' : 'sup_dir_n');
  add(FEAT.dirDrop, FEAT.dirDrop ? 'sup_drag_y' : 'sup_drag_n');
  add(FEAT.share, FEAT.share ? 'sup_share_y' : 'sup_share_n');
  add(FEAT.clipRead, FEAT.clipRead ? 'sup_clip_y' : 'sup_clip_n');
  if (!FEAT.webrtc) add(false, 'sup_webrtc_n');
  if (!FEAT.gzip || !FEAT.rand) add(false, 'sup_crypto_n');
}
function supportedOrWarn() {
  const miss = [];
  if (!FEAT.webrtc) miss.push('WebRTC');
  if (!FEAT.gzip) miss.push('CompressionStream');
  if (!FEAT.rand) miss.push('crypto');
  if (!miss.length) return true;
  const el = $('unsupported'); el.hidden = false; el.textContent = t('unsupported', { what: miss.join(', ') });
  return false;
}
function renderAll() {
  if (view === 'live') { renderPeer(); }
  for (const [, v] of views) v.el.remove(); views.clear();
  renderTransfers(); renderQueue(); lastHist = -1; renderHistory();
  if (session && session.myCode && !$('inv-code').hidden) fillCodeBox('inv-out', 'inv-count', session.myCode.encoded);
}

/* ---------- settings dialog ---------- */
const dlg = $('settings');
$('btn-settings').addEventListener('click', () => {
  $('set-name').value = settings.name; $('set-turn-url').value = settings.turn.url || '';
  $('set-turn-user').value = settings.turn.user || ''; $('set-turn-pass').value = settings.turn.pass || '';
  $('set-fp').textContent = identity.fingerprint;
  document.querySelectorAll('#set-theme button').forEach((b) => b.classList.toggle('on', b.dataset.themeSet === root.getAttribute('data-theme')));
  document.querySelectorAll('#set-lang button').forEach((b) => b.classList.toggle('on', b.dataset.langSet === getLang()));
  dlg.showModal();
});
dlg.addEventListener('close', () => {
  if (dlg.returnValue === 'save') {
    settings.name = C.sanitizeDisplayName($('set-name').value, settings.name);
    settings.turn = { url: $('set-turn-url').value.trim(), user: $('set-turn-user').value, pass: $('set-turn-pass').value };
    saveSettings();
  }
  dlg.returnValue = '';
});
$('set-close').addEventListener('click', () => dlg.close());
document.querySelectorAll('[data-theme-set]').forEach((b) => b.addEventListener('click', () => setTheme(b.dataset.themeSet)));
document.querySelectorAll('[data-lang-set]').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.langSet)));
$('btn-lang').addEventListener('click', () => setLang(getLang() === 'tr' ? 'en' : 'tr'));
$('btn-theme').addEventListener('click', () => setTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'));

window.addEventListener('beforeunload', (e) => {
  if (session && session.isLive && (svc.batches.some((b) => b.status === 'accepted') || svc.batches.some((b) => b.tasks.some((x) => x.blob)))) { e.preventDefault(); e.returnValue = ''; }
});

/* ---------- boot ---------- */
setLang(root.getAttribute('data-lang') === 'tr' ? 'tr' : 'en');
setTheme(root.getAttribute('data-theme') || 'light');
if (!FEAT.webrtc || !FEAT.gzip || !FEAT.rand) supportedOrWarn();
showView('start');
consumeHash();
window.addEventListener('hashchange', consumeHash);
window.__jp = { svc, get session() { return session; }, C }; // handy for debugging in the console
