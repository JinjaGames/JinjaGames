// Oyun motoru. Kurucunun tarayıcısında çalışır ve tek doğruluk kaynağıdır.
// Diğer oyuncular yalnızca kendilerine özel durum özetini (view) alır.
import { fold, preview } from "./music.js?v=3";
import { cleanItems, cleanEmoji } from "./trivia.js?v=2";

export const MAX_PLAYERS = 12;
const PLAYS = 3;
const COUNTDOWN = 3000;
const INTRO = 2500;
const AUTO_NEXT = 3000; // çok oyunculu: sonuç ekranı bu kadar sonra kendiliğinden geçer
const NEXT_QUIZ = 30000; // çok oyunculu: quiz arası sıralama ekranı bu kadar sonra kendiliğinden geçer
const RANK_N = 5; // sıralama quizi: kaç şarkı sıralanır
const RANK_SECS = 60; // sıralama sorusu için süre (en az)
const OP_SECS = 30; // anime opening sorusu için süre (en az)

// Sıralama quizi puanları: doğru yerdeki her şarkı 100, ilk 5'te ama yanlış yerde 30, sıranın tamamı doğruysa +300.
export const RANK_PTS = { exact: 100, near: 30, perfect: 300 };
// Anime opening: animeyi bilmek 50, şarkıyı bilmek 50, ikisini birden bilmek +50 (hıza göre %60-100 arası)
export const OP_PTS = { anime: 50, song: 50, both: 50 };

const txt = (v, n = 120) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const YT = /^[\w-]{11}$/;
/** Sıralama quizi soruları: { q, artist, cover, top: [5 doğru sıra], pool: [20 şık] } */
export function cleanRank(items) {
  return (Array.isArray(items) ? items : [])
    .slice(0, 20)
    .map((it) => {
      const top = [...new Set((it?.top || []).map((x) => txt(x)).filter(Boolean))].slice(0, RANK_N);
      const pool = [...new Set([...top, ...(it?.pool || []).map((x) => txt(x)).filter(Boolean)])].slice(0, 20);
      return { q: txt(it?.q, 160), artist: txt(it?.artist, 80), cover: txt(it?.cover, 300), top, pool };
    })
    .filter((it) => it.q && it.top.length === RANK_N && it.pool.length >= 8);
}
/** Anime opening soruları: { yt: YouTube video kimliği, s: başlangıç sn, anime, song } */
export function cleanOps(items) {
  return (Array.isArray(items) ? items : [])
    .slice(0, 100)
    .map((it) => ({ yt: YT.test(it?.yt || "") ? it.yt : "", s: Math.max(0, Math.min(600, Math.round(Number(it?.s) || 0))), anime: txt(it?.anime, 80), song: txt(it?.song, 80) }))
    .filter((it) => it.yt && it.anime && it.song);
}
const distinct = (arr, not, n) => shuffle([...new Map(arr.filter((x) => x.toLowerCase() !== not.toLowerCase()).map((x) => [x.toLowerCase(), x])).values()]).slice(0, n);

const shuffle = (a) => {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const uid = () => Math.random().toString(36).slice(2, 10);

function clean(p = {}) {
  return {
    name: String(p.name || "Oyuncu").trim().slice(0, 20) || "Oyuncu",
    avatar: ["headphones", "guitar", "mic-vocal", "disc-3", "radio", "drum"].includes(p.avatar)
      ? p.avatar
      : "headphones",
    color: ["coral", "violet", "mint", "gold", "sky", "rose"].includes(p.color) ? p.color : "coral",
    photo: /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]{1,30000}$/.test(p.photo || "")
      ? p.photo
      : "",
  };
}

// Yazılı cevap: Türkçe karakter, noktalama ve parantez farklarını yok sayar, küçük yazım
// hatalarına (uzun isimlerde 1-2 harf) izin verir.
function distance(a, b) {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const t = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = t;
    }
  }
  return d[b.length];
}
export function matches(answer, track) {
  const a = fold(answer);
  const t = fold(track.title.replace(/\s*[([].*?[)\]]/g, "")) || fold(track.title);
  const artist = fold(track.artist);
  if (!a) return false;
  if (a === t || a === fold(track.title) || a === artist + t || a === t + artist) return true;
  const tol = t.length >= 10 ? 2 : t.length >= 5 ? 1 : 0;
  return tol > 0 && distance(a, t) <= tol;
}

