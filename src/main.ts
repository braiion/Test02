import "./style.css";
import type { VehicleProfile } from "./types";
import { AudioEngine } from "./audio/engine";
import { VehicleModel } from "./engine/vehicleModel";
import { SpeedEstimator } from "./estimation/estimator";
import { GeoSource } from "./sensors/geo";
import { Simulator } from "./sensors/sim";
import { loadSettings, saveSettings } from "./settings";

const VEHICLES = ["v8-us", "v10-cgt", "v12-svj"];
const BASE = import.meta.env.BASE_URL;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const settings = loadSettings();
let ctx: AudioContext | null = null;
let audio: AudioEngine | null = null;
let profile: VehicleProfile | null = null;
let model: VehicleModel | null = null;
const est = new SpeedEstimator();
const sim = new Simulator();
const geo = new GeoSource((m) => { if (settings.mode === "gps") est.update(m); });
let simHist: { t: number; v: number }[] = [];
let nextSimFix = 0;

// ---------------- Garage ----------------
async function initGarage() {
  const cards = $("cards");
  for (const id of VEHICLES) {
    const p: VehicleProfile = await (await fetch(`${BASE}vehicles/${id}/vehicle.json`)).json();
    const b = document.createElement("button");
    b.className = "card";
    b.innerHTML = `<b>${p.name}</b><span>${p.engine}<br/>${p.idleRpm}–${p.limiterRpm} tr/min · ${p.gears.length} rapports</span>`;
    b.onclick = () => openVehicle(p);
    cards.appendChild(b);
  }
}

async function openVehicle(p: VehicleProfile) {
  // le tap sur la carte sert de « geste utilisateur » pour autoriser l'audio
  if (!ctx) ctx = new AudioContext({ latencyHint: "interactive" });
  await ctx.resume();
  if (!audio) audio = new AudioEngine(ctx);
  $("loading").hidden = false;
  const t0 = performance.now();
  await audio.load(p, `${BASE}vehicles/${p.id}/`, (x) => {
    $("loadBar").style.width = `${Math.round(x * 100)}%`;
    $("loadTxt").textContent = `Préparation des sons… ${Math.round(x * 100)} %`;
  });
  console.info(`sons prêts en ${Math.round(performance.now() - t0)} ms`);
  $("loading").hidden = true;
  profile = p; model = new VehicleModel(p);
  audio.setVolume(settings.volume);
  $("vname").textContent = p.name;
  drawTachBase(p);
  $("garage").hidden = true; $("cockpit").hidden = false;
  setRunning(false);
}

// ---------------- Cockpit ----------------
function setRunning(on: boolean) {
  const b = $("startBtn");
  b.textContent = on ? "■ COUPER" : "▶ DÉMARRER";
  b.classList.toggle("on", on);
}

$("startBtn").onclick = async () => {
  if (!model || !ctx) return;
  await ctx.resume();
  if (model.running) { model.stop(); geo.stop(); setRunning(false); return; }
  est.reset(); sim.v = 0; simHist = [];
  model.start();
  if (settings.mode === "gps") geo.start();
  setRunning(true);
};

$("back").onclick = () => {
  model?.stop(); geo.stop(); audio?.dispose(); model = null; profile = null;
  $("cockpit").hidden = true; $("garage").hidden = false;
};

function applyMode() {
  $("modeGps").classList.toggle("sel", settings.mode === "gps");
  $("modeDemo").classList.toggle("sel", settings.mode === "demo");
  $("demo").hidden = settings.mode !== "demo";
  est.reset();
  if (settings.mode === "gps" && model?.running) geo.start(); else geo.stop();
  saveSettings(settings);
}
$("modeGps").onclick = () => { settings.mode = "gps"; applyMode(); };
$("modeDemo").onclick = () => { settings.mode = "demo"; applyMode(); };

// pédale virtuelle
const pedal = $("pedal");
const setPedal = (e: PointerEvent) => {
  const r = pedal.getBoundingClientRect();
  sim.pedal = Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height + 0.08));
};
pedal.addEventListener("pointerdown", (e) => { pedal.setPointerCapture(e.pointerId); setPedal(e); });
pedal.addEventListener("pointermove", (e) => { if (e.buttons || e.pointerType === "touch") setPedal(e); });
for (const ev of ["pointerup", "pointercancel"]) pedal.addEventListener(ev, () => { sim.pedal = 0; });
const brake = $("brake");
brake.addEventListener("pointerdown", () => { sim.brake = true; brake.classList.add("on"); });
for (const ev of ["pointerup", "pointercancel", "pointerleave"]) brake.addEventListener(ev, () => { sim.brake = false; brake.classList.remove("on"); });
// clavier (PC) : ↑ accélérer, Maj+↑ mi-gaz, espace freiner
addEventListener("keydown", (e) => {
  if (e.key === "ArrowUp") { sim.pedal = e.shiftKey ? 0.5 : 1; e.preventDefault(); }
  if (e.key === " ") { sim.brake = true; e.preventDefault(); }
});
addEventListener("keyup", (e) => { if (e.key === "ArrowUp") sim.pedal = 0; if (e.key === " ") sim.brake = false; });

