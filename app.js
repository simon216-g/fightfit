/* ============================================================
   FightFit — logica applicazione
   ============================================================ */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

/* ------------------ Stato e persistenza ------------------ */
const STORAGE_KEY = "fightfit_v1";

const PROFILO_DEFAULT = {
  peso: 70,
  altezza: 175,
  eta: 25,
  sesso: "M",
  obiettivo: "combattimento",
  giorni: 5,
};

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      s.profile = Object.assign({}, PROFILO_DEFAULT, s.profile);
      // passaggio allo schema 2+2+1: una sola volta, poi la scelta resta dell'utente
      if (!s.schema5) {
        s.profile.giorni = 5;
        s.schema5 = true;
      }
      return s;
    }
  } catch (e) { /* dati corrotti: riparti pulito */ }
  return { profile: Object.assign({}, PROFILO_DEFAULT), workouts: [], schema5: true };
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ------------------ Navigazione ------------------ */
const TITLES = {
  home: "FightFit",
  new: "Nuovo allenamento",
  timer: "Cronometro",
  history: "Storico e progressi",
  profile: "Profilo",
};

$$(".nav-btn").forEach((btn) =>
  btn.addEventListener("click", () => showView(btn.dataset.view))
);

function showView(name) {
  $$(".view").forEach((v) => v.classList.remove("active"));
  $("#view-" + name).classList.add("active");
  $$(".nav-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.view === name)
  );
  $("#page-title").textContent = TITLES[name];
  if (name === "home") renderHome();
  if (name === "history") renderHistory();
  window.scrollTo(0, 0);
}

/* ------------------ Toast ------------------ */
let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}

/* ============================================================
   HOME
   ============================================================ */
function renderHome() {
  const { profile, workouts } = state;

  // Suggerimento del giorno
  const sug = prossimoConsigliato(profile, workouts);
  const info = TYPE_INFO[sug.type];
  const msg = messaggioContesto(sug.contesto);
  $("#suggestion-card").innerHTML = `
    <div class="hero-tag">Allenamento consigliato oggi</div>
    <h2>${info.emoji} ${info.nome} — ${sug.label}</h2>
    <div class="hero-sub">Obiettivo: ${GOAL_LABELS[profile.obiettivo]} · ~${sug.durata + 20} min totali${
      msg ? "<br>" + msg : ""
    }</div>
    <ul>${sug.allenamento.slice(0, 4).map((e) => `<li>${e.nome} — ${e.det}</li>`).join("")}
    ${sug.allenamento.length > 4 ? "<li>…e altro</li>" : ""}</ul>
    <button class="btn primary full" id="btn-start-sug">▶️ Inizia questo allenamento</button>
  `;
  $("#btn-start-sug").addEventListener("click", () => {
    precompilaForm(sug);
    showView("new");
  });

  // Statistiche settimana
  const sett = ultimi7Giorni(workouts);
  $("#stat-workouts").textContent = sett.length;
  $("#stat-minutes").textContent = sett.reduce((s, w) => s + w.durataTotale, 0);
  $("#stat-kcal").textContent = sett.reduce((s, w) => s + w.kcal, 0);

  // Piano settimanale
  const plan = pianoSettimanale(profile, workouts);
  $("#weekly-plan").innerHTML = plan
    .map((p) => {
      const i = TYPE_INFO[p.type];
      return `<div class="plan-item ${p.done ? "done" : ""}">
        <span class="plan-emoji">${i.emoji}</span>
        <div><div class="plan-name">${i.nome}</div>
        <div class="plan-det">${p.label}</div></div>
      </div>`;
    })
    .join("");
}

/* ============================================================
   NUOVO ALLENAMENTO
   ============================================================ */
let currentType = "muaythai";

