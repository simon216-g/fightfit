/* ============================================================
   FightFit — logica applicazione
   ============================================================ */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

/* ------------------ Stato e persistenza ------------------ */
const STORAGE_KEY = "fightfit_v1";

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* dati corrotti: riparti pulito */ }
  return {
    profile: { peso: 70, obiettivo: "combattimento", giorni: 4 },
    workouts: [],
  };
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
  const progrMsg = {
    up: "📈 L'ultima seduta è stata gestibile: oggi si alza l'asticella!",
    down: "🛟 L'ultima seduta è stata molto dura: oggi si scarica un po'.",
    keep: "⚖️ Ritmo giusto: manteniamo questi volumi.",
  };
  $("#suggestion-card").innerHTML = `
    <div class="hero-tag">Allenamento consigliato oggi</div>
    <h2>${info.emoji} ${info.nome} — ${sug.label}</h2>
    <div class="hero-sub">Obiettivo: ${GOAL_LABELS[profile.obiettivo]} · ~${sug.durata + 20} min totali${
      sug.progressione ? "<br>" + progrMsg[sug.progressione] : ""
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
  row.querySelector(".ex-del").addEventListener("click", () => row.remove());
  $("#list-" + phase).appendChild(row);
}

function escapeAttr(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

$$(".add-ex").forEach((btn) =>
  btn.addEventListener("click", () => exRow(btn.dataset.phase))
);

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
  ["riscaldamento", "allenamento", "defaticamento"].forEach((phase) => {
    $("#list-" + phase).innerHTML = "";
    seduta[phase].forEach((e) => exRow(phase, e.nome, e.det));
  });
  $("#min-allenamento").value = seduta.durata;
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
});

/* Calorie in tempo reale */
["min-riscaldamento", "min-allenamento", "min-defaticamento"].forEach((id) =>
  $("#" + id).addEventListener("input", aggiornaKcal)
);

function aggiornaKcal() {
  const kcal = stimaCalorie(
    currentType,
    +$("#min-riscaldamento").value || 0,
    +$("#min-allenamento").value || 0,
    +$("#min-defaticamento").value || 0,
    state.profile.peso
  );
  $("#kcal-preview").textContent = kcal;
}

/* Salvataggio */
$("#btn-salva").addEventListener("click", () => {
  const leggi = (phase) =>
    $$("#list-" + phase + " .ex-row")
      .map((r) => ({
        nome: r.querySelector(".ex-name").value.trim(),
        det: r.querySelector(".ex-det").value.trim(),
      }))
      .filter((e) => e.nome);

  const riscMin = +$("#min-riscaldamento").value || 0;
  const allMin = +$("#min-allenamento").value || 0;
  const defMin = +$("#min-defaticamento").value || 0;
  const allenamento = leggi("allenamento");

  if (!allenamento.length) {
    toast("Aggiungi almeno un esercizio nella fase di allenamento");
    return;
  }

  const w = {
    id: Date.now(),
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
    kcal: stimaCalorie(currentType, riscMin, allMin, defMin, state.profile.peso),
  };

  state.workouts.push(w);
  save();
  resetForm();
  toast("💪 Allenamento salvato! " + w.kcal + " kcal");
  showView("home");
});

function resetForm() {
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
  return {
    rounds: Math.max(1, +$("#r-rounds").value || 5),
    work: Math.max(0.1, +$("#r-work").value || 3) * 60000,
    rest: Math.max(0, +$("#r-rest").value || 1) * 60000,
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

["r-rounds", "r-work", "r-rest"].forEach((id) =>
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
   STORICO
   ============================================================ */
function renderHistory() {
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
      const fase = (nome, f) =>
        f.esercizi.length
          ? `<h4>${nome} (${f.min} min)</h4><ul>${f.esercizi
              .map((e) => `<li>• ${escapeAttr(e.nome)}${e.det ? " — " + escapeAttr(e.det) : ""}</li>`)
              .join("")}</ul>`
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
          ${w.note ? `<h4>📝 Note</h4><p>${escapeAttr(w.note)}</p>` : ""}
          <button class="h-del">🗑 Elimina allenamento</button>
        </div>
      </div>`;
    })
    .join("");

  $$(".h-head").forEach((h) =>
    h.addEventListener("click", () => h.parentElement.classList.toggle("open"))
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
  $("#p-obiettivo").value = state.profile.obiettivo;
  $("#p-giorni").value = state.profile.giorni;
}

$("#btn-profilo").addEventListener("click", () => {
  state.profile = {
    peso: Math.min(200, Math.max(30, +$("#p-peso").value || 70)),
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
