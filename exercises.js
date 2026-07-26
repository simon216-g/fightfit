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
  muaythai: { completo: 10.0 },
  pesi: { spinta: 5.5, trazione: 5.5, gambe: 6.0 },
  corsa: { lento: 8.3, lungo: 9.0, intervalli: 11.5, ripetute: 12.0 },
};

/* Lavoro al sacco/pad: fase a sé, sempre intensa */
const MET_SACCO = 10.5;

/* Focus ad alta intensità: generano consumo extra post-allenamento (EPOC) */
const FOCUS_INTENSI = ["intervalli", "ripetute", "completo"];

/* MET della corsa in base al passo reale (minuti per km):
   correre a 4:30/km costa molto più che a 6:30/km, a parità di tempo */
function metDaPasso(minPerKm) {
  if (!minPerKm || minPerKm <= 0) return null;
  if (minPerKm <= 3.5) return 16.0;
  if (minPerKm <= 4.0) return 14.5;
  if (minPerKm <= 4.5) return 13.0;
  if (minPerKm <= 5.0) return 11.8;
  if (minPerKm <= 5.5) return 10.8;
  if (minPerKm <= 6.0) return 9.8;
  if (minPerKm <= 6.5) return 9.0;
  if (minPerKm <= 7.0) return 8.3;
  if (minPerKm <= 7.5) return 7.5;
  if (minPerKm <= 8.5) return 6.8;
  return 6.0;
}

/* ------------------ Esercizi principali tracciati ------------------
   Riconosce le varianti di nome così che il grafico raccolga tutto. */
const LIFT_MATCH = [
  { id: "panca", re: /panca\s*piana|bench\s*press/i },
  { id: "military", re: /military|lento\s*avanti|shoulder\s*press/i },
  { id: "lat", re: /lat\s*machine|latmachine|trazion|pulldown|pull[-\s]?up/i },
  { id: "stacco", re: /stacco|deadlift/i },
  { id: "squat", re: /squat/i },
];

const LIFT_LABELS = {
  panca: "Panca piana",
  squat: "Squat",
  military: "Military press",
  lat: "Lat machine / trazioni",
  stacco: "Stacco",
};

function riconosciLift(nome) {
  if (!nome) return null;
  // varianti che non rappresentano la forza massimale del fondamentale
  if (/jump|salto|balzo|tenuta|corpo\s*libero|spinta|kettle/i.test(nome)) return null;
  const hit = LIFT_MATCH.find((l) => l.re.test(nome));
  return hit ? hit.id : null;
}

/* Ripetizioni indicate nel dettaglio ("4 × 8" → 8) */
function ripetizioniDa(det) {
  const m = String(det || "").match(/[×x]\s*(\d+)/);
  return m ? +m[1] : null;
}

/* ------------------ Formattazione ------------------ */
function formattaPasso(secPerKm) {
  if (!secPerKm || !isFinite(secPerKm)) return "—";
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return s === 60 ? `${m + 1}:00` : `${m}:${String(s).padStart(2, "0")}`;
}

function formattaKm(km) {
  return String(Math.round(km * 100) / 100).replace(".", ",");
}