$$(".type-btn").forEach((btn) =>
  btn.addEventListener("click", () => {
    $$(".type-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentType = btn.dataset.type;
    popolaFocus();
    aggiornaKcal();
    renderCarichi();
    renderCorsa();
  })
);

function popolaFocus() {
  const sel = $("#w-focus");
  sel.innerHTML = Object.entries(SESSIONS[currentType])
    .map(([k, v]) => `<option value="${k}">${v.label}</option>`)
    .join("");
}

function exRow(phase, nome = "", det = "") {
  const row = document.createElement("div");
  row.className = "ex-row";
  row.innerHTML = `
    <input class="ex-name" placeholder="Esercizio" value="${escapeAttr(nome)}">
    <input class="ex-det" placeholder="Serie×rip / durata" value="${escapeAttr(det)}">
    <button class="ex-del" title="Rimuovi">✕</button>`;
  row.querySelector(".ex-del").addEventListener("click", () => {
    row.remove();
    renderCarichi();
  });
  $("#list-" + phase).appendChild(row);
}

/* ------------------ Carichi (solo sala pesi) ------------------
   La lista si compila a fine allenamento: il campo resta vuoto e
   mostra come suggerimento il carico consigliato o l'ultimo usato. */
let kgSuggeriti = {};

function renderCarichi() {
  const card = $("#carichi-card");

  // la sezione esiste solo per la sala pesi
  if (currentType !== "pesi") {
    card.hidden = true;
    $("#carichi-list").innerHTML = "";
    return;
  }

  const esercizi = leggiFase("allenamento").filter((e) => e.tipo !== "circuito");

  // visibile fin da subito, così si sa che c'è: si riempie da sola
  card.hidden = false;
  if (!esercizi.length) {
    $("#carichi-list").innerHTML =
      `<p class="empty-small">Aggiungi gli esercizi nella fase 💪 Allenamento: li ritrovi qui per segnare i chili.</p>`;
    return;
  }

  // conserva i valori già digitati
  const gia = {};
  $$("#carichi-list .kg-row").forEach((r) => {
    gia[r.dataset.nome] = r.querySelector(".kg-input").value;
  });

  card.hidden = false;
  $("#carichi-list").innerHTML = esercizi
    .map((e) => {
      const key = e.nome.toLowerCase();
      const sugg = kgSuggeriti[key] || ultimoCarico(state.workouts, e.nome);
      return `<div class="kg-row" data-nome="${escapeAttr(key)}">
        <span class="kg-nome">${escapeAttr(e.nome)}</span>
        <input type="number" class="kg-input" min="0" step="0.5" inputmode="decimal"
          placeholder="${sugg ? formattaKg(sugg) : "—"}" value="${escapeAttr(gia[key] || "")}">
        <span class="kg-unit">kg</span>
      </div>`;
    })
    .join("");
}

$("#list-allenamento").addEventListener("input", renderCarichi);

/* ------------------ Distanza e tempo (solo corsa) ------------------ */
function datiCorsa() {
  const km = +$("#run-km").value || 0;
  const sec = (+$("#run-min").value || 0) * 60 + (+$("#run-sec").value || 0);
  return { km, sec, passo: km > 0 && sec > 0 ? sec / km : 0 };
}

function renderCorsa() {
  $("#corsa-card").hidden = currentType !== "corsa";
  const d = datiCorsa();
  $("#run-passo").textContent = d.passo ? formattaPasso(d.passo) + " min/km" : "—";
}

["run-km", "run-min", "run-sec"].forEach((id) =>
  $("#" + id).addEventListener("input", () => {
    renderCorsa();
    // il tempo di corsa È la durata della fase di allenamento: le tengo allineate
    const d = datiCorsa();
    if (d.sec > 0) $("#min-allenamento").value = Math.round(d.sec / 60);
    aggiornaKcal();
  })
);

function escapeAttr(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

$$(".add-ex").forEach((btn) =>
  btn.addEventListener("click", () => {
    exRow(btn.dataset.phase);
    renderCarichi();
  })
);

/* ------------------ Circuiti ------------------
   Un circuito è un blocco unico che contiene più sotto-esercizi,
   ognuno a tempo (sec/min) o a ripetizioni. */

const UNIT_OPTS = `<option value="sec">sec</option><option value="min">min</option><option value="rip">rip</option>`;

function circuitoBlock(dati) {
  const el = document.createElement("div");
  el.className = "circuito-block";
  el.innerHTML = `
    <div class="ci-head">
      <span class="ci-tag">🔁 Circuito</span>
      <input class="ci-nome" placeholder="Nome del circuito" value="${escapeAttr(dati?.nome || "")}">
      <button class="ci-del" title="Rimuovi circuito">✕</button>
    </div>
    <div class="ci-config">
      <label>Giri <input type="number" class="ci-giri" min="1" value="${dati?.giri || 3}" inputmode="numeric"></label>
      <label>Rec. esercizi <span class="dual">
        <input type="number" class="ci-rec-es" min="0" value="${dati?.recEsVal ?? 15}" inputmode="numeric">
        <select class="ci-rec-es-unit"><option value="sec">sec</option><option value="min">min</option></select></span></label>
      <label>Rec. giri <span class="dual">
        <input type="number" class="ci-rec-giri" min="0" value="${dati?.recGiriVal ?? 60}" inputmode="numeric">
        <select class="ci-rec-giri-unit"><option value="sec">sec</option><option value="min">min</option></select></span></label>
    </div>
    <div class="ci-list"></div>
    <button class="btn tiny ci-add">+ Aggiungi esercizio al circuito</button>
    <button class="btn ci-start full" hidden>▶️ Avvia circuito</button>
  `;

  el.querySelector(".ci-del").addEventListener("click", () => {
    el.remove();
    aggiornaDurataCircuiti();
  });
  el.querySelector(".ci-add").addEventListener("click", () => ciExRow(el));
  el.querySelector(".ci-start").addEventListener("click", () => avviaCircuito(leggiCircuito(el)));
  el.addEventListener("input", () => {
    refreshCircuito(el);
    aggiornaDurataCircuiti();
  });

  // ripristina le unità di misura quando si riapre un circuito salvato
  if (dati?.recEsUnit) el.querySelector(".ci-rec-es-unit").value = dati.recEsUnit;
  if (dati?.recGiriUnit) el.querySelector(".ci-rec-giri-unit").value = dati.recGiriUnit;

  const esercizi = dati?.esercizi?.length ? dati.esercizi : [{}, {}];
  esercizi.forEach((e) => ciExRow(el, e));
  refreshCircuito(el);
  return el;
}

function ciExRow(blockEl, dati) {
  const row = document.createElement("div");
  row.className = "ci-ex";
  row.innerHTML = `
    <input class="ci-ex-nome" placeholder="Esercizio" value="${escapeAttr(dati?.nome || "")}">
    <input type="number" class="ci-ex-val" min="0" placeholder="0" value="${dati?.val ?? ""}" inputmode="numeric">
    <select class="ci-ex-unit">${UNIT_OPTS}</select>
    <button class="ci-ex-del" title="Rimuovi">✕</button>`;
  row.querySelector(".ci-ex-unit").value = dati?.unit || "sec";
  row.querySelector(".ci-ex-del").addEventListener("click", () => {
    row.remove();
    refreshCircuito(blockEl);
    aggiornaDurataCircuiti();
  });
  blockEl.querySelector(".ci-list").appendChild(row);
  refreshCircuito(blockEl);
}

/* Il tasto "Avvia circuito" compare solo se c'è almeno un esercizio a tempo */
function refreshCircuito(el) {
  const c = leggiCircuito(el);
  const aTempo = c.esercizi.some((e) => e.unit !== "rip" && e.val > 0);
  el.querySelector(".ci-start").hidden = !aTempo;
}

function durataSec(val, unit) {
  return unit === "min" ? (val || 0) * 60 : val || 0;
}

function leggiCircuito(el) {
  const num = (sel) => +el.querySelector(sel).value || 0;
  return {
    tipo: "circuito",
    nome: el.querySelector(".ci-nome").value.trim() || "Circuito",
    giri: Math.max(1, num(".ci-giri")),
    recEsVal: num(".ci-rec-es"),
    recEsUnit: el.querySelector(".ci-rec-es-unit").value,
    recGiriVal: num(".ci-rec-giri"),
    recGiriUnit: el.querySelector(".ci-rec-giri-unit").value,
    recEs: durataSec(num(".ci-rec-es"), el.querySelector(".ci-rec-es-unit").value),
    recGiri: durataSec(num(".ci-rec-giri"), el.querySelector(".ci-rec-giri-unit").value),
    esercizi: [...el.querySelectorAll(".ci-ex")]
      .map((r) => ({
        nome: r.querySelector(".ci-ex-nome").value.trim(),
        val: +r.querySelector(".ci-ex-val").value || 0,
        unit: r.querySelector(".ci-ex-unit").value,
      }))
      .filter((e) => e.nome),
  };
}

/* Minuti stimati del circuito: gli esercizi a ripetizioni valgono 45 sec */
function stimaMinutiCircuito(c) {
  const lavoro = c.esercizi.reduce(
    (s, e) => s + (e.unit === "rip" ? 45 : durataSec(e.val, e.unit)),
    0
  );
  const perGiro = lavoro + c.recEs * Math.max(0, c.esercizi.length - 1);
  const tot = perGiro * c.giri + c.recGiri * Math.max(0, c.giri - 1);
  return Math.round(tot / 60);
}

/* Tiene aggiornati i minuti della fase allenamento sommando/sottraendo
   solo la differenza, così le modifiche manuali dell'utente restano */
let circuitiMinLast = 0;

function aggiornaDurataCircuiti() {
  const tot = leggiFase("allenamento")
    .filter((x) => x.tipo === "circuito")
    .reduce((s, c) => s + stimaMinutiCircuito(c), 0);
  const campo = $("#min-allenamento");
  campo.value = Math.max(0, (+campo.value || 0) - circuitiMinLast + tot);
  circuitiMinLast = tot;
  aggiornaKcal();
}

$("#btn-add-circuito").addEventListener("click", () => {
  $("#list-allenamento").appendChild(circuitoBlock());
  aggiornaDurataCircuiti();
});

/* Legge una fase mantenendo l'ordine tra esercizi singoli e circuiti */
function leggiFase(phase) {
  const out = [];
  [...$("#list-" + phase).children].forEach((el) => {
    if (el.classList.contains("circuito-block")) {
      const c = leggiCircuito(el);
      if (c.esercizi.length) out.push(c);
    } else if (el.classList.contains("ex-row")) {
      const nome = el.querySelector(".ex-name").value.trim();
      if (nome) out.push({ nome, det: el.querySelector(".ex-det").value.trim() });
    }
  });
  return out;
}

$("#btn-genera").addEventListener("click", () => {
  const seduta = generaSeduta(currentType, $("#w-focus").value, state.workouts);
  precompilaForm(seduta);
  toast("Seduta generata in base ai tuoi progressi ✨");
});

function precompilaForm(seduta) {
  // tipo
  currentType = seduta.type;
  $$(".type-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.type === seduta.type)
  );
  popolaFocus();
  $("#w-focus").value = seduta.focus;
  // fasi
  circuitiMinLast = 0;
  ["riscaldamento", "allenamento", "defaticamento"].forEach((phase) => {
    $("#list-" + phase).innerHTML = "";
    seduta[phase].forEach((e) => exRow(phase, e.nome, e.det));
  });
  $("#min-allenamento").value = seduta.durata;

  // carichi consigliati: restano solo come suggerimento nei campi vuoti
  kgSuggeriti = {};
  seduta.allenamento.forEach((e) => {
    if (e.kgSuggerito) kgSuggeriti[e.nome.toLowerCase()] = e.kgSuggerito;
  });
  $("#carichi-list").innerHTML = "";
  renderCarichi();
  renderCorsa();
  aggiornaKcal();
}

/* RPE slider */
const RPE_HINTS = {
  1: "Passeggiata", 2: "Molto facile", 3: "Facile", 4: "Moderato",
  5: "Un po' impegnativo", 6: "Impegnativo", 7: "Impegnativo ma gestibile",
  8: "Duro", 9: "Molto duro", 10: "Massimale, al limite",
};
$("#w-rpe").addEventListener("input", () => {
  $("#rpe-val").textContent = $("#w-rpe").value;
  $("#rpe-hint").textContent = RPE_HINTS[$("#w-rpe").value];
  aggiornaKcal();
});

/* Calorie in tempo reale */
["min-riscaldamento", "min-allenamento", "min-defaticamento"].forEach((id) =>
  $("#" + id).addEventListener("input", aggiornaKcal)
);
$("#w-focus").addEventListener("change", aggiornaKcal);

function aggiornaKcal() {
  $("#kcal-preview").textContent = stimaCalorie(
    currentType,
    $("#w-focus").value,
    +$("#w-rpe").value,
    +$("#min-riscaldamento").value || 0,
    +$("#min-allenamento").value || 0,
    +$("#min-defaticamento").value || 0,
    state.profile,
    currentType === "corsa" ? datiCorsa().passo : 0
  );
}

/* Salvataggio */
$("#btn-salva").addEventListener("click", () => {
  const leggi = leggiFase;

  const riscMin = +$("#min-riscaldamento").value || 0;
  const allMin = +$("#min-allenamento").value || 0;
  const defMin = +$("#min-defaticamento").value || 0;
  const allenamento = leggi("allenamento");

  if (!allenamento.length) {
    toast("Aggiungi almeno un esercizio nella fase di allenamento");
    return;
  }

  // carichi digitati a fine allenamento
  const carichi = {};
  $$("#carichi-list .kg-row").forEach((r) => {
    const kg = +r.querySelector(".kg-input").value;
    if (kg > 0) carichi[r.dataset.nome] = kg;
  });
  allenamento.forEach((e) => {
    if (e.tipo !== "circuito") {
      const kg = carichi[e.nome.toLowerCase()];
      if (kg) e.kg = kg;
    }
  });

  const corsa = currentType === "corsa" ? datiCorsa() : null;

  const w = {
    id: editingId || Date.now(),
    date: $("#w-date").value || new Date().toISOString().slice(0, 10),
    type: currentType,
    focus: $("#w-focus").value,
    fasi: {
      riscaldamento: { min: riscMin, esercizi: leggi("riscaldamento") },
      allenamento: { min: allMin, esercizi: allenamento },
      defaticamento: { min: defMin, esercizi: leggi("defaticamento") },
    },
    durataTotale: riscMin + allMin + defMin,
    rpe: +$("#w-rpe").value,
    note: $("#w-note").value.trim(),
    kcal: stimaCalorie(
      currentType,
      $("#w-focus").value,
      +$("#w-rpe").value,
      riscMin,
      allMin,
      defMin,
      state.profile,
      corsa ? corsa.passo : 0
    ),
  };

  if (corsa && corsa.km > 0 && corsa.sec > 0) {
    w.km = corsa.km;
    w.tempoSec = corsa.sec;
  }

  if (editingId) {
    const i = state.workouts.findIndex((x) => x.id === editingId);
    if (i >= 0) state.workouts[i] = w;
    else state.workouts.push(w);
    save();
    resetForm();
    toast("✅ Allenamento aggiornato");
    showView("history");
    return;
  }

  state.workouts.push(w);
  save();
  resetForm();
  toast("💪 Allenamento salvato! " + w.kcal + " kcal");
  showView("home");
});

/* ------------------ Modifica di un allenamento salvato ------------------ */
let editingId = null;

function setModalitaModifica(id) {
  editingId = id;
  $("#edit-banner").hidden = !id;
  $("#btn-salva").textContent = id ? "✅ Aggiorna allenamento" : "💾 Salva allenamento";
}

function caricaPerModifica(w) {
  currentType = w.type;
  $$(".type-btn").forEach((b) => b.classList.toggle("active", b.dataset.type === w.type));
  popolaFocus();
  $("#w-focus").value = w.focus;

  kgSuggeriti = {};
  ["riscaldamento", "allenamento", "defaticamento"].forEach((phase) => {
    const lista = $("#list-" + phase);
    lista.innerHTML = "";
    (w.fasi[phase].esercizi || []).forEach((e) => {
      if (e.tipo === "circuito") lista.appendChild(circuitoBlock(e));
      else exRow(phase, e.nome, e.det);
    });
    $("#min-" + phase).value = w.fasi[phase].min;
  });
  // i minuti salvati comprendono già i circuiti: allineo il riferimento
  circuitiMinLast = leggiFase("allenamento")
    .filter((x) => x.tipo === "circuito")
    .reduce((s, c) => s + stimaMinutiCircuito(c), 0);

  $("#w-date").value = w.date;
  $("#w-rpe").value = w.rpe;
  $("#rpe-val").textContent = w.rpe;
  $("#rpe-hint").textContent = RPE_HINTS[w.rpe];
  $("#w-note").value = w.note || "";

  $("#run-km").value = w.km || "";
  $("#run-min").value = w.tempoSec ? Math.floor(w.tempoSec / 60) : "";
  $("#run-sec").value = w.tempoSec ? w.tempoSec % 60 : "";
  renderCorsa();

  $("#carichi-list").innerHTML = "";
  renderCarichi();
  (w.fasi.allenamento.esercizi || []).forEach((e) => {
    if (e.tipo === "circuito" || !e.kg) return;
    const row = $$("#carichi-list .kg-row").find((r) => r.dataset.nome === e.nome.toLowerCase());
    if (row) row.querySelector(".kg-input").value = e.kg;
  });

  setModalitaModifica(w.id);
  aggiornaKcal();
}

$("#btn-annulla-modifica").addEventListener("click", () => {
  resetForm();
  showView("history");
  toast("Modifica annullata");
});

function resetForm() {
  circuitiMinLast = 0;
  kgSuggeriti = {};
  setModalitaModifica(null);
  $("#carichi-list").innerHTML = "";
  $("#carichi-card").hidden = true;
  ["run-km", "run-min", "run-sec"].forEach((id) => ($("#" + id).value = ""));
  renderCorsa();
  ["riscaldamento", "allenamento", "defaticamento"].forEach(
    (p) => ($("#list-" + p).innerHTML = "")
  );
  $("#w-note").value = "";
  $("#w-rpe").value = 7;
  $("#rpe-val").textContent = 7;
  $("#rpe-hint").textContent = RPE_HINTS[7];
  $("#w-date").value = new Date().toISOString().slice(0, 10);
  aggiornaKcal();
}

/* ============================================================
   CRONOMETRO / TIMER
   ============================================================ */
$$(".timer-tab").forEach((tab) =>
  tab.addEventListener("click", () => {
    $$(".timer-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    $$(".timer-panel").forEach((p) => p.classList.remove("active"));
    $("#timer-" + tab.dataset.mode).classList.add("active");
  })
);

/* Beep con WebAudio (nessun file audio necessario) */
let audioCtx;
function beep(freq = 880, durMs = 200, times = 1) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < times; i++) {
      const t0 = audioCtx.currentTime + i * (durMs / 1000 + 0.08);
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      gain.gain.setValueAtTime(0.4, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + durMs / 1000);
      osc.start(t0);
      osc.stop(t0 + durMs / 1000);
    }
  } catch (e) { /* audio non disponibile */ }
}

