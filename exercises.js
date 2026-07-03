/* ============================================================
   FightFit — Database esercizi e motore di suggerimento
   ============================================================ */

const TYPE_INFO = {
  muaythai: { nome: "Muay Thai", emoji: "🥊", met: 10.3 },
  pesi:     { nome: "Sala Pesi", emoji: "🏋️", met: 5.0 },
  corsa:    { nome: "Corsa",     emoji: "🏃", met: 9.0 },
};

const MET_RISCALDAMENTO = 4.0;
const MET_DEFATICAMENTO = 2.5;

/* MET corsa in base al ritmo (min/km) */
function metCorsa(minPerKm) {
  if (!minPerKm || minPerKm <= 0) return 9.0;
  if (minPerKm <= 3.8) return 14.5;
  if (minPerKm <= 4.5) return 12.5;
  if (minPerKm <= 5.5) return 10.5;
  if (minPerKm <= 6.5) return 9.0;
  if (minPerKm <= 7.5) return 8.0;
  return 6.5;
}

/* ------------------ Riscaldamenti ------------------ */
const WARMUPS = {
  muaythai: [
    { nome: "Corda", det: "3 round × 3 min" },
    { nome: "Mobilità anche e spalle", det: "5 min" },
    { nome: "Shadow boxing leggero", det: "2 round × 2 min" },
  ],
  pesi: [
    { nome: "Cyclette o tapis roulant", det: "5-8 min ritmo blando" },
    { nome: "Mobilità articolare", det: "5 min" },
    { nome: "Serie di avvicinamento", det: "2 serie a carico leggero" },
  ],
  corsa: [
    { nome: "Camminata veloce → corsetta", det: "5 min progressivi" },
    { nome: "Andature (skip, calciata, affondi)", det: "2 × 20 m ciascuna" },
    { nome: "Allunghi", det: "3 × 60 m" },
  ],
};

/* ------------------ Defaticamento ------------------ */
const COOLDOWNS = {
  muaythai: [
    { nome: "Shadow lento a respirazione controllata", det: "3 min" },
    { nome: "Stretching flessori dell'anca e quadricipiti", det: "2 × 30 sec per lato" },
    { nome: "Stretching spalle e collo", det: "2 × 30 sec" },
  ],
  pesi: [
    { nome: "Camminata blanda", det: "5 min" },
    { nome: "Stretching muscoli allenati", det: "2 × 30 sec per gruppo" },
    { nome: "Foam roller (se disponibile)", det: "5 min" },
  ],
  corsa: [
    { nome: "Corsetta blanda → camminata", det: "5 min" },
    { nome: "Stretching polpacci e ischiocrurali", det: "2 × 30 sec per lato" },
    { nome: "Stretching quadricipiti e glutei", det: "2 × 30 sec per lato" },
  ],
};

/* ------------------ Sedute principali ------------------
   Ogni focus ha: label, durata consigliata (min) e lista esercizi.
   "prog" indica come far progredire l'esercizio quando l'utente migliora. */