export class Game {
  constructor({ code, solo, host, onChange }) {
    this.code = code;
    this.solo = solo;
    this.onChange = onChange;
    this.players = [];
    this.hostId = host.pid;
    this.queue = [];
    this.set = -1;
    this.index = -1;
    this.phase = "lobby";
    this.seconds = 20;
    this.autoNext = true;
    this.history = []; // bu lobide biten quizler (en yeni sonda)
    this.question = null;
    this.timer = null;
    this.join(host.pid, host.profile);
  }

  // ---- kalıcılık (kurucu sayfayı yenilerse oyun kaldığı yerden sürer) ----
  toJSON() {
    const { onChange, timer, ...rest } = this;
    return rest;
  }
  static restore(data, onChange) {
    const g = Object.assign(Object.create(Game.prototype), data, { onChange, timer: null });
    g.history ??= [];
    for (const p of g.players) p.online = p.pid === g.hostId;
    if (g.phase === "preparing") g.prepare();
    g.schedule();
    return g;
  }

  emit() {
    this.onChange?.(this);
  }

  // ---- oyuncular ----
  join(pid, profile) {
    let p = this.players.find((x) => x.pid === pid);
    if (!p) {
      if (this.players.length >= (this.solo ? 1 : MAX_PLAYERS)) throw Error("Lobi dolu.");
      p = { pid, score: 0, round: 0 };
      this.players.push(p);
    }
    Object.assign(p, clean(profile), { online: true });
    return p;
  }
  setOnline(pid, online) {
    const p = this.players.find((x) => x.pid === pid);
    if (!p) return;
    p.online = online;
    if (!online && this.phase === "lobby" && pid !== this.hostId)
      this.players = this.players.filter((x) => x !== p);
    this.checkAllAnswered();
  }
  kick(pid) {
    this.players = this.players.filter((x) => x.pid !== pid);
  }

  // ---- kuyruk ----
  addSet({ list, tracks, ids, count, mode, clip, kind, items, survival, reverse, video }) {
    if (this.queue.length >= 12) throw Error("Kuyrukta en fazla 12 quiz olabilir.");
    if (kind === "rank" || kind === "op") {
      const pool = kind === "rank" ? cleanRank(items) : cleanOps(items);
      if (!pool.length) throw Error(kind === "rank" ? "Bu sıralama quizi hazırlanamadı." : "Bu quizde oynanabilir opening yok.");
      if (kind === "op" && pool.length < 2) throw Error("Anime opening quizinde en az 2 opening olmalı.");
      const n = Math.max(1, Math.min(pool.length, Number(count) || 10, 100));
      this.queue.push({
        id: uid(),
        kind,
        name: list.name,
        art: "",
        picture: list.picture || "",
        emoji: list.emoji ? cleanEmoji(list.emoji) : "",
        tracks: pool,
        questions: shuffle(pool).slice(0, n),
        mode: kind,
        clip: 0,
        video: !!video,
      });
      return;
    }
    if (kind === "trivia") {
      const pool = cleanItems(items);
      if (pool.length < 2) throw Error("Bu triviada yeterli soru yok.");
      // Hayatta kalma (yalnızca solo): tüm sorular, ilk yanlışta oyun biter.
      const surv = !!survival && this.solo;
      const n = surv ? pool.length : Math.max(1, Math.min(pool.length, Number(count) || 10, 100));
      this.queue.push({
        survival: surv,
        streak: 0,
        id: uid(),
        kind: "trivia",
        name: list.name,
        art: "",
        picture: "",
        emoji: list.emoji ? cleanEmoji(list.emoji) : "",
        tracks: pool,
        questions: shuffle(pool).slice(0, n),
        mode: "choice",
        clip: 0,
      });
      return;
    }
    const pool = ids?.length ? tracks.filter((t) => ids.includes(t.id)) : tracks;
    if (!pool.length) throw Error("En az bir şarkı seç.");
    const n = Math.max(1, Math.min(pool.length, Number(count) || 10, 50));
    this.queue.push({
      id: uid(),
      name: list.name,
      art: list.art || "",
      picture: list.picture || "",
      tracks,
      questions: shuffle(pool).slice(0, n),
      mode: mode === "text" ? "text" : "choice",
      // tersten çalınan quizde kesit daha uzun: kolay 10, orta 5, zor 3 sn
      reverse: !!reverse,
      clip: reverse ? ([3, 5, 10].includes(clip) ? clip : 5) : [1, 3, 5].includes(clip) ? clip : 3,
    });
  }

