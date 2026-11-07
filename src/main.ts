import "./style.css";
import QRCode from "qrcode";
import type { VehicleProfile } from "./types";
import { AudioEngine } from "./audio/engine";
import { VehicleModel } from "./engine/vehicleModel";
import { SpeedEstimator, type Measurement } from "./estimation/estimator";
import { FusionEstimator } from "./estimation/fusion";
import { GeoSource } from "./sensors/geo";
import { Simulator } from "./sensors/sim";
import { MotionProcessor, sampleFromArrays, type MotionSample, type Vec } from "./sensors/motion";
import { LocalMotion } from "./sensors/localMotion";
import { PhoneHost } from "./sensors/phoneLink";
import { loadSettings, saveSettings, type SimMode } from "./settings";
import { PerfCurve, mapSpeed, type PerfSpec } from "./engine/performance";
import { DRIVE_MODES, type DriveModeId } from "./engine/driveModes";

const VEHICLES = ["v8-us", "v10-cgt", "v12-svj"];
const BASE = import.meta.env.BASE_URL;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const settings = loadSettings();
let ctx: AudioContext | null = null;
let audio: AudioEngine | null = null;
let profile: VehicleProfile | null = null;
let model: VehicleModel | null = null;

// ---------------- Voiture réelle (hôte) ----------------
interface HostProfile { id: string; name: string; perf: PerfSpec; regenMaxMs2: number }
let hostProfile: HostProfile | null = null;
let hostCurve: PerfCurve | null = null;
function rebuildHost() {
  if (!hostProfile) return;
  const spec: PerfSpec = { ...hostProfile.perf,
    zeroTo100s: settings.host0100 ?? hostProfile.perf.zeroTo100s, topSpeedKmh: settings.hostVmax ?? hostProfile.perf.topSpeedKmh };
  hostCurve = new PerfCurve(spec);
  sim.host = hostCurve; sim.regenMax = hostProfile.regenMaxMs2;
  if (model) model.host = hostCurve;
  updatePerfInfo();
}
function updatePerfInfo() {
  if (!hostCurve) return;
  const h = hostCurve, kmh = (v: number) => (v * 3.6).toFixed(0);
  let txt = `Ta Tesla pied au plancher : ${h.aMax(30 / 3.6).toFixed(1)} m/s² à 30 km/h, ${h.aMax(100 / 3.6).toFixed(1)} à 100, ${h.aMax(150 / 3.6).toFixed(1)} à 150 km/h → la pédale est mesurée par rapport à ce maximum.`;
  if (model?.target && profile) {
    const t = model.target;
    txt += `\n${profile.name} (${t.spec.zeroTo100s} s, ${t.spec.topSpeedKmh} km/h) : quand ta Tesla est à 50 / 100 / 150 km/h pied au plancher, la vraie voiture serait à ` +
      `${kmh(mapSpeed(h, t, 50 / 3.6))} / ${kmh(mapSpeed(h, t, 100 / 3.6))} / ${kmh(mapSpeed(h, t, 150 / 3.6))} km/h.`;
  }
  $("perfInfo").textContent = txt;
  renderGearTable();
}

/** Tableau par rapport : passage pied au plancher (réel), régime après passage, vitesse vraie voiture, vitesse Tesla. */
function renderGearTable() {
  const el = $("gearTable");
  if (!model || !profile) { el.innerHTML = ""; return; }
  const p = profile, n = p.gears.length, kmh = (v: number) => Math.round(v * 3.6);
  const vAt = (rpm: number, g: number) => (rpm / 60) * p.wheelCircumferenceM / (p.gears[g] * p.finalDrive);
  const tesla = (v: number) => {
    if (!model!.calage || !hostCurve || !model!.target) return kmh(v);
    if (v >= model!.target.vmax * 0.99) return null;
    const vh = hostCurve.speedAt(model!.target.timeTo(v));
    return vh >= hostCurve.vmax * 0.985 ? null : kmh(vh);
  };
  let rows = "";
  for (let g = 0; g < n; g++) {
    const last = g === n - 1;
    const r = last ? p.limiterRpm : model.wotShiftRpm(g);
    const v = vAt(r, g);
    const after = last ? "—" : Math.round(r * p.gears[g + 1] / p.gears[g]).toString();
    const vt = tesla(Math.min(v, model.target ? model.target.vmax : v));
    const vReal = model.target && v > model.target.vmax ? `${kmh(model.target.vmax)} (V max)` : `${kmh(v)}`;
    rows += `<tr><td>${g + 1}${last ? "" : ` → ${g + 2}`}</td><td>${p.gears[g]}</td><td>${last ? `rupteur ${r}` : r}</td><td>${after}</td><td>${vReal}</td><td>${vt ?? "au-delà de ta V max"}</td></tr>`;
  }
  el.innerHTML = `<table><thead><tr><th>Rapport</th><th>Démult.</th><th>Passage plancher (tr/min)</th><th>Régime après</th><th>Vitesse vraie voiture (km/h)</th><th>Ta Tesla à (km/h)</th></tr></thead><tbody>${rows}</tbody></table>
  <p>Pont ${p.finalDrive} · ${p.shift?.note ?? ""} · en mode Sport ; Normal passe à 96 %, Confort à 76 % de ce régime.</p>`;
}

