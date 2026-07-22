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

/* MET specifici per focus: una seduta tecnica e una di condizionamento
   non consumano allo stesso modo (valori dal Compendium of Physical Activities) */
const FOCUS_MET = {
  muaythai: { tecnica: 8.5, sacco: 10.5, condizionamento: 11.0 },
  pesi: { spinta: 5.5, trazione: 5.5, gambe: 6.0, esplosivita: 6.5, circuito: 8.0 },
  corsa: { lento: 8.3, lungo: 9.0, intervalli: 11.5, ripetute: 12.0 },
};

/* Focus ad alta intensità: generano consumo extra post-allenamento (EPOC) */
const FOCUS_INTENSI = ["intervalli", "ripetute", "condizionamento", "circuito", "esplosivita"];

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

/* Giorni trascorsi da una data ISO a oggi */
function giorniDa(iso) {
  const oggi = new Date(new Date().toISOString().slice(0, 10));
  return Math.max(0, Math.round((oggi - new Date(iso)) / 86400000));
}

function piuRecenti(workouts) {
  return [...workouts].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
}

/* Ultimo carico usato per un esercizio (in kg), cercando in tutto lo storico */
function ultimoCarico(workouts, nomeEsercizio) {
  const nome = nomeEsercizio.toLowerCase();
  for (const w of piuRecenti(workouts)) {
    const es = w.fasi?.allenamento?.esercizi || [];
    const hit = es.find((e) => e.nome && e.nome.toLowerCase() === nome && e.kg > 0);
    if (hit) return hit.kg;
  }
  return null;
}

/* ------------------------------------------------------------
   Contesto della prossima seduta: incrocia la fatica percepita
   nell'ultima seduta DELLO STESSO FOCUS con i giorni di recupero
   realmente trascorsi dall'ultimo allenamento (di qualsiasi tipo).
   ------------------------------------------------------------ */
function contestoAllenamento(workouts, type, focus) {
  const recenti = piuRecenti(workouts);
  const ultimoFocus = recenti.find((w) => w.type === type && w.focus === focus);
  const ultimoTipo = recenti.find((w) => w.type === type);
  const riferimento = ultimoFocus || ultimoTipo || null;
  const ultimo = recenti[0] || null;

  const rpe = riferimento ? riferimento.rpe : null;
  const stessoFocus = !!ultimoFocus;
  const giorni = ultimo ? giorniDa(ultimo.date) : null;

  // punto di partenza: quanto è stata dura l'ultima seduta simile
  let dir = rpe == null ? 0 : rpe <= 6 ? 1 : rpe >= 9 ? -1 : 0;
  let motivo = rpe == null ? "nuovo" : dir > 0 ? "progressione" : dir < 0 ? "scarico" : "mantieni";

  // ...corretto da quanto recupero hai avuto davvero
  if (giorni != null) {
    if (giorni <= 1 && ultimo.rpe >= 8) {
      dir = Math.min(dir, -1);
      motivo = "recupero";
    } else if (giorni >= 14) {
      dir = Math.min(dir, -1);
      motivo = "rientro";
    } else if (giorni >= 8) {
      dir = Math.min(dir, 0);
      motivo = "pausa";
    } else if (giorni >= 4 && dir === 0 && rpe != null && rpe <= 7) {
      dir = 1;
      motivo = "riposato";
    }
  }

  return { rpe, dir, motivo, giorni, stessoFocus };
}

/* Messaggi mostrati in Home sotto il consiglio del giorno */
function messaggioContesto(c) {
  switch (c.motivo) {
    case "progressione":
      return `📈 L'ultima seduta simile era gestibile (RPE ${c.rpe}): oggi si alza l'asticella.`;
    case "scarico":
      return `🛟 L'ultima seduta simile era durissima (RPE ${c.rpe}): oggi si scarica.`;
    case "recupero":
      return `😮‍💨 Ti sei allenato ${c.giorni === 0 ? "oggi" : "ieri"} e a fondo: volume ridotto.`;
    case "rientro":
      return `🌱 Sono passati ${c.giorni} giorni: si rientra in gradualità.`;
    case "pausa":
      return `⏸️ Dopo ${c.giorni} giorni di stop, oggi si mantiene senza forzare.`;
    case "riposato":
      return `⚡ ${c.giorni} giorni di recupero alle spalle: si può spingere.`;
    case "mantieni":
      return `⚖️ Ritmo giusto: manteniamo questi volumi.`;
    default:
      return null;
  }
}