function fmt(ms, decimi = false) {
  const totSec = Math.floor(ms / 1000);
  const m = String(Math.floor(totSec / 60)).padStart(2, "0");
  const s = String(totSec % 60).padStart(2, "0");
  if (!decimi) return `${m}:${s}`;
  const d = Math.floor((ms % 1000) / 100);
  return `${m}:${s}.${d}`;
}

/* --- Cronometro --- */
let cr = { running: false, start: 0, elapsed: 0, raf: null };

function cronoTick() {
  $("#crono-display").textContent = fmt(cr.elapsed + (Date.now() - cr.start), true);
  cr.raf = requestAnimationFrame(cronoTick);
}

$("#crono-start").addEventListener("click", () => {
  if (!cr.running) {
    cr.running = true;
    cr.start = Date.now();
    cronoTick();
    $("#crono-start").textContent = "Pausa";
  } else {
    cr.running = false;
    cr.elapsed += Date.now() - cr.start;
    cancelAnimationFrame(cr.raf);
    $("#crono-start").textContent = "Riprendi";
  }
});

$("#crono-lap").addEventListener("click", () => {
  if (!cr.running && !cr.elapsed) return;
  const tot = cr.elapsed + (cr.running ? Date.now() - cr.start : 0);
  const li = document.createElement("li");
  li.textContent = fmt(tot, true);
  $("#crono-laps").prepend(li);
});