// ---------------- Capteurs & estimation ----------------
const est = new SpeedEstimator();      // GPS seul (sert aussi de référence pour l'apprentissage de l'axe)
const fusion = new FusionEstimator();  // accéléromètre + GPS
const mp = new MotionProcessor();
const sim = new Simulator();
let imuSource = "";                     // "Tesla" | "téléphone" | "simulé"

function onImu(s: MotionSample, source: string) {
  imuSource = source;
  const a = mp.push(s);
  if (a === null || !mp.calibrated) return;
  if (!fusion.active) fusion.v = est.predict(s.t, 0); // prise de relais en douceur
  fusion.onImu(s.t, a);
}
function onGps(m: Measurement) {
  est.update(m);
  if (fusion.active) fusion.onGps(m.t, m.v, mp.aLong);
}
const imuFresh = () => fusion.active && performance.now() / 1000 - fusion.lastImuT < 0.5 && mp.calibrated;

const geo = new GeoSource((m) => { if (settings.mode === "gps") onGps(m); });
const local = new LocalMotion((s) => { if (settings.mode === "gps") onImu(s, "Tesla/appareil"); });
const phone = new PhoneHost(
  (l, g) => { if (settings.mode === "gps") onImu(sampleFromArrays(performance.now() / 1000, l, g), "téléphone"); },
  () => { $("phoneSt").textContent = phone.status; },
);

function resetEstimation() { est.reset(); fusion.reset(); mp.reset(); simHist = []; }

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
  if (!ctx) ctx = new AudioContext({ latencyHint: "interactive" });
  await ctx.resume();
  if (!audio) audio = new AudioEngine(ctx);
  $("loading").hidden = false;
  await audio.load(p, `${BASE}vehicles/${p.id}/`, (x) => {
    $("loadBar").style.width = `${Math.round(x * 100)}%`;
    $("loadTxt").textContent = `Préparation des sons… ${Math.round(x * 100)} %`;
  });
  $("loading").hidden = true;
  profile = p; model = new VehicleModel(p, { host: hostCurve ?? undefined, calage: settings.calage, mode: DRIVE_MODES[settings.driveMode] });
  updatePerfInfo();
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
  resetEstimation(); sim.v = 0;
  model.start();
  if (settings.mode === "gps") { geo.start(); await local.start(); }
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
  document.querySelectorAll<HTMLButtonElement>("[data-sim]").forEach((b) => b.classList.toggle("sel", b.dataset.sim === settings.simMode));
  resetEstimation();
  if (settings.mode === "gps" && model?.running) { geo.start(); void local.start(); } else geo.stop();
  saveSettings(settings);
}
$("modeGps").onclick = () => { settings.mode = "gps"; applyMode(); };
$("modeDemo").onclick = () => { settings.mode = "demo"; applyMode(); };
document.querySelectorAll<HTMLButtonElement>("[data-sim]").forEach((b) => {
  b.onclick = () => { settings.simMode = b.dataset.sim as SimMode; applyMode(); };
});