// réglages
const vol = $<HTMLInputElement>("vol"), la = $<HTMLInputElement>("la"), dbg = $<HTMLInputElement>("dbg"), simGps = $<HTMLInputElement>("simGps");
vol.value = String(settings.volume); la.value = String(settings.lookaheadMs); dbg.checked = settings.debug; simGps.checked = settings.simGps;
const showLa = () => { $("laTxt").textContent = `${settings.lookaheadMs} ms`; };
vol.oninput = () => { settings.volume = +vol.value; audio?.setVolume(settings.volume); saveSettings(settings); };
la.oninput = () => { settings.lookaheadMs = +la.value; showLa(); saveSettings(settings); };
dbg.onchange = () => { settings.debug = dbg.checked; $("debug").hidden = !dbg.checked; saveSettings(settings); };
simGps.onchange = () => { settings.simGps = simGps.checked; est.reset(); saveSettings(settings); };
$("debug").hidden = !settings.debug; showLa();

// ---------------- Compte-tours ----------------
const A0 = 135, SWEEP = 270;
function arc(from: number, to: number) {
  const r = 110, cx = 150, cy = 120;
  const p = (deg: number) => { const a = (deg * Math.PI) / 180; return `${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`; };
  const large = to - from > 180 ? 1 : 0;
  return `M ${p(from)} A ${r} ${r} 0 ${large} 1 ${p(Math.max(from + 0.01, to))}`;
}
let tachMax = 9000;
function drawTachBase(p: VehicleProfile) {
  tachMax = Math.ceil((p.limiterRpm + 500) / 1000) * 1000;
  $("tachBg").setAttribute("d", arc(A0, A0 + SWEEP));
  $("tachRed").setAttribute("d", arc(A0 + SWEEP * (p.redlineRpm / tachMax), A0 + SWEEP));
}

// ---------------- Boucle temps réel ----------------
let last = performance.now();
let lastUi = 0;
function frame() {
  const nowMs = performance.now();
  const dt = Math.min(0.1, (nowMs - last) / 1000); last = nowMs;
  const now = nowMs / 1000;
  if (model && audio && profile) {
    const laS = settings.lookaheadMs / 1000;
    let inp = { v: 0, a: 0 };
    if (settings.mode === "demo") {
      sim.step(dt);
      if (!settings.simGps) inp = { v: sim.v, a: sim.a };
      else {
        // GPS simulé : 1 point/s, valeur en retard de 300 ms (comme un vrai GPS embarqué)
        simHist.push({ t: now, v: sim.v }); while (simHist.length && simHist[0].t < now - 2) simHist.shift();
        if (now >= nextSimFix) {
          nextSimFix = now + 1;
          const old = simHist.find((h) => h.t >= now - 0.3) ?? simHist[0];
          est.update({ t: now, v: old.v });
        }
        inp = { v: est.predict(now, laS), a: est.accelAt(now, laS) };
      }
    } else inp = { v: est.predict(now, laS), a: est.accelAt(now, laS) };

    const s = model.update(dt, inp);
    audio.update(s, profile.idleRpm);
    audio.handle(model.takeEvents());

    if (nowMs - lastUi > 33) {
      lastUi = nowMs;
      $("tachVal").setAttribute("d", arc(A0, A0 + SWEEP * Math.min(1, s.rpm / tachMax)));
      $("rpmTxt").textContent = String(Math.round(s.rpm / 10) * 10);
      $("gear").textContent = !s.running ? "–" : inp.v < 0.5 ? "N" : String(s.gear + 1);
      $("spd").textContent = String(Math.round(inp.v * 3.6));
      $("pedalFill").style.height = `${Math.round(sim.pedal * 100)}%`;
      const g = $("gps");
      if (settings.mode === "demo") { g.textContent = settings.simGps ? "Démo · GPS simulé" : "Démo"; g.className = "pill"; }
      else {
        const age = geo.lastRecv ? now - geo.lastRecv : Infinity;
        g.textContent = geo.error || (age === Infinity ? "GPS en attente" : `GPS ${geo.hz.toFixed(1)} Hz`);
        g.className = "pill " + (geo.error || age > 3 ? "bad" : age > 1.6 ? "warn" : "ok");
      }
      if (settings.debug) {
        const c = ctx!;
        $("debug").textContent =
          `mode ${settings.mode}${settings.simGps ? "+gpsSim" : ""}   anticipation ${settings.lookaheadMs} ms\n` +
          `v réelle(sim) ${(sim.v * 3.6).toFixed(1)} km/h   v utilisée ${(inp.v * 3.6).toFixed(1)} km/h   a ${inp.a.toFixed(2)} m/s²\n` +
          `estimateur v ${(est.v * 3.6).toFixed(1)} a ${est.a.toFixed(2)} points ${est.count}\n` +
          `rpm ${s.rpm.toFixed(0)}  rapport ${s.gear + 1}  charge ${s.load.toFixed(2)}  rupteur ${s.limiter ? "OUI" : "-"}  passage ${s.shifting ? "OUI" : "-"}\n` +
          `GPS ${geo.hz.toFixed(2)} Hz  précision ${geo.accuracy.toFixed?.(0)} m  doppler ok/null ${geo.dopplerOk}/${geo.dopplerNull}\n` +
          `audio ${c.state}  ${c.sampleRate} Hz  latence base ${(c.baseLatency * 1000).toFixed(0)} ms  sortie ${((c.outputLatency || 0) * 1000).toFixed(0)} ms  voix ${audio.activeVoices}`;
      }
    }
  }
}
function rafLoop() { frame(); requestAnimationFrame(rafLoop); }
requestAnimationFrame(rafLoop);
// secours si l'onglet est masqué (rAF suspendu)
setInterval(() => { if (document.hidden) frame(); }, 33);
document.addEventListener("visibilitychange", () => { if (!document.hidden) ctx?.resume(); });

applyMode();
initGarage();