$("#crono-reset").addEventListener("click", () => {
  cancelAnimationFrame(cr.raf);
  cr = { running: false, start: 0, elapsed: 0, raf: null };
  $("#crono-display").textContent = "00:00.0";
  $("#crono-start").textContent = "Avvia";
  $("#crono-laps").innerHTML = "";
});

/* --- Timer a round --- */
let rd = { running: false, interval: null, phase: "work", round: 1, remaining: 0 };

function roundConfig() {
  const ms = (id) =>
    durataSec(+$("#" + id).value || 0, $("#" + id + "-unit").value) * 1000;
  return {
    rounds: Math.max(1, +$("#r-rounds").value || 5),
    work: Math.max(1000, ms("r-work")),
    rest: Math.max(0, ms("r-rest")),
  };
}

function roundRefresh() {
  const disp = $("#round-display");
  disp.textContent = fmt(rd.remaining);
  disp.className = "time-display " + (rd.running ? rd.phase : "");
  const cfg = roundConfig();
  const label = rd.phase === "work" ? "🥊 LAVORO" : "😮‍💨 Riposo";
  $("#round-status").textContent = rd.running
    ? `${label} — Round ${rd.round} di ${cfg.rounds}`
    : `Pronto — Round ${rd.round} di ${cfg.rounds}`;
}