// téléphone capteur
$("phoneBtn").onclick = async () => {
  const panel = $("phonePanel");
  panel.hidden = !panel.hidden;
  if (panel.hidden) return;
  phone.start();
  const ps = new URLSearchParams(location.search).get("ps");
  const url = new URL(`capteur.html?c=${phone.code}${ps ? `&ps=${ps}` : ""}`, location.href).toString();
  $("phoneCode").textContent = phone.code;
  $("phoneUrl").textContent = new URL("capteur.html", location.href).toString().replace(/^https?:\/\//, "");
  await QRCode.toCanvas($<HTMLCanvasElement>("qr"), url, { width: 220, margin: 1 });
};
$("calibBtn").onclick = () => {
  const ok = mp.calibrateNow();
  $("calibBtn").textContent = ok ? "🎯 Calibré ✓ (recommencer ?)" : "🎯 Pas assez d'accélération — réessaie pied au plancher";
};

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
addEventListener("keydown", (e) => {
  if (e.key === "ArrowUp") { sim.pedal = e.shiftKey ? 0.5 : 1; e.preventDefault(); }
  if (e.key === " ") { sim.brake = true; e.preventDefault(); }
});
addEventListener("keyup", (e) => { if (e.key === "ArrowUp") sim.pedal = 0; if (e.key === " ") sim.brake = false; });

// modes de conduite
function applyDriveMode() {
  document.querySelectorAll<HTMLButtonElement>("[data-dm]").forEach((b) => b.classList.toggle("sel", b.dataset.dm === settings.driveMode));
  if (model) model.mode = DRIVE_MODES[settings.driveMode];
  saveSettings(settings);
}
document.querySelectorAll<HTMLButtonElement>("[data-dm]").forEach((b) => {
  b.onclick = () => { settings.driveMode = b.dataset.dm as DriveModeId; applyDriveMode(); };
});
applyDriveMode();

// voiture hôte & calage
const h0100 = $<HTMLInputElement>("h0100"), hVmax = $<HTMLInputElement>("hVmax"), calage = $<HTMLInputElement>("calage");
calage.checked = settings.calage;
calage.onchange = () => { settings.calage = calage.checked; if (model) model.calage = calage.checked; saveSettings(settings); updatePerfInfo(); };
const onHostInput = () => {
  const a = parseFloat(h0100.value), b = parseFloat(hVmax.value);
  if (a >= 2 && a <= 15) settings.host0100 = a;
  if (b >= 100 && b <= 350) settings.hostVmax = b;
  saveSettings(settings); rebuildHost();
};
h0100.onchange = onHostInput; hVmax.onchange = onHostInput;
$("hReset").onclick = () => { settings.host0100 = null; settings.hostVmax = null; saveSettings(settings); loadHost(); };
async function loadHost() {
  hostProfile = await (await fetch(`${BASE}hosts/model-y-lr-juniper.json`)).json();
  $("hostName").textContent = hostProfile!.name;
  h0100.value = String(settings.host0100 ?? hostProfile!.perf.zeroTo100s);
  hVmax.value = String(settings.hostVmax ?? hostProfile!.perf.topSpeedKmh);
  rebuildHost();
}

// réglages
const vol = $<HTMLInputElement>("vol"), la = $<HTMLInputElement>("la"), dbg = $<HTMLInputElement>("dbg");
vol.value = String(settings.volume); la.value = String(settings.lookaheadMs); dbg.checked = settings.debug;
const showLa = () => { $("laTxt").textContent = `${settings.lookaheadMs} ms`; };
vol.oninput = () => { settings.volume = +vol.value; audio?.setVolume(settings.volume); saveSettings(settings); };
la.oninput = () => { settings.lookaheadMs = +la.value; showLa(); saveSettings(settings); };
dbg.onchange = () => { settings.debug = dbg.checked; $("debug").hidden = !dbg.checked; saveSettings(settings); };
$("debug").hidden = !settings.debug; showLa();

// ---------------- Simulation des capteurs (mode Démo) ----------------
let simHist: { t: number; v: number }[] = [];
let nextSimFix = 0;
// téléphone posé de travers : rotation fixe arbitraire
const ROT = (() => { const a = 0.7, b = -0.4; const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
  return (v: Vec): Vec => { const x1 = ca * v[0] - sa * v[1], y1 = sa * v[0] + ca * v[1]; return [x1, cb * y1 - sb * v[2], sb * y1 + cb * v[2]]; }; })();
function simSensors(now: number) {
  simHist.push({ t: now, v: sim.v }); while (simHist.length && simHist[0].t < now - 2) simHist.shift();
  if (now >= nextSimFix) {
    nextSimFix = now + 1;
    const old = simHist.find((h) => h.t >= now - 0.3) ?? simHist[0];
    onGps({ t: now, v: old.v });
  }
  if (settings.simMode === "gps+imu") {
    const n = () => (Math.random() - 0.5) * 0.6; // vibrations
    const lin = ROT([sim.a + n(), n() * 0.5, n() * 0.5]);
    const incl = ROT([sim.a, 0, 9.81]);
    onImu({ t: now, lin, incl }, "simulé");
  }
}
// en simulation, l'apprentissage auto prend ~10 s : on pré-calibre pour le confort de la démo
setInterval(() => { if (settings.mode === "demo" && settings.simMode === "gps+imu" && !mp.calibrated && Math.abs(sim.a) > 2) mp.calibrateNow(); }, 200);

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
  if (model && audio && profile && ctx) {
    const laS = settings.lookaheadMs / 1000;
    const audioLat = (ctx.baseLatency || 0) + (ctx.outputLatency || 0) + 0.03;
    let inp = { v: 0, a: 0 };
    let src = "";
    const sensorPath = settings.mode === "gps" || settings.simMode !== "perfect";
    if (settings.mode === "demo") { sim.step(dt); if (settings.simMode !== "perfect") simSensors(now); }
    if (!sensorPath) { inp = { v: sim.v, a: sim.a }; src = "parfait"; }
    else {
      // apprentissage continu de l'axe avant grâce à l'accélération GPS
      if (est.count > 2 && now - est.tLast < 2) mp.learn(est.a, dt);
      if (imuFresh()) { inp = { v: fusion.predict(audioLat), a: fusion.a }; src = `accéléro (${imuSource})`; }
      else { inp = { v: est.predict(now, laS), a: est.accelAt(now, laS) }; src = "GPS seul"; }
    }

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
      if (settings.mode === "demo") { g.textContent = `Démo · ${src}`; g.className = "pill"; }
      else {
        const age = geo.lastRecv ? now - geo.lastRecv : Infinity;
        g.textContent = geo.error || (age === Infinity ? "GPS en attente" : `GPS ${geo.hz.toFixed(1)} Hz`);
        g.className = "pill " + (geo.error || age > 3 ? "bad" : age > 1.6 ? "warn" : "ok");
      }
      const it = $("imuTxt");
      if (!mp.count) { it.textContent = "Accéléromètre : aucun"; it.className = "pill bad"; }
      else if (!mp.calibrated) { it.textContent = `Accéléro ${imuSource} ${mp.hz.toFixed(0)} Hz · apprentissage du sens… ${Math.min(99, Math.round(mp.learnWeight / 3 * 100))} %`; it.className = "pill warn"; }
      else { it.textContent = `Accéléro ${imuSource} ${mp.hz.toFixed(0)} Hz ✓ ${imuFresh() ? "actif" : "en attente"}`; it.className = "pill " + (imuFresh() ? "ok" : "warn"); }
      if (!$("phonePanel").hidden) $("phoneSt").textContent = `${phone.status}${phone.connected ? ` · ${phone.msgHz.toFixed(0)} mesures/s · aller-retour ${phone.rttMs.toFixed(0)} ms` : ""}`;
      if (settings.debug) {
        $("debug").textContent =
          `mode ${settings.mode}/${settings.simMode}   source vitesse : ${src}   anticipation GPS ${settings.lookaheadMs} ms   latence audio ${(audioLat * 1000).toFixed(0)} ms\n` +
          `v réelle(sim) ${(sim.v * 3.6).toFixed(1)}   v utilisée ${(inp.v * 3.6).toFixed(1)} km/h   a utilisée ${inp.a.toFixed(2)}   a réelle(sim) ${sim.a.toFixed(2)} m/s²\n` +
          `GPS-est v ${(est.v * 3.6).toFixed(1)} a ${est.a.toFixed(2)} pts ${est.count} | fusion v ${(fusion.v * 3.6).toFixed(1)} a ${fusion.a.toFixed(2)} biais ${fusion.bias.toFixed(2)}\n` +
          `accéléro ${mp.count} éch. ${mp.hz.toFixed(0)} Hz  aLong ${mp.aLong.toFixed(2)}  calibré ${mp.calibrated ? "oui" : "non"} (${mp.learnWeight.toFixed(1)})\n` +
          `mode ${settings.driveMode}  calage ${model.calage ? "oui" : "non"}  pédale estimée ${(model.ratio * 100).toFixed(0)} %  v simulée ${(model.vVirt * 3.6).toFixed(0)} km/h  a max Tesla ici ${hostCurve ? hostCurve.aMax(inp.v).toFixed(2) : "—"}\n` +
          `rpm ${s.rpm.toFixed(0)}  rapport ${s.gear + 1}  charge ${s.load.toFixed(2)}  rupteur ${s.limiter ? "OUI" : "-"}  passage ${s.shifting ? "OUI" : "-"}\n` +
          `GPS ${geo.hz.toFixed(2)} Hz  précision ${Number.isFinite(geo.accuracy) ? geo.accuracy.toFixed(0) : "—"} m  doppler ok/null ${geo.dopplerOk}/${geo.dopplerNull}   voix audio ${audio.activeVoices}`;
      }
    }
  }
}
function rafLoop() { frame(); requestAnimationFrame(rafLoop); }
requestAnimationFrame(rafLoop);
setInterval(() => { if (document.hidden) frame(); }, 33);
document.addEventListener("visibilitychange", () => { if (!document.hidden) ctx?.resume(); });

applyMode();
loadHost().then(initGarage);