/* Adatta i dettagli di un esercizio alla direzione decisa dal contesto:
   +1 → più volume · 0 → invariato · −1 → scarico
   Sui pesi usa il carico realmente registrato l'ultima volta, se c'è. */
function adattaEsercizio(ex, ctx, workouts) {
  let det = ex.det;
  const dir = ctx.dir;

  if (ex.prog === "carico") {
    const kg = ultimoCarico(workouts || [], ex.nome);
    if (kg) {
      const nuovo = dir > 0 ? kg + 2.5 : dir < 0 ? kg * 0.9 : kg;
      const arrot = Math.round(nuovo * 2) / 2;
      return {
        nome: ex.nome,
        det: `${det} — ${formattaKg(arrot)} kg`,
        kgSuggerito: arrot,
      };
    }
    if (dir === 0) return { nome: ex.nome, det };
    return {
      nome: ex.nome,
      det: det + (dir > 0 ? " (aumenta il carico di 2,5 kg)" : " (riduci il carico del 10%)"),
    };
  }

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
    case "durata":
      det = bump(det, /(\d+)\s*min/, dir * 5, 10);
      break;
  }
  return { nome: ex.nome, det };
}

function formattaKg(kg) {
  return String(kg).replace(".", ",");
}

/* Genera una seduta completa (3 fasi) per tipo+focus, adattata ai progressi */
function generaSeduta(type, focus, workouts) {
  const sess = SESSIONS[type][focus];
  const ctx = contestoAllenamento(workouts, type, focus);
  return {
    type,
    focus,
    label: sess.label,
    riscaldamento: WARMUPS[type].map((e) => ({ nome: e.nome, det: e.det })),
    allenamento: sess.esercizi.map((e) => adattaEsercizio(e, ctx, workouts)),
    defaticamento: COOLDOWNS[type].map((e) => ({ nome: e.nome, det: e.det })),
    durata: sess.durata,
    contesto: ctx,
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

/* ============================================================
   Calorie
   ------------------------------------------------------------
   Metabolismo basale individuale (Mifflin-St Jeor) come base,
   MET specifico del focus scalato sull'RPE realmente percepito,
   consumo NETTO (tolto il basale) e supplemento EPOC.
   ============================================================ */

/* kcal bruciate a riposo in un minuto, specifiche della persona */
function rmrPerMinuto(p) {
  const peso = p.peso || 70;
  const altezza = p.altezza || 175;
  const eta = p.eta || 25;
  const base = 10 * peso + 6.25 * altezza - 5 * eta + (p.sesso === "F" ? -161 : 5);
  return base / 1440;
}

/* MET della seduta corretto con la fatica percepita:
   ±7,5% per ogni punto RPE sopra/sotto il riferimento 7 */
function metEffettivo(type, focus, rpe) {
  const tab = FOCUS_MET[type] || {};
  const base = tab[focus] || TYPE_INFO[type].met;
  const fattore = Math.min(1.35, Math.max(0.6, 1 + ((rpe || 7) - 7) * 0.075));
  return base * fattore;
}

function stimaCalorie(type, focus, rpe, minRisc, minAll, minDef, profile) {
  const rmr = rmrPerMinuto(profile);
  const met = metEffettivo(type, focus, rpe);
  // consumo netto: (MET - 1) perché 1 MET è quello che si spende comunque a riposo
  const kcal =
    (MET_RISCALDAMENTO - 1) * rmr * (minRisc || 0) +
    (met - 1) * rmr * (minAll || 0) +
    (MET_DEFATICAMENTO - 1) * rmr * (minDef || 0);

  const intensa = (rpe || 7) >= 8 || FOCUS_INTENSI.includes(focus);
  const epoc = intensa ? 1 + Math.min(0.09, 0.02 + Math.max(0, (rpe || 7) - 6) * 0.02) : 1;

  return Math.max(0, Math.round(kcal * epoc));
}