  // ---- akış ----
  begin() {
    if (!this.queue.length) throw Error("Önce kuyruğa bir quiz ekle.");
    clearTimeout(this.timer);
    this.rankAt = null;
    this.set++;
    this.index = -1;
    for (const p of this.players) p.round = 0;
    this.advance();
  }
  advance() {
    clearTimeout(this.timer);
    const set = this.queue[this.set];
    // Hayatta kalma: son soru yanlışsa (ya da süre bittiyse) oyun burada biter.
    if (set.survival && this.index >= 0 && !this.question?.answers[this.hostId]?.correct) this.index = set.questions.length - 1;
    this.index++;
    if (this.index >= set.questions.length) {
      this.phase = this.set + 1 >= this.queue.length ? "done" : "ranking";
      this.history.push({
        id: uid(),
        name: set.name,
        art: set.art,
        picture: set.picture,
        count: set.questions.length,
        top: [...this.players].sort((a, b) => b.round - a.round).map((p) => ({ pid: p.pid, name: p.name, pts: p.round })),
        emoji: set.emoji || "",
        set: { kind: set.kind, emoji: set.emoji, name: set.name, art: set.art, picture: set.picture, tracks: set.tracks, pool: set.questions.length, mode: set.mode, clip: set.clip, reverse: !!set.reverse, video: !!set.video },
      });
      if (this.history.length > 10) this.history.shift();
      this.rankAt = this.phase === "ranking" && !this.solo ? Date.now() + NEXT_QUIZ : null;
      this.schedule();
      this.question = null;
      this.emit();
      return;
    }
    if (set.kind === "rank") {
      const item = set.questions[this.index];
      const start = Date.now() + this.lead();
      this.question = { id: uid(), item, options: shuffle(item.pool), answers: {}, start, end: start + Math.max(RANK_SECS, this.seconds * 3) * 1000 };
      this.phase = "question";
      this.schedule();
      this.emit();
      return;
    }
    if (set.kind === "op") {
      const item = set.questions[this.index];
      const start = Date.now() + this.lead();
      const animes = set.tracks.map((t) => t.anime), songs = set.tracks.map((t) => t.song);
      this.question = {
        id: uid(),
        item,
        options: shuffle([item.anime, ...distinct(animes, item.anime, 3)]),
        options2: shuffle([item.song, ...distinct(songs, item.song, 3)]),
        answers: {},
        start,
        end: start + Math.max(OP_SECS, this.seconds) * 1000,
      };
      this.phase = "question";
      this.schedule();
      this.emit();
      return;
    }
    if (set.kind === "trivia") {
      // Trivia: ses yok, soru hemen açılır. Geri sayım boyunca soru okunur, şıklar sonra açılır.
      const item = set.questions[this.index];
      const start = Date.now() + this.lead();
      this.question = { id: uid(), item, options: shuffle(item.a), answers: {}, start, end: start + this.seconds * 1000 };
      this.phase = "question";
      this.schedule();
      this.emit();
      return;
    }
    const track = set.questions[this.index];
    const others = shuffle(
      [...new Map(set.tracks.map((t) => [fold(t.title), t.title])).values()].filter(
        (t) => fold(t) !== fold(track.title),
      ),
    ).slice(0, 3);
    this.question = {
      id: uid(),
      track,
      options: shuffle([track.title, ...others]),
      answers: {},
      tries: 0,
    };
    this.prepare();
  }
  // ilk soruda quiz açılış kartı için daha uzun bekleme (2,5 sn tanıtım + 3-2-1), sonrakilerde 3-2-1
  lead() {
    return this.index === 0 ? COUNTDOWN + INTRO : COUNTDOWN;
  }
  prepare() {
    const q = this.question;
    this.phase = "preparing";
    this.emit();
    // Cevabı ağ kayıtlarından okumak zorlaşsın: doğru şarkının kaydı, diğer şıkların kayıtlarıyla
    // birlikte ve karışık sırada istenir.
    const set0 = this.queue[this.set];
    const byTitle = new Map(set0.tracks.map((t) => [t.title, t]));
    const decoys = (q.options ? q.options.filter((o) => o !== q.track.title).map((o) => byTitle.get(o)) : shuffle(set0.tracks).slice(0, 3)).filter((t) => t && t.id !== q.track.id);
    let main;
    for (const t of shuffle([q.track, ...decoys])) {
      if (t === q.track) main = preview(t.id);
      else preview(t.id).catch(() => {});
    }
    main
      .then((pv) => {
        if (this.question !== q) return;
        const clip = this.queue[this.set].clip;
        q.url = pv.url;
        q.cover = pv.cover || q.track.cover;
        q.album = pv.album;
        q.offset = Math.round((4 + Math.random() * (24 - clip)) * 10) / 10;
        q.start = Date.now() + this.lead();
        q.end = q.start + this.seconds * 1000;
        this.phase = "question";
        this.schedule();
        this.emit();
      })
      .catch(() => {
        if (this.question !== q) return;
        // Önizlemesi açılmayan şarkıyı havuzdaki başka bir şarkıyla değiştir.
        const set = this.queue[this.set];
        const used = new Set(set.questions.map((t) => t.id));
        const spare = shuffle(set.tracks.filter((t) => !used.has(t.id)))[0];
        if (spare && ++q.tries < 4) {
          set.questions[this.index] = spare;
          this.index--;
          this.advance();
        } else {
          set.questions.splice(this.index, 1);
          this.index--;
          this.advance();
        }
      });
  }
  schedule() {
    clearTimeout(this.timer);
    const q = this.question;
    if (this.phase === "question")
      this.timer = setTimeout(() => this.reveal(), Math.max(0, q.end - Date.now()) + 150);
    else if (this.phase === "reveal" && !this.solo)
      this.timer = setTimeout(() => this.phase === "reveal" && this.advance(), Math.max(0, q.autoAt - Date.now()));
    else if (this.phase === "ranking" && this.rankAt)
      this.timer = setTimeout(() => this.phase === "ranking" && this.next(), Math.max(0, this.rankAt - Date.now()));
  }
  answer(pid, text) {
    const q = this.question;
    const now = Date.now();
    if (this.phase !== "question" || now < q.start) throw Error("Bu soru cevap almıyor.");
    if (q.answers[pid]) return;
    const set = this.queue[this.set];
    const left = 1 - (now - q.start) / (q.end - q.start);
    if (set.kind === "rank") {
      const order = Array.isArray(text) ? text.map((x) => String(x ?? "").slice(0, 120)) : [];
      if (order.length !== RANK_N || new Set(order).size !== RANK_N || !order.every((x) => q.options.includes(x))) throw Error(`${RANK_N} farklı şarkı seçip sırala.`);
      const top = q.item.top;
      const marks = order.map((x, i) => (top[i] === x ? 2 : top.includes(x) ? 1 : 0));
      const perfect = marks.every((m) => m === 2);
      const points = marks.reduce((a, m) => a + (m === 2 ? RANK_PTS.exact : m === 1 ? RANK_PTS.near : 0), 0) + (perfect ? RANK_PTS.perfect : 0);
      q.answers[pid] = { answer: order, marks, correct: perfect, partial: points > 0, points, ms: now - q.start };
      if (this.solo) this.reveal();
      else if (!this.checkAllAnswered()) this.emit();
      return;
    }
    if (set.kind === "op") {
      const anime = String(text?.anime ?? ""), song = String(text?.song ?? "");
      if (!q.options.includes(anime) || !q.options2.includes(song)) throw Error("Hem animeyi hem şarkıyı seç.");
      const a = anime === q.item.anime, b = song === q.item.song;
      const base = (a ? OP_PTS.anime : 0) + (b ? OP_PTS.song : 0) + (a && b ? OP_PTS.both : 0);
      const points = Math.round(base * (0.6 + 0.4 * Math.max(0, left)));
      q.answers[pid] = { answer: { anime, song }, hit: { anime: a, song: b }, correct: a && b, partial: a || b, points, ms: now - q.start };
      if (this.solo) this.reveal();
      else if (!this.checkAllAnswered()) this.emit();
      return;
    }
    const answer = String(text ?? "").trim().slice(0, 120);
    if (!answer) throw Error("Bir cevap yaz.");
    if (set.mode === "choice" && !q.options.includes(answer)) throw Error("Geçerli bir şık seç.");
    const correct = set.kind === "trivia" ? answer === q.item.a[0] : set.mode === "choice" ? answer === q.track.title : matches(answer, q.track);
    const points = correct ? Math.max(10, Math.min(100, Math.round(10 + 90 * left))) : 0;
    q.answers[pid] = { answer, correct, points, ms: now - q.start };
    if (this.solo) this.reveal();
    else if (!this.checkAllAnswered()) this.emit();
  }
  checkAllAnswered() {
    if (this.phase !== "question") return false;
    const active = this.players.filter((p) => p.online);
    if (active.length && active.every((p) => this.question.answers[p.pid])) {
      this.reveal();
      return true;
    }
    return false;
  }
  reveal() {
    if (this.phase !== "question") return;
    const q = this.question;
    this.phase = "reveal";
    q.autoAt = Date.now() + AUTO_NEXT;
    const cur = this.queue[this.set];
    if (cur?.survival && q.answers[this.hostId]?.correct) cur.streak++;
    for (const p of this.players) {
      const pts = q.answers[p.pid]?.points || 0;
      p.score += pts;
      p.round += pts;
    }
    this.schedule();
    this.emit();
  }
  next() {
    // Lobide sorudan soruya geçiş kendiliğinden olur; kurucu öne alamaz.
    if (this.phase === "reveal" && this.solo) this.advance();
    else if (this.phase === "ranking") this.begin();
  }
  skip() {
    // Süreyi bitirmek yalnızca tek başına oynarken var; lobide herkes süresini kullanır.
    if (this.phase === "question" && this.solo) this.reveal();
  }