/* ------------------ Riscaldamenti ------------------ */
const WARMUPS = {
  muaythai: [
    { nome: "Mobilità articolare", det: "8 min — anche, spalle, collo" },
    { nome: "Corda", det: "3 round × 3 min" },
    { nome: "Shadow boxing", det: "2 round × 2 min" },
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

/* ------------------ Sedute ------------------
   Muay Thai e sala pesi pescano gli esercizi dal catalogo:
   "gruppi" dice quanti esercizi prendere da ogni gruppo muscolare.
   La corsa mantiene sedute a schema fisso. */
const SESSIONS = {
  muaythai: {
    completo: {
      label: "Allenamento completo",
      minuti: { riscaldamento: 20, allenamento: 20, sacco: 20, defaticamento: 10 },
      // la parte centrale prende un esercizio da ciascun gruppo
      gruppi: [["pettoSpalle", 1], ["addome", 1], ["gambe", 1], ["completo", 1]],
      // in versione a esercizi separati se ne aggiunge uno "completo" in più
      extraSeparati: [["completo", 1]],
    },
  },
  pesi: {
    spinta: {
      label: "Petto / spalle / tricipiti",
      minuti: { riscaldamento: 10, allenamento: 50, defaticamento: 10 },
      gruppi: [["petto", 2], ["spalle", 2], ["tricipiti", 1], ["addome", 1]],
    },
    trazione: {
      label: "Schiena / bicipiti",
      minuti: { riscaldamento: 10, allenamento: 50, defaticamento: 10 },
      gruppi: [["schiena", 3], ["bicipiti", 2], ["addome", 1]],
    },
    gambe: {
      label: "Gambe",
      minuti: { riscaldamento: 10, allenamento: 50, defaticamento: 10 },
      gruppi: [["gambe", 5], ["addome", 1]],
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
    { type: "muaythai", focus: "completo" },
    { type: "pesi", focus: "spinta" },
    { type: "muaythai", focus: "completo" },
    { type: "corsa", focus: "intervalli" },
    { type: "pesi", focus: "gambe" },
    { type: "corsa", focus: "lento" },
  ],
  dimagrimento: [
    { type: "corsa", focus: "intervalli" },
    { type: "muaythai", focus: "completo" },
    { type: "pesi", focus: "gambe" },
    { type: "corsa", focus: "lento" },
    { type: "muaythai", focus: "completo" },
    { type: "pesi", focus: "spinta" },
  ],
  massa: [
    { type: "pesi", focus: "spinta" },
    { type: "pesi", focus: "trazione" },
    { type: "pesi", focus: "gambe" },
    { type: "muaythai", focus: "completo" },
    { type: "corsa", focus: "lento" },
    { type: "muaythai", focus: "completo" },
  ],
  resistenza: [
    { type: "corsa", focus: "lungo" },
    { type: "corsa", focus: "intervalli" },
    { type: "muaythai", focus: "completo" },
    { type: "pesi", focus: "gambe" },
    { type: "corsa", focus: "ripetute" },
    { type: "muaythai", focus: "completo" },
  ],
  benessere: [
    { type: "corsa", focus: "lento" },
    { type: "pesi", focus: "spinta" },
    { type: "muaythai", focus: "completo" },
    { type: "corsa", focus: "lento" },
    { type: "pesi", focus: "gambe" },
    { type: "muaythai", focus: "completo" },
  ],
};

/* Sedute non più proposte, ma presenti negli allenamenti già salvati */
const FOCUS_STORICI = {
  tecnica: "Tecnica",
  sacco: "Sacco e potenza",
  condizionamento: "Condizionamento",
  esplosivita: "Forza esplosiva",
  circuito: "Circuito full body",
};

function etichettaFocus(type, focus) {
  const s = SESSIONS[type] && SESSIONS[type][focus];
  return s ? s.label : FOCUS_STORICI[focus] || focus || "";
}

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

/* ============================================================
   MEMORIA DEGLI ESERCIZI
   Scorre gli allenamenti salvati e ricostruisce due informazioni:
   quando hai fatto ogni esercizio, e quanto sono carichi i muscoli.
   ============================================================ */

/* Tutti gli esercizi di un allenamento, circuiti inclusi (appiattiti) */
function eserciziDi(w) {
  const out = [];
  Object.values(w.fasi || {}).forEach((fase) =>
    (fase.esercizi || []).forEach((e) => {
      if (e.tipo === "circuito") (e.esercizi || []).forEach((s) => out.push(s));
      else out.push(e);
    })
  );
  return out;
}

/* Giorni trascorsi dall'ultima volta che hai fatto ogni esercizio.
   Chiave = nome in minuscolo, valore = giorni (0 = oggi). */
function ultimoUsoEsercizi(workouts) {
  const mappa = {};
  workouts.forEach((w) => {
    const g = giorniDa(w.date);
    eserciziDi(w).forEach((e) => {
      if (!e.nome) return;
      const k = e.nome.toLowerCase();
      if (mappa[k] == null || g < mappa[k]) mappa[k] = g;
    });
  });
  return mappa;
}

/* Quanto peso dare a un allenamento in base a quanti giorni fa è stato:
   oggi e ieri contano pieno, poi l'effetto svanisce. */
function pesoRecenza(giorni) {
  if (giorni <= 1) return 1;
  if (giorni === 2) return 0.6;
  if (giorni === 3) return 0.3;
  return 0;
}

/* Carico accumulato per muscolo negli ultimi giorni.
   Il muscolo principale di un esercizio pesa il doppio dei secondari. */
function caricoMuscolare(workouts) {
  const fatica = {};
  workouts.forEach((w) => {
    const peso = pesoRecenza(giorniDa(w.date));
    if (!peso) return;
    // una seduta percepita dura affatica di più
    const intensita = peso * (0.8 + ((w.rpe || 7) / 10) * 0.4);
    eserciziDi(w).forEach((e) => {
      const muscoli = muscoliDi(e.nome);
      if (!muscoli) return;
      muscoli.forEach((m, i) => {
        fatica[m] = (fatica[m] || 0) + intensita * (i === 0 ? 1 : 0.5);
      });
    });
  });
  return fatica;
}

const SOGLIA_FATICA = 1.6; // sopra questa soglia il muscolo è considerato carico

/* ------------------------------------------------------------
   Scelta degli esercizi: ogni candidato riceve un punteggio.
   Conta se è un fondamentale, da quanto non lo fai, e quanto
   sono affaticati i muscoli che coinvolge.
   ------------------------------------------------------------ */
function punteggioEsercizio(ex, ctx) {
  let p = 0;
  if (ex.base) p += 40;
  if (ex.exp && ctx.obiettivo === "combattimento") p += 12;

  // varietà: più tempo è passato, più sale il punteggio
  const giorni = ctx.ultimoUso[ex.nome.toLowerCase()];
  p += giorni == null ? 30 : Math.min(30, giorni * 5);

  // penalità per muscoli già caricati di recente
  let pen = 0;
  ex.muscoli.forEach((m, i) => {
    pen += (ctx.fatica[m] || 0) * (i === 0 ? 1 : 0.5);
  });
  p -= Math.min(45, pen * 12);

  p += Math.random() * 8; // pizzico di casualità: due generazioni non identiche
  return p;
}

/* Un esercizio "pesa" su un muscolo già affaticato? */
function toccaMuscoliStanchi(ex, fatica) {
  return ex.muscoli.some((m, i) => i === 0 && (fatica[m] || 0) >= SOGLIA_FATICA);
}

/* Sceglie N esercizi da un gruppo del catalogo.
   Regola anti-sovrapposizione: al massimo MAX_STANCHI esercizi
   della seduta possono insistere su muscoli già affaticati. */
const MAX_STANCHI = 1;

function scegliDaGruppo(ambito, gruppo, quanti, ctx) {
  const lista = gruppoCatalogo(ambito, gruppo).filter(
    (e) => !ctx.usati.has(e.nome.toLowerCase())
  );
  if (!lista.length) return [];

  // i fondamentali entrano sempre
  const scelti = lista.filter((e) => e.base).slice(0, quanti);
  scelti.forEach((e) => ctx.usati.add(e.nome.toLowerCase()));

  const restanti = lista
    .filter((e) => !ctx.usati.has(e.nome.toLowerCase()))
    .map((e) => ({ e, p: punteggioEsercizio(e, ctx) }))
    .sort((a, b) => b.p - a.p);

  // primo passaggio: rispetta il limite sui muscoli stanchi
  for (const { e } of restanti) {
    if (scelti.length >= quanti) break;
    if (toccaMuscoliStanchi(e, ctx.fatica) && ctx.stanchiUsati >= MAX_STANCHI) continue;
    scelti.push(e);
    ctx.usati.add(e.nome.toLowerCase());
    if (toccaMuscoliStanchi(e, ctx.fatica)) ctx.stanchiUsati++;
  }
  // secondo passaggio: se non bastano, si allenta il vincolo
  for (const { e } of restanti) {
    if (scelti.length >= quanti) break;
    if (ctx.usati.has(e.nome.toLowerCase())) continue;
    scelti.push(e);
    ctx.usati.add(e.nome.toLowerCase());
  }
  return scelti;
}

/* Contesto di selezione condiviso da tutti i gruppi della seduta */
function contestoSelezione(workouts, profile) {
  return {
    ultimoUso: ultimoUsoEsercizi(workouts),
    fatica: caricoMuscolare(workouts),
    obiettivo: profile ? profile.obiettivo : null,
    usati: new Set(),
    stanchiUsati: 0,
  };
}

/* ------------------ Combinazioni e schemi al sacco ------------------ */

/* Sceglie combinazioni evitando quelle usate nelle ultime sedute */
function scegliCombinazioni(workouts, quanteSacco, quantePad) {
  const recenti = new Set();
  piuRecenti(workouts)
    .filter((w) => w.type === "muaythai")
    .slice(0, 3)
    .forEach((w) =>
      (w.fasi?.sacco?.esercizi || []).forEach((e) => recenti.add((e.det || "").trim()))
    );

  const pesca = (lista, quante) => {
    const fresche = lista.filter((c) => !recenti.has(c));
    const pool = fresche.length >= quante ? fresche : lista;
    const copia = [...pool];
    const out = [];
    while (out.length < quante && copia.length)
      out.push(copia.splice(Math.floor(Math.random() * copia.length), 1)[0]);
    return out;
  };

  return {
    sacco: pesca(COMBINAZIONI.sacco, quanteSacco),
    pad: pesca(COMBINAZIONI.pad, quantePad),
  };
}

/* Ruota gli schemi: propone quello meno usato di recente */
function scegliSchemaSacco(workouts) {
  const usati = piuRecenti(workouts)
    .filter((w) => w.type === "muaythai" && w.schemaId)
    .slice(0, 4)
    .map((w) => w.schemaId);
  const liberi = SCHEMI_SACCO.filter((s) => !usati.includes(s.id));
  const pool = liberi.length ? liberi : SCHEMI_SACCO;
  return pool[Math.floor(Math.random() * pool.length)];
}

/* ------------------ Generazione della seduta ------------------ */

/* Il volume del circuito/serie segue la direzione del contesto */
function adattaDaCatalogo(ex, ctx, workouts) {
  const prog = ex.carico ? "carico" : /sec|min/.test(ex.det) ? "serie" : "rip";
  return adattaEsercizio({ nome: ex.nome, det: ex.det, prog }, ctx, workouts);
}

function generaSeduta(type, focus, workouts, profile) {
  workouts = workouts || [];
  const sess = SESSIONS[type][focus];
  const ctx = contestoAllenamento(workouts, type, focus);

  // ---- Corsa: sedute a schema fisso ----
  if (type === "corsa") {
    return {
      type,
      focus,
      label: sess.label,
      riscaldamento: WARMUPS[type].map((e) => ({ nome: e.nome, det: e.det })),
      allenamento: sess.esercizi.map((e) => adattaEsercizio(e, ctx, workouts)),
      defaticamento: COOLDOWNS[type].map((e) => ({ nome: e.nome, det: e.det })),
      minuti: { riscaldamento: 10, allenamento: sess.durata, defaticamento: 10 },
      durata: sess.durata,
      contesto: ctx,
    };
  }

  // ---- Muay Thai e sala pesi: esercizi scelti dal catalogo ----
  const sel = contestoSelezione(workouts, profile);
  const ambito = type === "pesi" ? "palestra" : "muaythai";

  const prendi = (gruppi) =>
    gruppi.flatMap(([gruppo, n]) => scegliDaGruppo(ambito, gruppo, n, sel));

  const seduta = {
    type,
    focus,
    label: sess.label,
    riscaldamento: WARMUPS[type].map((e) => ({ nome: e.nome, det: e.det })),
    defaticamento: COOLDOWNS[type].map((e) => ({ nome: e.nome, det: e.det })),
    minuti: Object.assign({}, sess.minuti),
    durata: sess.minuti.allenamento,
    contesto: ctx,
    faticaRilevata: muscoliStanchi(sel.fatica),
  };

  if (type === "pesi") {
    seduta.allenamento = prendi(sess.gruppi).map((e) => adattaDaCatalogo(e, ctx, workouts));
    return seduta;
  }

  // Muay Thai: parte centrale a circuito o a esercizi separati, alternate
  const ultimaMT = piuRecenti(workouts).find((w) => w.type === "muaythai");
  const ultimaEraCircuito = !!(ultimaMT?.fasi?.allenamento?.esercizi || []).some(
    (e) => e.tipo === "circuito"
  );

  if (ultimaEraCircuito) {
    seduta.allenamento = prendi(sess.gruppi.concat(sess.extraSeparati)).map((e) =>
      adattaDaCatalogo(e, ctx, workouts)
    );
  } else {
    const scelti = prendi(sess.gruppi);
    const giri = ctx.dir > 0 ? 4 : 3;
    seduta.allenamento = [
      {
        tipo: "circuito",
        nome: "Circuito a corpo libero",
        giri,
        recEsVal: 15,
        recEsUnit: "sec",
        recGiriVal: 60,
        recGiriUnit: "sec",
        esercizi: scelti.map((e) => Object.assign({ nome: e.nome }, detACircuito(e.det))),
      },
    ];
  }

  // parte al sacco / pad
  const schema = scegliSchemaSacco(workouts);
  const combo = scegliCombinazioni(workouts, 2, 1);
  seduta.schema = schema;
  seduta.sacco = [
    { nome: schema.nome, det: schema.det },
    ...combo.sacco.map((c) => ({ nome: "Combinazione al sacco", det: c })),
    ...combo.pad.map((c) => ({ nome: "Combinazione ai pad", det: c })),
  ];
  return seduta;
}

/* Elenco leggibile dei muscoli attualmente carichi (per spiegare le scelte) */
const MUSCOLI_LABEL = {
  petto: "petto", spalleAnt: "spalle", spalleLat: "spalle", spallePost: "spalle",
  tricipiti: "tricipiti", bicipiti: "bicipiti", avambracci: "avambracci",
  dorsali: "schiena", trapezi: "trapezi", lombari: "lombari",
  addome: "addome", obliqui: "obliqui", glutei: "glutei",
  quadricipiti: "quadricipiti", femorali: "femorali", adduttori: "adduttori",
  polpacci: "polpacci", collo: "collo", cardio: "fiato",
};

function muscoliStanchi(fatica) {
  const nomi = Object.entries(fatica)
    .filter(([, v]) => v >= SOGLIA_FATICA)
    .sort((a, b) => b[1] - a[1])
    .map(([m]) => MUSCOLI_LABEL[m] || m);
  return [...new Set(nomi)];
}

/* Piano settimanale in base all'obiettivo e ai giorni disponibili,
   con spunta su ciò che è già stato fatto negli ultimi 7 giorni */
/* Con 5 allenamenti a settimana si usa lo schema fisso
   2 sala pesi + 2 Muay Thai + 1 corsa. Quali sedute finiscano
   nelle caselle lo decide comunque l'obiettivo scelto. */
function schemaFisso(obiettivo, workouts) {
  // i due slot di palestra ruotano: prima gli split lasciati indietro
  const splitPesi = Object.keys(SESSIONS.pesi)
    .map((focus) => {
      const ultima = piuRecenti(workouts || []).find(
        (w) => w.type === "pesi" && w.focus === focus
      );
      return { focus, giorni: ultima ? giorniDa(ultima.date) : 999 };
    })
    .sort((a, b) => b.giorni - a.giorni)
    .slice(0, 2)
    .map((s) => ({ type: "pesi", focus: s.focus }));

  const corsaPref = GOAL_PLANS[obiettivo].find((s) => s.type === "corsa");
  const corsa = corsaPref || { type: "corsa", focus: "lento" };
  const mt = { type: "muaythai", focus: "completo" };

  return [mt, splitPesi[0], Object.assign({}, mt), splitPesi[1], corsa];
}

function slotsSettimana(profile, workouts) {
  if (+profile.giorni === 5) return schemaFisso(profile.obiettivo, workouts);
  return GOAL_PLANS[profile.obiettivo].slice(0, profile.giorni);
}

function pianoSettimanale(profile, workouts) {
  const plan = slotsSettimana(profile, workouts);
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
  return generaSeduta(slot.type, slot.focus, workouts, profile);
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
   ±7,5% per ogni punto RPE sopra/sotto il riferimento 7.
   Per la corsa, se conosciamo il passo reale quello ha la precedenza:
   è un dato oggettivo, quindi la correzione sull'RPE si fa più leggera. */
function metEffettivo(type, focus, rpe, passoSecKm) {
  const tab = FOCUS_MET[type] || {};
  const daPasso = type === "corsa" ? metDaPasso(passoSecKm / 60) : null;
  const base = daPasso || tab[focus] || TYPE_INFO[type].met;
  const peso = daPasso ? 0.03 : 0.075;
  const fattore = Math.min(1.35, Math.max(0.6, 1 + ((rpe || 7) - 7) * peso));
  return base * fattore;
}

/* opzioni: { type, focus, rpe, minuti: {riscaldamento, allenamento, sacco, defaticamento},
              profile, passo } */
function stimaCalorie(opzioni) {
  const o = opzioni || {};
  const min = o.minuti || {};
  const rmr = rmrPerMinuto(o.profile || {});
  const met = metEffettivo(o.type, o.focus, o.rpe, o.passo);
  // consumo netto: (MET - 1) perché 1 MET è quello che si spende comunque a riposo
  const kcal =
    (MET_RISCALDAMENTO - 1) * rmr * (min.riscaldamento || 0) +
    (met - 1) * rmr * (min.allenamento || 0) +
    (MET_SACCO - 1) * rmr * (min.sacco || 0) +
    (MET_DEFATICAMENTO - 1) * rmr * (min.defaticamento || 0);

  const rpe = o.rpe || 7;
  const intensa = rpe >= 8 || FOCUS_INTENSI.includes(o.focus) || (min.sacco || 0) > 0;
  const epoc = intensa ? 1 + Math.min(0.09, 0.02 + Math.max(0, rpe - 6) * 0.02) : 1;

  return Math.max(0, Math.round(kcal * epoc));
}