function roundTick() {
  rd.remaining -= 250;
  if (rd.remaining <= 0) {
    const cfg = roundConfig();
    if (rd.phase === "work") {
      if (rd.round >= cfg.rounds) return roundFinish();
      rd.phase = cfg.rest > 0 ? "rest" : "work";
      if (rd.phase === "rest") {
        rd.remaining = cfg.rest;
        beep(440, 400, 1); // fine round
      } else {
        rd.round++;
        rd.remaining = cfg.work;
        beep(880, 250, 2);
      }
    } else {
      rd.phase = "work";
      rd.round++;
      rd.remaining = cfg.work;
      beep(880, 250, 2); // inizio round
    }
  } else if (rd.remaining <= 10000 && rd.remaining % 1000 < 250 && rd.phase === "work" && rd.remaining <= 3000) {
    beep(660, 100, 1); // ultimi 3 secondi
  }
  roundRefresh();
}

function roundFinish() {
  clearInterval(rd.interval);
  rd.running = false;
  rd.remaining = 0;
  beep(880, 600, 3);
  $("#round-status").textContent = "🏁 Finito! Ottimo lavoro";
  $("#round-display").textContent = "00:00";
  $("#round-display").className = "time-display";
  $("#round-start").textContent = "Avvia";
}

$("#round-start").addEventListener("click", () => {
  if (rd.running) {
    clearInterval(rd.interval);
    rd.running = false;
    $("#round-start").textContent = "Riprendi";
    return;
  }
  if (rd.remaining <= 0) {
    const cfg = roundConfig();
    rd = { running: true, phase: "work", round: 1, remaining: cfg.work, interval: null };
    beep(880, 250, 2);
  } else {
    rd.running = true;
  }
  rd.interval = setInterval(roundTick, 250);
  $("#round-start").textContent = "Pausa";
  roundRefresh();
});

$("#round-reset").addEventListener("click", () => {
  clearInterval(rd.interval);
  const cfg = roundConfig();
  rd = { running: false, interval: null, phase: "work", round: 1, remaining: cfg.work };
  $("#round-start").textContent = "Avvia";
  roundRefresh();
});

["r-rounds", "r-work", "r-rest", "r-work-unit", "r-rest-unit"].forEach((id) =>
  $("#" + id).addEventListener("input", () => {
    if (!rd.running) {
      rd.remaining = roundConfig().work;
      rd.round = 1;
      roundRefresh();
    }
  })
);

/* --- Countdown --- */
let cd = { running: false, interval: null, remaining: 5 * 60000 };

function countRefresh() {
  $("#count-display").textContent = fmt(Math.max(0, cd.remaining));
}

$("#count-start").addEventListener("click", () => {
  if (cd.running) {
    clearInterval(cd.interval);
    cd.running = false;
    $("#count-start").textContent = "Riprendi";
    return;
  }
  if (cd.remaining <= 0) {
    cd.remaining = ((+$("#c-min").value || 0) * 60 + (+$("#c-sec").value || 0)) * 1000;
  }
  if (cd.remaining <= 0) return;
  cd.running = true;
  $("#count-start").textContent = "Pausa";
  cd.interval = setInterval(() => {
    cd.remaining -= 250;
    if (cd.remaining <= 0) {
      clearInterval(cd.interval);
      cd.running = false;
      cd.remaining = 0;
      beep(880, 600, 3);
      $("#count-start").textContent = "Avvia";
    }
    countRefresh();
  }, 250);
});

$("#count-reset").addEventListener("click", () => {
  clearInterval(cd.interval);
  cd.running = false;
  cd.remaining = ((+$("#c-min").value || 0) * 60 + (+$("#c-sec").value || 0)) * 1000;
  $("#count-start").textContent = "Avvia";
  countRefresh();
});

["c-min", "c-sec"].forEach((id) =>
  $("#" + id).addEventListener("input", () => {
    if (!cd.running) {
      cd.remaining = ((+$("#c-min").value || 0) * 60 + (+$("#c-sec").value || 0)) * 1000;
      countRefresh();
    }
  })
);