const SESSIONS = {
  muaythai: {
    tecnica: {
      label: "Tecnica",
      durata: 45,
      esercizi: [
        { nome: "Shadow boxing tecnico", det: "4 round × 3 min", prog: "round" },
        { nome: "Colpitelli / pao con compagno", det: "4 round × 3 min", prog: "round" },
        { nome: "Tecnica di gamba: teep e low kick", det: "3 round × 2 min per gamba", prog: "round" },
        { nome: "Clinch e ginocchiate al sacco", det: "3 round × 2 min", prog: "round" },
      ],
    },
    sacco: {
      label: "Sacco e potenza",
      durata: 40,
      esercizi: [
        { nome: "Sacco: combinazioni libere", det: "5 round × 3 min", prog: "round" },
        { nome: "Sacco: solo calci in potenza", det: "3 round × 2 min", prog: "round" },
        { nome: "Sprint di pugni sul sacco", det: "6 × 20 sec (10 sec pausa)", prog: "serie" },
        { nome: "Ginocchiate in clinch al sacco", det: "3 × 30 colpi", prog: "rip" },
      ],
    },
    condizionamento: {
      label: "Condizionamento fighter",
      durata: 35,
      esercizi: [
        { nome: "Circuito: burpees", det: "4 × 12", prog: "rip" },
        { nome: "Squat jump", det: "4 × 15", prog: "rip" },
        { nome: "Flessioni esplosive", det: "4 × 10", prog: "rip" },
        { nome: "Addominali completi (plank + crunch + russian twist)", det: "3 giri × 40 sec ciascuno", prog: "serie" },
        { nome: "Corda alta intensità", det: "5 × 1 min (30 sec pausa)", prog: "serie" },
      ],
    },
  },
  pesi: {
    spinta: {
      label: "Spinta (petto/spalle/tricipiti)",
      durata: 50,
      esercizi: [
        { nome: "Panca piana", det: "4 × 8", prog: "carico" },
        { nome: "Lento avanti manubri", det: "3 × 10", prog: "carico" },
        { nome: "Panca inclinata manubri", det: "3 × 10", prog: "carico" },
        { nome: "Dip o pushdown tricipiti", det: "3 × 12", prog: "rip" },
        { nome: "Alzate laterali", det: "3 × 15", prog: "rip" },
      ],
    },
    trazione: {
      label: "Trazione (schiena/bicipiti)",
      durata: 50,
      esercizi: [
        { nome: "Trazioni o lat machine", det: "4 × 8", prog: "carico" },
        { nome: "Rematore bilanciere", det: "4 × 10", prog: "carico" },
        { nome: "Pulley basso", det: "3 × 12", prog: "carico" },
        { nome: "Curl bilanciere", det: "3 × 12", prog: "rip" },
        { nome: "Face pull", det: "3 × 15", prog: "rip" },
      ],
    },
    gambe: {
      label: "Gambe e core",
      durata: 50,
      esercizi: [
        { nome: "Squat", det: "4 × 8", prog: "carico" },
        { nome: "Stacco rumeno", det: "3 × 10", prog: "carico" },
        { nome: "Affondi con manubri", det: "3 × 10 per gamba", prog: "carico" },
        { nome: "Calf in piedi", det: "4 × 15", prog: "rip" },
        { nome: "Plank", det: "3 × 45 sec", prog: "serie" },
      ],
    },
    esplosivita: {
      label: "Forza esplosiva (per il combattimento)",
      durata: 45,
      esercizi: [
        { nome: "Squat jump con manubri leggeri", det: "4 × 6", prog: "carico" },
        { nome: "Panca con spinta esplosiva", det: "4 × 5 (carico medio)", prog: "carico" },
        { nome: "Lanci palla medica", det: "4 × 8", prog: "rip" },
        { nome: "Trazioni esplosive", det: "4 × 5", prog: "rip" },
        { nome: "Rotazioni al cavo (core rotazionale)", det: "3 × 10 per lato", prog: "carico" },
      ],
    },
    circuito: {
      label: "Circuito full body (brucia grassi)",
      durata: 40,
      esercizi: [
        { nome: "Goblet squat", det: "3 giri × 15", prog: "rip" },
        { nome: "Rematore manubrio", det: "3 giri × 12 per lato", prog: "rip" },
        { nome: "Flessioni", det: "3 giri × 12", prog: "rip" },
        { nome: "Kettlebell swing", det: "3 giri × 15", prog: "rip" },
        { nome: "Mountain climber", det: "3 giri × 40 sec", prog: "serie" },
      ],
    },
  },
  corsa: {
    lento: {
      label: "Corsa lenta (fondo)",
      durata: 35,
      esercizi: [
        { nome: "Corsa continua a ritmo facile", det: "35 min — riesci a parlare mentre corri", prog: "durata" },
      ],
    },
    intervalli: {
      label: "Intervalli / HIIT",
      durata: 30,
      esercizi: [
        { nome: "Ripetute veloci", det: "8 × 1 min forte + 1 min piano", prog: "serie" },
        { nome: "Ultimo km progressivo", det: "aumenta il ritmo gradualmente", prog: "durata" },
      ],
    },
    lungo: {
      label: "Lungo (resistenza)",
      durata: 55,
      esercizi: [
        { nome: "Corsa continua ritmo medio-facile", det: "55 min costanti", prog: "durata" },
      ],
    },
    ripetute: {
      label: "Ripetute in salita / potenza",
      durata: 30,
      esercizi: [
        { nome: "Ripetute in salita", det: "8 × 30 sec forte, recupero in discesa", prog: "serie" },
        { nome: "Corsa blanda tra le serie", det: "10 min totali", prog: "durata" },
      ],
    },
  },
};

/* ------------------ Piani settimanali per obiettivo ------------------
   Ordine = priorità. Il motore propone la voce meno coperta negli ultimi 7 giorni. */
const GOAL_PLANS = {
  combattimento: [
    { type: "muaythai", focus: "tecnica" },
    { type: "muaythai", focus: "sacco" },
    { type: "pesi", focus: "esplosivita" },
    { type: "corsa", focus: "intervalli" },
    { type: "muaythai", focus: "condizionamento" },
    { type: "corsa", focus: "lento" },
  ],
  dimagrimento: [
    { type: "corsa", focus: "intervalli" },
    { type: "pesi", focus: "circuito" },
    { type: "muaythai", focus: "sacco" },
    { type: "corsa", focus: "lento" },
    { type: "muaythai", focus: "condizionamento" },
    { type: "pesi", focus: "circuito" },
  ],
  massa: [
    { type: "pesi", focus: "spinta" },
    { type: "pesi", focus: "trazione" },
    { type: "pesi", focus: "gambe" },
    { type: "corsa", focus: "lento" },
    { type: "pesi", focus: "spinta" },
    { type: "muaythai", focus: "tecnica" },
  ],
  resistenza: [
    { type: "corsa", focus: "lungo" },
    { type: "corsa", focus: "intervalli" },
    { type: "pesi", focus: "circuito" },
    { type: "muaythai", focus: "condizionamento" },
    { type: "corsa", focus: "ripetute" },
    { type: "corsa", focus: "lento" },
  ],
  benessere: [
    { type: "corsa", focus: "lento" },
    { type: "pesi", focus: "circuito" },
    { type: "muaythai", focus: "tecnica" },
    { type: "corsa", focus: "lento" },
    { type: "pesi", focus: "gambe" },
    { type: "muaythai", focus: "sacco" },
  ],
};

