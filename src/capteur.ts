import Peer, { type DataConnection } from "peerjs";
import { PREFIX, peerOptions, type PhoneMsg } from "./sensors/phoneLink";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const codeIn = $<HTMLInputElement>("code");
const fromUrl = new URLSearchParams(location.search).get("c");
if (fromUrl) codeIn.value = fromUrl.toUpperCase();

let conn: DataConnection | null = null;
let peer: Peer | null = null;
let sent = 0, lastHzT = performance.now(), lastSend = 0;
let wakeLock: { release(): Promise<void> } | null = null;

function status(s: string, cls = "") { const e = $("st"); e.textContent = s; e.className = cls; }

let gotMotion = false;
function onMotion(e: DeviceMotionEvent) {
  gotMotion = true;
  const a = e.acceleration, g = e.accelerationIncludingGravity;
  const l = a && a.x !== null ? [a.x, a.y, a.z] as number[] : null;
  const gg = g && g.x !== null ? [g.x, g.y, g.z] as number[] : null;
  if (l) $("acc").textContent = `${Math.hypot(l[0], l[1]).toFixed(2)} m/s²`;
  const now = performance.now();
  if (conn?.open && now - lastSend >= 14) { // ≤ ~70 messages/s
    lastSend = now; conn.send({ k: "m", l, g: gg } satisfies PhoneMsg); sent++;
  }
  if (now - lastHzT >= 1000) { $("hz").textContent = String(Math.round(sent * 1000 / (now - lastHzT))); sent = 0; lastHzT = now; }
}

async function keepAwake() {
  try {
    const nav = navigator as unknown as { wakeLock?: { request(t: string): Promise<{ release(): Promise<void> }> } };
    if (nav.wakeLock) wakeLock = await nav.wakeLock.request("screen");
  } catch { /* non supporté */ }
}
document.addEventListener("visibilitychange", () => { if (!document.hidden && conn) keepAwake(); });

$("go").onclick = async () => {
  const code = codeIn.value.trim().toUpperCase();
  if (code.length !== 5) { status("code à 5 caractères", "bad"); return; }
  // iOS : permission capteurs obligatoire, depuis ce geste
  const DME = (window as unknown as { DeviceMotionEvent?: { requestPermission?: () => Promise<string> } }).DeviceMotionEvent;
  let perm = "granted";
  try { if (DME?.requestPermission) perm = await DME.requestPermission(); } catch { /* pas de demande nécessaire */ }
  if (perm !== "granted") status("⚠ capteurs peut-être refusés : vérifie les réglages du navigateur", "bad");
  setTimeout(() => { if (!gotMotion) status("⚠ aucune mesure reçue : autorise « Mouvement et orientation » dans les réglages", "bad"); }, 3000);
  addEventListener("devicemotion", onMotion);
  await keepAwake();
  peer?.destroy();
  if (!gotMotion) status("connexion…");
  peer = new Peer(peerOptions());
  peer.on("error", (e) => status(`erreur : ${e.type}${e.type === "peer-unavailable" ? " (code faux ou page Tesla fermée)" : ""}`, "bad"));
  peer.on("open", () => {
    conn = peer!.connect(PREFIX + code, { serialization: "json", reliable: false });
    conn.on("open", () => status("connecté à la Tesla ✓", "ok"));
    conn.on("data", (d) => { const m = d as PhoneMsg; if (m?.k === "ping") conn?.send({ k: "pong", id: m.id } satisfies PhoneMsg); });
    conn.on("close", () => status("déconnecté", "bad"));
  });
};
void wakeLock;