/* ============================================================
   CIRCUITO AUTOMATICO (schermo intero)
   ============================================================ */
let cir = null; // { coda, i, remaining, running, interval, wakeLock, nome }

/* Costruisce la sequenza completa: esercizi, recuperi e giri */
function codaCircuito(c) {
  const coda = [];
  for (let g = 1; g <= c.giri; g++) {
    c.esercizi.forEach((e, i) => {
      coda.push({
        kind: e.unit === "rip" ? "reps" : "work",
        nome: e.nome,
        sec: e.unit === "rip" ? 0 : durataSec(e.val, e.unit),
        reps: e.unit === "rip" ? e.val : 0,
        giro: g,
      });
      if (i < c.esercizi.length - 1 && c.recEs > 0)
        coda.push({ kind: "rest", nome: "Recupero", sec: c.recEs, giro: g });
    });
    if (g < c.giri && c.recGiri > 0)
      coda.push({ kind: "rest", nome: "Recupero tra i giri", sec: c.recGiri, giro: g });
  }
  return coda;
}

async function tieniSchermoAcceso() {
  try {
    if ("wakeLock" in navigator) cir.wakeLock = await navigator.wakeLock.request("screen");
  } catch (e) { /* non supportato: pazienza */ }
}

document.addEventListener("visibilitychange", () => {
  if (cir && cir.running && document.visibilityState === "visible") tieniSchermoAcceso();
});

function avviaCircuito(c) {
  const coda = codaCircuito(c);
  if (!coda.length) return;
  cir = { coda, i: 0, remaining: 0, running: true, interval: null, wakeLock: null, giri: c.giri, nome: c.nome };
  $("#cr-title").textContent = c.nome;
  $("#circuit-run").hidden = false;
  document.body.classList.add("no-scroll");
  tieniSchermoAcceso();
  caricaSegmento(0);
  cir.interval = setInterval(tickCircuito, 200);
  beep(880, 250, 2);
}

function caricaSegmento(i) {
  const s = cir.coda[i];
  cir.i = i;
  cir.remaining = s.sec * 1000;
  const succ = cir.coda[i + 1];

  $("#cr-giro").textContent = `Giro ${s.giro} di ${cir.giri}`;
  $("#cr-name").textContent = s.nome;
  $("#cr-next").textContent = succ ? "Prossimo: " + succ.nome : "Ultimo esercizio 💪";
  $("#circuit-run").dataset.kind = s.kind;

  if (s.kind === "reps") {
    $("#cr-phase").textContent = "A ripetizioni";
    $("#cr-time").textContent = s.reps ? s.reps + " rip" : "—";
    $("#cr-toggle").hidden = true;
    $("#cr-skip").textContent = "Fatto ✓";
    $("#cr-skip").className = "btn primary";
  } else {
    $("#cr-phase").textContent = s.kind === "rest" ? "Recupero" : "Esercizio";
    $("#cr-toggle").hidden = false;
    $("#cr-toggle").textContent = cir.running ? "Pausa" : "Riprendi";
    $("#cr-skip").textContent = "Avanti ›";
    $("#cr-skip").className = "btn secondary";
  }
  refreshCircuitoUI();
}

function refreshCircuitoUI() {
  const s = cir.coda[cir.i];
  if (s.kind !== "reps") $("#cr-time").textContent = fmt(Math.max(0, cir.remaining));
  $("#cr-bar").style.width = ((cir.i / cir.coda.length) * 100).toFixed(1) + "%";
}

function tickCircuito() {
  if (!cir.running) return;
  const s = cir.coda[cir.i];
  if (s.kind === "reps") return; // attende la conferma dell'utente

  cir.remaining -= 200;
  if (cir.remaining <= 0) return prossimoSegmento();
  if (cir.remaining <= 3000 && cir.remaining % 1000 < 200) beep(660, 90, 1);
  refreshCircuitoUI();
}

function prossimoSegmento() {
  if (cir.i + 1 >= cir.coda.length) return fineCircuito();
  const succ = cir.coda[cir.i + 1];
  beep(succ.kind === "rest" ? 440 : 880, 250, succ.kind === "rest" ? 1 : 2);
  caricaSegmento(cir.i + 1);
}

function fineCircuito() {
  clearInterval(cir.interval);
  cir.running = false;
  beep(880, 600, 3);
  $("#cr-phase").textContent = "🏁 Completato";
  $("#cr-name").textContent = "Ottimo lavoro!";
  $("#cr-time").textContent = "✓";
  $("#cr-next").textContent = "";
  $("#cr-bar").style.width = "100%";
  $("#cr-toggle").hidden = true;
  $("#cr-skip").textContent = "Chiudi";
  $("#cr-skip").className = "btn primary";
}

function chiudiCircuito() {
  if (!cir) return;
  clearInterval(cir.interval);
  if (cir.wakeLock) { try { cir.wakeLock.release(); } catch (e) {} }
  cir = null;
  $("#circuit-run").hidden = true;
  document.body.classList.remove("no-scroll");
}

$("#cr-toggle").addEventListener("click", () => {
  cir.running = !cir.running;
  $("#cr-toggle").textContent = cir.running ? "Pausa" : "Riprendi";
  if (cir.running) tieniSchermoAcceso();
});

$("#cr-skip").addEventListener("click", () => {
  if (!cir.running && cir.i + 1 >= cir.coda.length) return chiudiCircuito();
  prossimoSegmento();
});

$("#cr-close").addEventListener("click", chiudiCircuito);

/* ============================================================
   GRAFICI DI PROGRESSIONE
   ============================================================ */

