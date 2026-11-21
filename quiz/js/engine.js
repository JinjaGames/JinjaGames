// Oyun motoru. Kurucunun tarayıcısında çalışır ve tek doğruluk kaynağıdır.
// Diğer oyuncular yalnızca kendilerine özel durum özetini (view) alır.
import { fold, preview } from "./music.js";
import { cleanItems, cleanEmoji } from "./trivia.js";

export const MAX_PLAYERS = 12;
const PLAYS = 3;
const COUNTDOWN = 3000;
const AUTO_NEXT = 8000;
const NEXT_QUIZ = 30000; // çok oyunculu: quiz arası sıralama ekranı bu kadar sonra kendiliğinden geçer

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
  addSet({ list, tracks, ids, count, mode, clip, kind, items }) {
    if (this.queue.length >= 12) throw Error("Kuyrukta en fazla 12 quiz olabilir.");
    if (kind === "trivia") {
      const pool = cleanItems(items);
      if (pool.length < 2) throw Error("Bu triviada yeterli soru yok.");
      const n = Math.max(1, Math.min(pool.length, Number(count) || 10, 100));
      this.queue.push({
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
      clip: [1, 3, 5].includes(clip) ? clip : 3,
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
        set: { kind: set.kind, emoji: set.emoji, name: set.name, art: set.art, picture: set.picture, tracks: set.tracks, pool: set.questions.length, mode: set.mode, clip: set.clip },
      });
      if (this.history.length > 10) this.history.shift();
      this.rankAt = this.phase === "ranking" && !this.solo ? Date.now() + NEXT_QUIZ : null;
      this.schedule();
      this.question = null;
      this.emit();
      return;
    }
    if (set.kind === "trivia") {
      // Trivia: ses yok, soru hemen açılır. Geri sayım boyunca soru okunur, şıklar sonra açılır.
      const item = set.questions[this.index];
      const start = Date.now() + COUNTDOWN;
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
        q.start = Date.now() + COUNTDOWN;
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
    else if (this.phase === "reveal" && this.autoNext && !this.solo)
      this.timer = setTimeout(() => this.next(), Math.max(0, q.autoAt - Date.now()));
    else if (this.phase === "ranking" && this.rankAt)
      this.timer = setTimeout(() => this.phase === "ranking" && this.next(), Math.max(0, this.rankAt - Date.now()));
  }
  answer(pid, text) {
    const q = this.question;
    const now = Date.now();
    if (this.phase !== "question" || now < q.start) throw Error("Bu soru cevap almıyor.");
    if (q.answers[pid]) return;
    const set = this.queue[this.set];
    const answer = String(text ?? "").trim().slice(0, 120);
    if (!answer) throw Error("Bir cevap yaz.");
    if (set.mode === "choice" && !q.options.includes(answer)) throw Error("Geçerli bir şık seç.");
    const correct = set.kind === "trivia" ? answer === q.item.a[0] : set.mode === "choice" ? answer === q.track.title : matches(answer, q.track);
    const left = 1 - (now - q.start) / (q.end - q.start);
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
    for (const p of this.players) {
      const pts = q.answers[p.pid]?.points || 0;
      p.score += pts;
      p.round += pts;
    }
    this.schedule();
    this.emit();
  }
  next() {
    if (this.phase === "reveal") this.advance();
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
        this.queue = this.queue.map((s) => ({ ...s, id: uid(), questions: shuffle(s.questions) }));
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
        mode: s.mode,
        clip: s.clip,
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
              text: set.kind === "trivia" ? q.item.q : null,
              url: this.phase === "preparing" ? null : q.url,
              offset: q.offset,
              clip: set.clip,
              mode: set.mode,
              start: q.start,
              end: q.end,
              autoAt: reveal && this.autoNext && !this.solo ? q.autoAt : null,
              options: set.mode === "choice" ? q.options : null,
              answered: Object.keys(q.answers),
              mine: mine ? (reveal ? mine : { answer: mine.answer }) : null,
              votes:
                set.mode === "choice" && (mine || reveal)
                  ? Object.fromEntries(Object.entries(q.answers).map(([k, v]) => [k, v.answer]))
                  : {},
              reveal: reveal
                ? {
                    title: set.kind === "trivia" ? q.item.a[0] : q.track.title,
                    artist: set.kind === "trivia" ? "" : q.track.artist,
                    cover: q.cover,
                    album: q.album,
                    results: Object.fromEntries(
                      Object.entries(q.answers).map(([k, v]) => [
                        k,
                        { answer: v.answer, correct: v.correct, points: v.points, ms: v.ms },
                      ]),
                    ),
                  }
                : null,
            }
          : null,
    };
  }
}