  // ---- komutlar (yerel kurucu veya ağdan gelen oyuncu) ----
  handle(pid, a) {
    const host = pid === this.hostId;
    const needHost = () => {
      if (!host) throw Error("Bunu yalnızca kurucu yapabilir.");
    };
    switch (a.type) {
      case "answer":
        if (this.question?.id !== a.q) throw Error("Bu soru kapandı.");
        return this.answer(pid, a.answer);
      case "add":
        needHost();
        if (this.phase !== "lobby") throw Error("Oyun başladı.");
        this.addSet(a);
        break;
      case "remove":
        needHost();
        if (this.phase !== "lobby") throw Error("Oyun başladı.");
        this.queue = this.queue.filter((s) => s.id !== a.id);
        break;
      case "move": {
        needHost();
        const i = this.queue.findIndex((s) => s.id === a.id);
        const j = i + a.dir;
        if (i < 0 || j < 0 || j >= this.queue.length) return;
        [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
        break;
      }
      case "settings":
        needHost();
        if ([10, 15, 20, 30, 45].includes(a.seconds)) this.seconds = a.seconds;
        if (typeof a.autoNext === "boolean") this.autoNext = a.autoNext;
        if (this.phase === "reveal") this.schedule();
        break;
      case "kick":
        needHost();
        if (a.pid !== this.hostId) this.kick(a.pid);
        break;
      case "start":
        needHost();
        if (this.phase !== "lobby") throw Error("Oyun zaten başladı.");
        return this.begin();
      case "next":
        needHost();
        return this.next();
      case "skip":
        needHost();
        return this.skip();
      case "again":
        // Solo: aynı quizleri baştan oyna (puan sıfırlanır).
        needHost();
        this.phase = "lobby";
        this.set = -1;
        this.index = -1;
        this.question = null;
        for (const p of this.players) (p.score = 0), (p.round = 0);
        this.queue = this.queue.map((s) => ({ ...s, id: uid(), streak: 0, questions: shuffle(s.survival ? s.tracks : s.questions) }));
        break;
      case "lobby":
        // Çok oyunculu: herkes lobiye döner; genel puanlar ve geçmiş kalır, oynanan quizler sıradan çıkar.
        needHost();
        if (!["done", "ranking"].includes(this.phase)) throw Error("Oyun sürüyor.");
        clearTimeout(this.timer);
        this.phase = "lobby";
        this.queue = this.queue.slice(this.set + 1);
        this.set = -1;
        this.index = -1;
        this.question = null;
        for (const p of this.players) p.round = 0;
        break;
      case "requeue": {
        needHost();
        if (this.phase !== "lobby") throw Error("Oyun başladı.");
        const h = this.history.find((x) => x.id === a.id);
        if (!h) throw Error("Bu quiz artık yok.");
        if (this.queue.length >= 12) throw Error("Kuyrukta en fazla 12 quiz olabilir.");
        const pool = h.set.tracks;
        this.queue.push({
          id: uid(),
          kind: h.set.kind,
          emoji: h.set.emoji,
          name: h.set.name,
          art: h.set.art,
          picture: h.set.picture,
          tracks: pool,
          questions: shuffle(pool).slice(0, h.set.pool),
          mode: h.set.mode,
          clip: h.set.clip,
          reverse: !!h.set.reverse,
          video: !!h.set.video,
        });
        break;
      }
      case "reset":
        needHost();
        if (this.phase !== "lobby") throw Error("Oyun başladı.");
        for (const p of this.players) (p.score = 0), (p.round = 0);
        this.history = [];
        break;
      default:
        throw Error("Bilinmeyen işlem.");
    }
    this.emit();
  }

  // ---- oyuncuya giden özet: cevaplar süre bitmeden açılmaz ----
  view(pid) {
    const q = this.question;
    const set = this.queue[this.set];
    const reveal = this.phase === "reveal";
    const mine = q?.answers[pid];
    return {
      code: this.code,
      solo: this.solo,
      phase: this.phase,
      host: this.hostId,
      me: pid,
      seconds: this.seconds,
      autoNext: this.autoNext,
      now: Date.now(),
      players: this.players.map(({ pid, name, avatar, color, photo, score, round, online }) => ({
        pid,
        name,
        avatar,
        color,
        photo,
        score,
        round,
        online,
      })),
      queue: this.queue.map((s) => ({
        id: s.id,
        name: s.name,
        art: s.art,
        picture: s.picture,
        emoji: s.emoji || "",
        kind: s.kind || "song",
        count: s.questions.length,
        survival: !!s.survival,
        streak: s.streak || 0,
        mode: s.mode,
        clip: s.clip,
        reverse: !!s.reverse,
        video: !!s.video,
      })),
      set: this.set,
      index: this.index,
      rankAt: this.phase === "ranking" ? this.rankAt || null : null,
      history: this.history.map(({ id, name, art, picture, emoji, count, top }) => ({ id, name, art, picture, emoji: emoji || "", count, top })),
      question:
        q && ["preparing", "question", "reveal"].includes(this.phase)
          ? {
              id: q.id,
              kind: set.kind || "song",
              text: set.kind === "trivia" || set.kind === "rank" ? q.item.q : set.kind === "op" ? "Bu opening hangi animenin, şarkının adı ne?" : null,
              picture: set.kind === "rank" ? q.item.cover || set.picture : null,
              artist: set.kind === "rank" ? q.item.artist : null,
              slots: set.kind === "rank" ? RANK_N : null,
              yt: set.kind === "op" ? q.item.yt : null,
              ys: set.kind === "op" ? q.item.s : null,
              video: set.kind === "op" ? !!set.video : null,
              options2: set.kind === "op" ? q.options2 : null,
              pic: set.kind === "trivia" && q.item.iw === "q" ? q.item.img : null,
              url: this.phase === "preparing" ? null : q.url,
              offset: q.offset,
              clip: set.clip,
              reverse: !!set.reverse,
              mode: set.mode,
              start: q.start,
              end: q.end,
              autoAt: reveal && !this.solo ? q.autoAt : null,
              options: ["choice", "rank", "op"].includes(set.mode) ? q.options : null,
              answered: Object.keys(q.answers),
              mine: mine ? (reveal ? mine : { answer: mine.answer }) : null,
              votes:
                set.mode === "choice" && (mine || reveal)
                  ? Object.fromEntries(Object.entries(q.answers).map(([k, v]) => [k, v.answer]))
                  : {},
              reveal: reveal
                ? {
                    title: set.kind === "trivia" ? q.item.a[0] : set.kind === "rank" ? q.item.artist : set.kind === "op" ? q.item.anime : q.track.title,
                    song: set.kind === "op" ? q.item.song : null,
                    order: set.kind === "rank" ? q.item.top : null,
                    flag: set.kind === "trivia" ? q.item.f || null : null,
                    emo: set.kind === "trivia" ? q.item.e || null : null,
                    pic: set.kind === "trivia" && q.item.iw !== "q" ? q.item.img || null : null,
                    artist: set.kind === "trivia" || set.kind === "rank" || set.kind === "op" ? "" : q.track.artist,
                    cover: q.cover,
                    album: q.album,
                    results: Object.fromEntries(
                      Object.entries(q.answers).map(([k, v]) => [
                        k,
                        { answer: v.answer, correct: v.correct, partial: !!v.partial, marks: v.marks || null, hit: v.hit || null, points: v.points, ms: v.ms },
                      ]),
                    ),
                  }
                : null,
            }
          : null,
    };
  }
}