/* Grafico a linea in SVG: valore più alto = punto più in alto */
function graficoLinea(punti, opt) {
  opt = opt || {};
  if (!punti.length)
    return `<div class="empty">${opt.vuoto || "Nessun dato ancora registrato."}</div>`;

  const W = 320, H = 172, L = 12, R = 12, T = 26, B = 42;
  const vals = punti.map((p) => p.val);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (min === max) {
    const d = Math.max(1, Math.abs(min) * 0.08);
    min -= d;
    max += d;
  }
  const n = punti.length;
  const x = (i) => (n === 1 ? W / 2 : L + (i * (W - L - R)) / (n - 1));
  const y = (v) => T + (H - T - B) * (1 - (v - min) / (max - min));
  const colore = opt.colore || "var(--accent2)";

  const linea = punti.map((p, i) => `${x(i).toFixed(1)},${y(p.val).toFixed(1)}`).join(" ");
  const area = `${x(0).toFixed(1)},${H - B} ${linea} ${x(n - 1).toFixed(1)},${H - B}`;
  const ancora = (i) => (n === 1 ? "middle" : i === 0 ? "start" : i === n - 1 ? "end" : "middle");

  const punti_svg = punti
    .map(
      (p, i) => `
    <circle cx="${x(i).toFixed(1)}" cy="${y(p.val).toFixed(1)}" r="3.8" fill="${colore}"/>
    <text class="lc-val" x="${x(i).toFixed(1)}" y="${(y(p.val) - 10).toFixed(1)}" text-anchor="${ancora(i)}">${p.testo}</text>
    ${p.sotto ? `<text class="lc-sub" x="${x(i).toFixed(1)}" y="${H - B + 16}" text-anchor="${ancora(i)}">${p.sotto}</text>` : ""}
    <text class="lc-data" x="${x(i).toFixed(1)}" y="${H - B + 31}" text-anchor="${ancora(i)}">${p.data}</text>`
    )
    .join("");

  return `<svg class="lc" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
    <line class="lc-axis" x1="0" y1="${H - B}" x2="${W}" y2="${H - B}"/>
    <polygon points="${area}" fill="${colore}" opacity=".13"/>
    <polyline points="${linea}" fill="none" stroke="${colore}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${punti_svg}
  </svg>`;
}

function dataBreve(iso) {
  const [, m, d] = iso.split("-");
  return `${+d}/${+m}`;
}

/* Corsa: per fondo e lungo conta il passo, per intervalli e ripetute
   il passo medio è falsato dai recuperi, quindi si guarda il volume */
function renderGraficoCorsa() {
  const focus = $("#chart-corsa-focus").value;
  const passoFocus = focus === "lento" || focus === "lungo";

  const ws = state.workouts
    .filter((w) => w.type === "corsa" && w.focus === focus && w.km > 0 && w.tempoSec > 0)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
    .slice(-8);

  const punti = ws.map((w) => {
    const passo = w.tempoSec / w.km;
    return passoFocus
      ? { val: passo, testo: formattaPasso(passo), sotto: formattaKm(w.km) + " km", data: dataBreve(w.date) }
      : { val: w.km, testo: formattaKm(w.km) + " km", sotto: formattaPasso(passo) + "/km", data: dataBreve(w.date) };
  });

  // per il passo l'asse resta naturale: la linea che scende = più veloce
  $("#chart-corsa").innerHTML = graficoLinea(punti, {
    colore: "var(--green)",
    vuoto: "Nessuna corsa di questo tipo con distanza e tempo registrati.",
  });
  $("#caption-corsa").textContent = !punti.length
    ? ""
    : passoFocus
    ? "Passo in min/km — più la linea scende, più sei veloce."
    : "Chilometri per seduta — sotto ogni punto il passo medio (recuperi inclusi).";
}

/* Pesi: progressione del carico sui cinque esercizi principali */
function renderGraficoPesi() {
  const lift = $("#chart-lift").value;
  const punti = [];

  state.workouts
    .filter((w) => w.type === "pesi")
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
    .forEach((w) => {
      (w.fasi.allenamento.esercizi || []).forEach((e) => {
        if (e.tipo === "circuito" || !e.kg) return;
        if (riconosciLift(e.nome) !== lift) return;
        const rip = ripetizioniDa(e.det);
        punti.push({
          val: e.kg,
          testo: formattaKg(e.kg),
          sotto: rip ? "×" + rip : "",
          data: dataBreve(w.date),
        });
      });
    });

  const ultimi = punti.slice(-8);
  $("#chart-pesi").innerHTML = graficoLinea(ultimi, {
    colore: "var(--blue)",
    vuoto: `Nessun carico registrato per ${LIFT_LABELS[lift]}.`,
  });
  $("#caption-pesi").textContent = ultimi.length
    ? "Chilogrammi sollevati — sotto ogni punto le ripetizioni della serie."
    : "Segna i carichi a fine allenamento per vedere la progressione.";
}

$("#chart-corsa-focus").addEventListener("change", renderGraficoCorsa);
$("#chart-lift").addEventListener("change", renderGraficoPesi);

/* ============================================================
   STORICO
   ============================================================ */