const GOAL_LABELS = {
  combattimento: "Migliorare nella Muay Thai",
  dimagrimento: "Dimagrimento",
  massa: "Massa e forza",
  resistenza: "Resistenza",
  benessere: "Benessere generale",
};

/* ============================================================
   Motore di suggerimento
   ============================================================ */

/* Adatta i dettagli di un esercizio in base all'ultimo RPE registrato
   per lo stesso tipo di allenamento:
   RPE ≤ 6  → progressione (+1 round / +2 rip / +5% durata / suggerisci +carico)
   RPE 7-8  → mantieni
   RPE ≥ 9  → scarico (-1 round / -2 rip / -10% durata) */
function adattaEsercizio(ex, lastRpe) {
  let det = ex.det;
  let nota = "";
  const dir = lastRpe == null ? 0 : lastRpe <= 6 ? 1 : lastRpe >= 9 ? -1 : 0;
  if (dir === 0) return { nome: ex.nome, det };

  const bump = (str, re, delta, min) =>
    str.replace(re, (m, n) => m.replace(n, Math.max(min, parseInt(n) + delta)));

  switch (ex.prog) {
    case "round":
      det = bump(det, /(\d+)\s*round/i, dir, 1);
      break;
    case "serie":
      det = bump(det, /(\d+)\s*[×x]/, dir, 1);
      break;
    case "rip":
      det = bump(det, /[×x]\s*(\d+)/, dir * 2, 4);
      break;
    case "carico":
      nota = dir > 0 ? " (aumenta il carico di 2,5 kg)" : " (riduci il carico del 10%)";
      break;
    case "durata":
      det = bump(det, /(\d+)\s*min/, dir * 5, 10);
      break;
  }
  return { nome: ex.nome, det: det + nota };
}

/* Ultimo RPE per un tipo di allenamento */
function lastRpeFor(workouts, type) {
  const w = [...workouts]
    .filter((x) => x.type === type)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  return w ? w.rpe : null;
}

/* Genera una seduta completa (3 fasi) per tipo+focus, adattata ai progressi */
function generaSeduta(type, focus, workouts) {
  const sess = SESSIONS[type][focus];
  const rpe = lastRpeFor(workouts, type);
  return {
    type,
    focus,
    label: sess.label,
    riscaldamento: WARMUPS[type].map((e) => ({ nome: e.nome, det: e.det })),
    allenamento: sess.esercizi.map((e) => adattaEsercizio(e, rpe)),
    defaticamento: COOLDOWNS[type].map((e) => ({ nome: e.nome, det: e.det })),
    durata: sess.durata,
    progressione:
      rpe == null ? null : rpe <= 6 ? "up" : rpe >= 9 ? "down" : "keep",
  };
}

/* Piano settimanale in base all'obiettivo e ai giorni disponibili,
   con spunta su ciò che è già stato fatto negli ultimi 7 giorni */
function pianoSettimanale(profile, workouts) {
  const plan = GOAL_PLANS[profile.obiettivo].slice(0, profile.giorni);
  const settimana = ultimi7Giorni(workouts);
  const usati = new Set();
  return plan.map((slot) => {
    const match = settimana.find(
      (w, i) => !usati.has(i) && w.type === slot.type && (usati.add(i), true)
    );
    return { ...slot, label: SESSIONS[slot.type][slot.focus].label, done: !!match };
  });
}

function ultimi7Giorni(workouts) {
  const limite = new Date();
  limite.setDate(limite.getDate() - 6);
  const iso = limite.toISOString().slice(0, 10);
  return workouts.filter((w) => w.date >= iso);
}

/* Prossimo allenamento consigliato: il primo slot del piano non ancora coperto */
function prossimoConsigliato(profile, workouts) {
  const plan = pianoSettimanale(profile, workouts);
  const slot = plan.find((s) => !s.done) || plan[0];
  return generaSeduta(slot.type, slot.focus, workouts);
}

/* ------------------ Calorie ------------------
   kcal = MET × peso(kg) × ore */
function stimaCalorie(type, minRisc, minAll, minDef, peso) {
  const met = TYPE_INFO[type].met;
  const kcal =
    MET_RISCALDAMENTO * peso * (minRisc / 60) +
    met * peso * (minAll / 60) +
    MET_DEFATICAMENTO * peso * (minDef / 60);
  return Math.round(kcal);
}
