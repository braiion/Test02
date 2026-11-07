import Peer, { type DataConnection } from "peerjs";

/**
 * Liaison directe téléphone → Tesla (WebRTC, pair à pair).
 * Le serveur public PeerJS ne sert qu'à la mise en relation ; les mesures passent ensuite
 * directement entre les deux appareils (idéalement Tesla connectée au point d'accès du téléphone).
 * Message téléphone → Tesla : { k:"m", l:[x,y,z]|null, g:[x,y,z]|null } ; ping/pong pour mesurer la latence.
 */
export type PhoneMsg = { k: "m"; l: number[] | null; g: number[] | null } | { k: "ping"; id: number } | { k: "pong"; id: number };

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const PREFIX = "enginesync-";
/** Option de test : ?ps=hôte:port pour utiliser un serveur PeerJS local au lieu du serveur public. */
export function peerOptions(): Record<string, unknown> {
  const ps = new URLSearchParams(location.search).get("ps");
  if (!ps) return { debug: 0 };
  const [host, port] = ps.split(":");
  return { debug: 0, host, port: Number(port) || 9000, path: "/", secure: location.protocol === "https:" };
}
export function newCode(): string { let s = ""; for (let i = 0; i < 5; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]; return s; }

/** Côté Tesla : attend la connexion du téléphone. */
export class PhoneHost {
  code = newCode();
  status = "init"; rttMs = NaN; msgHz = 0; lastMsg = 0;
  private peer: Peer | null = null; private conn: DataConnection | null = null;
  private pingId = 0; private pings = new Map<number, number>(); private cnt = 0; private cntT = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private onMotion: (l: number[] | null, g: number[] | null) => void, private onStatus: () => void) {}

  start() {
    if (this.peer) return;
    this.status = "connexion au serveur…"; this.onStatus();
    this.peer = new Peer(PREFIX + this.code, peerOptions());
    this.peer.on("open", () => { this.status = "en attente du téléphone"; this.onStatus(); });
    this.peer.on("error", (e) => { this.status = `erreur : ${e.type}`; this.onStatus();
      if (e.type === "unavailable-id") { this.peer?.destroy(); this.peer = null; this.code = newCode(); this.start(); } });
    this.peer.on("connection", (c) => {
      this.conn?.close(); this.conn = c;
      c.on("open", () => { this.status = "téléphone connecté"; this.onStatus(); });
      c.on("data", (d) => this.onData(d as PhoneMsg));
      c.on("close", () => { if (this.conn === c) { this.conn = null; this.status = "téléphone déconnecté"; this.onStatus(); } });
    });
    this.timer = setInterval(() => {
      if (this.conn?.open) { const id = ++this.pingId; this.pings.set(id, performance.now()); this.conn.send({ k: "ping", id }); }
      const now = performance.now();
      if (now - this.cntT >= 1000) { this.msgHz = this.cnt * 1000 / (now - this.cntT || 1); this.cnt = 0; this.cntT = now; }
    }, 1000);
  }

  private onData(m: PhoneMsg) {
    if (!m || typeof m !== "object") return;
    if (m.k === "m") { this.cnt++; this.lastMsg = performance.now(); this.onMotion(m.l, m.g); }
    else if (m.k === "pong") { const t = this.pings.get(m.id); if (t) { this.rttMs = performance.now() - t; this.pings.delete(m.id); } }
  }

  get connected() { return !!this.conn?.open && performance.now() - this.lastMsg < 1000; }
  stop() { if (this.timer) clearInterval(this.timer); this.conn?.close(); this.peer?.destroy(); this.peer = null; this.conn = null; this.status = "arrêté"; }
}