function renderHistory() {
  renderGraficoCorsa();
  renderGraficoPesi();
  const list = $("#history-list");
  const ws = [...state.workouts].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

  // grafico ultime 4 settimane (minuti per tipo)
  const weeks = [[], [], [], []];
  const oggi = new Date();
  ws.forEach((w) => {
    const diff = Math.floor((oggi - new Date(w.date)) / 86400000);
    const wi = Math.floor(diff / 7);
    if (wi >= 0 && wi < 4) weeks[3 - wi].push(w);
  });
  const maxMin = Math.max(60, ...weeks.map((wk) => wk.reduce((s, w) => s + w.durataTotale, 0)));
  const cls = { muaythai: "mt", pesi: "pe", corsa: "co" };
  $("#chart").innerHTML = weeks
    .map((wk, i) => {
      const perType = { muaythai: 0, pesi: 0, corsa: 0 };
      wk.forEach((w) => (perType[w.type] += w.durataTotale));
      const segs = Object.entries(perType)
        .filter(([, m]) => m > 0)
        .map(([t, m]) => `<div class="seg ${cls[t]}" style="height:${(m / maxMin) * 100}%" title="${TYPE_INFO[t].nome}: ${m} min"></div>`)
        .join("");
      const lbl = i === 3 ? "Questa" : `-${3 - i} sett`;
      return `<div class="week">${segs}<span class="wlabel">${lbl}</span></div>`;
    })
    .join("");

  if (!ws.length) {
    list.innerHTML = `<div class="empty">Nessun allenamento registrato.<br>Inizia dalla scheda ➕ Nuovo!</div>`;
    return;
  }

  list.innerHTML = ws
    .map((w) => {
      const i = TYPE_INFO[w.type];
      const focusLabel = SESSIONS[w.type][w.focus] ? SESSIONS[w.type][w.focus].label : (w.focus || "");
      const voce = (e) => {
        if (e.tipo !== "circuito")
          return `<li>• ${escapeAttr(e.nome)}${e.det ? " — " + escapeAttr(e.det) : ""}${
            e.kg ? ` <strong class="kg-tag">${formattaKg(e.kg)} kg</strong>` : ""
          }</li>`;
        const sub = e.esercizi
          .map(
            (s) =>
              `<li class="sub">‣ ${escapeAttr(s.nome)}${
                s.val ? " — " + s.val + " " + s.unit : ""
              }</li>`
          )
          .join("");
        return `<li>🔁 <strong>${escapeAttr(e.nome)}</strong> — ${e.giri} giri</li>${sub}`;
      };
      const fase = (nome, f) =>
        f.esercizi.length
          ? `<h4>${nome} (${f.min} min)</h4><ul>${f.esercizi.map(voce).join("")}</ul>`
          : "";
      return `<div class="card h-item" data-id="${w.id}">
        <div class="h-head">
          <span class="h-emoji">${i.emoji}</span>
          <div>
            <div class="h-title">${i.nome}${focusLabel ? " · " + focusLabel : ""}</div>
            <div class="h-meta">${formatData(w.date)} · ${w.durataTotale} min · RPE ${w.rpe}</div>
          </div>
          <span class="h-kcal">${w.kcal} kcal</span>
        </div>
        <div class="h-body">
          ${fase("🔥 Riscaldamento", w.fasi.riscaldamento)}
          ${fase("💪 Allenamento", w.fasi.allenamento)}
          ${fase("🧘 Defaticamento", w.fasi.defaticamento)}
          ${
            w.km && w.tempoSec
              ? `<h4>🏃 Distanza</h4><ul><li>• ${formattaKm(w.km)} km in ${Math.floor(
                  w.tempoSec / 60
                )}:${String(w.tempoSec % 60).padStart(2, "0")} — passo ${formattaPasso(
                  w.tempoSec / w.km
                )} min/km</li></ul>`
              : ""
          }
          ${w.note ? `<h4>📝 Note</h4><p>${escapeAttr(w.note)}</p>` : ""}
          <div class="h-actions">
            <button class="h-edit">✏️ Modifica</button>
            <button class="h-del">🗑 Elimina</button>
          </div>
        </div>
      </div>`;
    })
    .join("");

  $$(".h-head").forEach((h) =>
    h.addEventListener("click", () => h.parentElement.classList.toggle("open"))
  );
  $$(".h-edit").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      const id = +e.target.closest(".h-item").dataset.id;
      const w = state.workouts.find((x) => x.id === id);
      if (!w) return;
      if (
        !confirm(
          "Vuoi modificare questo allenamento?\n\nSi apre nella schermata Nuovo con tutti i dati già compilati: salvando, sostituirai quello esistente."
        )
      )
        return;
      caricaPerModifica(w);
      showView("new");
    })
  );

  $$(".h-del").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      const id = +e.target.closest(".h-item").dataset.id;
      if (confirm("Eliminare questo allenamento?")) {
        state.workouts = state.workouts.filter((w) => w.id !== id);
        save();
        renderHistory();
        toast("Allenamento eliminato");
      }
    })
  );
}

function formatData(iso) {
  const [y, m, d] = iso.split("-");
  const mesi = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
  return `${+d} ${mesi[+m - 1]} ${y}`;
}

/* ============================================================
   PROFILO
   ============================================================ */
function renderProfile() {
  $("#p-peso").value = state.profile.peso;
  $("#p-altezza").value = state.profile.altezza;
  $("#p-eta").value = state.profile.eta;
  $("#p-sesso").value = state.profile.sesso;
  $("#p-obiettivo").value = state.profile.obiettivo;
  $("#p-giorni").value = state.profile.giorni;
}

$("#btn-profilo").addEventListener("click", () => {
  const limita = (v, min, max, def) => Math.min(max, Math.max(min, +v || def));
  state.profile = {
    peso: limita($("#p-peso").value, 30, 200, 70),
    altezza: limita($("#p-altezza").value, 120, 230, 175),
    eta: limita($("#p-eta").value, 10, 99, 25),
    sesso: $("#p-sesso").value,
    obiettivo: $("#p-obiettivo").value,
    giorni: +$("#p-giorni").value,
  };
  save();
  aggiornaKcal();
  toast("Profilo salvato ✓");
  showView("home");
});

$("#btn-export").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "fightfit-backup-" + new Date().toISOString().slice(0, 10) + ".json";
  a.click();
  URL.revokeObjectURL(a.href);
});

$("#btn-import").addEventListener("click", () => $("#import-file").click());
$("#import-file").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data.profile || !Array.isArray(data.workouts)) throw new Error();
      state = data;
      save();
      renderProfile();
      renderHome();
      toast("Backup importato ✓");
    } catch {
      toast("File non valido");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
});

$("#btn-reset").addEventListener("click", () => {
  if (confirm("Cancellare TUTTI i dati? L'operazione non è reversibile.")) {
    localStorage.removeItem(STORAGE_KEY);
    state = load();
    renderProfile();
    renderHome();
    toast("Dati cancellati");
  }
});

/* ============================================================
   Avvio
   ============================================================ */
popolaFocus();
resetForm();
renderProfile();
renderHome();
countRefresh();
roundRefresh();

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
