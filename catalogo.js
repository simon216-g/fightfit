/* ============================================================
   FightFit — Catalogo esercizi (la "memoria" dell'app)
   ------------------------------------------------------------
   Ogni esercizio è etichettato con i muscoli che coinvolge:
   il primo della lista è il muscolo principale, gli altri
   secondari. Su queste etichette l'app calcola l'affaticamento
   e decide cosa proporre.

   Campi:
     nome    — come compare in app
     muscoli — primo = principale
     det     — serie × ripetizioni o durata di riferimento
     carico  — true se ha senso registrare i kg
     base    — esercizio fondamentale: proposto sempre nella sua seduta
     exp     — esplosivo/potenza (priorità con obiettivo combattimento)
   ============================================================ */

/* Vocabolario muscoli (per riferimento):
   petto, spalleAnt, spalleLat, spallePost, tricipiti, bicipiti,
   avambracci, dorsali, trapezi, lombari, addome, obliqui,
   glutei, quadricipiti, femorali, adduttori, polpacci, collo, cardio */

const CATALOGO = {
  palestra: {
    petto: [
      { nome: "Panca piana", muscoli: ["petto", "tricipiti", "spalleAnt"], det: "4 × 8", carico: true, base: true },
      { nome: "Panca inclinata", muscoli: ["petto", "spalleAnt", "tricipiti"], det: "3 × 10", carico: true },
      { nome: "Panca inclinata al multipower", muscoli: ["petto", "spalleAnt", "tricipiti"], det: "3 × 10", carico: true },
      { nome: "Chest press", muscoli: ["petto", "tricipiti", "spalleAnt"], det: "3 × 10", carico: true },
      { nome: "Croci su panca con manubri", muscoli: ["petto"], det: "3 × 12", carico: true },
      { nome: "Croci ai cavi", muscoli: ["petto"], det: "3 × 12", carico: true },
      { nome: "Croci ai cavi bassi", muscoli: ["petto"], det: "3 × 12", carico: true },
      { nome: "Fly machine", muscoli: ["petto"], det: "3 × 12", carico: true },
      { nome: "Dips", muscoli: ["petto", "tricipiti", "spalleAnt"], det: "3 × 10", carico: true },
      { nome: "Push-up pliometrici", muscoli: ["petto", "tricipiti", "spalleAnt"], det: "4 × 8", exp: true },
    ],
    spalle: [
      { nome: "Military Press", muscoli: ["spalleAnt", "spalleLat", "tricipiti"], det: "4 × 8", carico: true, base: true },
      { nome: "Lento avanti (manubri)", muscoli: ["spalleAnt", "spalleLat", "tricipiti"], det: "3 × 10", carico: true },
      { nome: "Arnold Press", muscoli: ["spalleAnt", "spalleLat", "tricipiti"], det: "3 × 10", carico: true },
      { nome: "Alzate laterali", muscoli: ["spalleLat"], det: "3 × 15", carico: true },
      { nome: "Alzate laterali al cavo basso", muscoli: ["spalleLat"], det: "3 × 12 per lato", carico: true },
      { nome: "Alzate frontali", muscoli: ["spalleAnt"], det: "3 × 12", carico: true },
      { nome: "Rear delt fly", muscoli: ["spallePost", "trapezi"], det: "3 × 15", carico: true },
      { nome: "Landmine Punch", muscoli: ["spalleAnt", "petto", "addome"], det: "3 × 10 per lato", carico: true, exp: true },
      { nome: "Squat + spinta verticale kettle", muscoli: ["spalleAnt", "quadricipiti", "glutei"], det: "3 × 10", carico: true, exp: true },
      { nome: "Push press", muscoli: ["spalleAnt", "tricipiti", "quadricipiti"], det: "4 × 6", carico: true, exp: true },
      { nome: "Alzate laterali su panca inclinata", muscoli: ["spalleLat"], det: "3 × 12", carico: true },
    ],
    tricipiti: [
      { nome: "Tricipiti al cavo", muscoli: ["tricipiti"], det: "3 × 12", carico: true },
      { nome: "Skull crusher", muscoli: ["tricipiti"], det: "3 × 10", carico: true },
      { nome: "French press con manubri", muscoli: ["tricipiti"], det: "3 × 12", carico: true },
      { nome: "Dips", muscoli: ["tricipiti", "petto", "spalleAnt"], det: "3 × 10", carico: true },
    ],
    schiena: [
      { nome: "Lat Machine presa larga", muscoli: ["dorsali", "bicipiti"], det: "4 × 10", carico: true, base: true },
      { nome: "Stacco da terra", muscoli: ["lombari", "dorsali", "glutei", "femorali", "trapezi"], det: "4 × 6", carico: true, base: true },
      { nome: "Trazioni", muscoli: ["dorsali", "bicipiti"], det: "4 × 8", carico: true },
      { nome: "Lat machine presa stretta", muscoli: ["dorsali", "bicipiti"], det: "3 × 10", carico: true },
      { nome: "Rematore bilanciere", muscoli: ["dorsali", "trapezi", "lombari", "bicipiti"], det: "4 × 8", carico: true },
      { nome: "Pendlay Row (bilanciere)", muscoli: ["dorsali", "trapezi", "lombari"], det: "4 × 6", carico: true, exp: true },
      { nome: "Rematore mono con manubri", muscoli: ["dorsali", "bicipiti"], det: "3 × 12 per lato", carico: true },
      { nome: "Rowing machine ad un braccio", muscoli: ["dorsali", "bicipiti", "trapezi"], det: "3 × 12 per lato", carico: true },
      { nome: "Pulley (mono)", muscoli: ["dorsali", "bicipiti"], det: "3 × 12 per lato", carico: true },
      { nome: "Pulley basso", muscoli: ["dorsali", "bicipiti"], det: "3 × 12", carico: true },
      { nome: "Pulley sbarra larga", muscoli: ["dorsali", "spallePost"], det: "3 × 12", carico: true },
      { nome: "Face pull al cavo", muscoli: ["spallePost", "trapezi"], det: "3 × 15", carico: true },
      { nome: "Scrollate (shrug)", muscoli: ["trapezi"], det: "4 × 12", carico: true },
      { nome: "Pull-over al cavo alto", muscoli: ["dorsali"], det: "3 × 12", carico: true },
      { nome: "Iperestensioni", muscoli: ["lombari", "glutei", "femorali"], det: "3 × 15" },
    ],
    bicipiti: [
      { nome: "Curl con bilanciere in piedi", muscoli: ["bicipiti", "avambracci"], det: "3 × 10", carico: true },
      { nome: "Bicipiti in piedi (con manubri)", muscoli: ["bicipiti"], det: "3 × 12", carico: true },
      { nome: "Bicipiti alla panca scott", muscoli: ["bicipiti"], det: "3 × 12", carico: true },
      { nome: "Curl manubri su panca a 60°", muscoli: ["bicipiti"], det: "3 × 12", carico: true },
      { nome: "Curl a martello al cavo basso", muscoli: ["bicipiti", "avambracci"], det: "3 × 12", carico: true },
      { nome: "Curl inverso con bilanciere", muscoli: ["avambracci", "bicipiti"], det: "3 × 12", carico: true },
    ],
    gambe: [
      { nome: "Squat", muscoli: ["quadricipiti", "glutei", "lombari"], det: "4 × 8", carico: true, base: true },
      { nome: "Stacco rumeno", muscoli: ["femorali", "glutei", "lombari"], det: "3 × 10", carico: true },
      { nome: "Leg press", muscoli: ["quadricipiti", "glutei"], det: "4 × 10", carico: true },
      { nome: "Affondi bulgari", muscoli: ["quadricipiti", "glutei"], det: "3 × 10 per gamba", carico: true },
      { nome: "Hip Thrust", muscoli: ["glutei", "femorali"], det: "3 × 12", carico: true },
      { nome: "Leg extension", muscoli: ["quadricipiti"], det: "3 × 12", carico: true },
      { nome: "Leg curl", muscoli: ["femorali"], det: "3 × 12", carico: true },
      { nome: "Abductor machine", muscoli: ["glutei"], det: "3 × 15", carico: true },
      { nome: "Adductor machine", muscoli: ["adduttori"], det: "3 × 15", carico: true },
      { nome: "Calf seduto", muscoli: ["polpacci"], det: "4 × 15", carico: true },
      { nome: "Jump squat", muscoli: ["quadricipiti", "glutei", "polpacci"], det: "4 × 8", exp: true },
      { nome: "Calf in piedi", muscoli: ["polpacci"], det: "4 × 15", carico: true },
      { nome: "Affondi camminata con manubri", muscoli: ["quadricipiti", "glutei"], det: "3 × 12 per gamba", carico: true },
      { nome: "Step-up su panca alta", muscoli: ["quadricipiti", "glutei"], det: "3 × 10 per gamba", carico: true },
      { nome: "Box jump", muscoli: ["quadricipiti", "glutei", "polpacci"], det: "4 × 6", exp: true },
      { nome: "Nordic curl", muscoli: ["femorali"], det: "3 × 8" },
    ],
    addome: [
      { nome: "Plank", muscoli: ["addome", "obliqui"], det: "3 × 45 sec" },
      { nome: "Plank laterale", muscoli: ["obliqui", "addome"], det: "3 × 40 sec per lato" },
      { nome: "Pallof press al cavo", muscoli: ["obliqui", "addome"], det: "3 × 12 per lato", carico: true },
      { nome: "Mountain Climber", muscoli: ["addome", "cardio", "spalleAnt"], det: "3 × 40 sec" },
      { nome: "Russian Twist", muscoli: ["obliqui", "addome"], det: "3 × 20" },
      { nome: "Portafoglio", muscoli: ["addome"], det: "3 × 15" },
      { nome: "Leg raises", muscoli: ["addome"], det: "3 × 15" },
      { nome: "Corte", muscoli: ["addome"], det: "3 × 20" },
      { nome: "Complete", muscoli: ["addome"], det: "3 × 15" },
      { nome: "Tocco talloni", muscoli: ["obliqui"], det: "3 × 20 per lato" },
      { nome: "Crunch machine", muscoli: ["addome"], det: "3 × 15", carico: true },
    ],
  },

  /* ---- Muay Thai: esercizi a corpo libero ---- */
  muaythai: {
    pettoSpalle: [
      { nome: "Push-up", muscoli: ["petto", "tricipiti", "spalleAnt"], det: "4 × 15" },
      { nome: "Push-up pliometrici", muscoli: ["petto", "tricipiti", "spalleAnt"], det: "4 × 8", exp: true },
      { nome: "Push-up diamante", muscoli: ["tricipiti", "petto"], det: "3 × 12" },
      { nome: "Dips su panca", muscoli: ["tricipiti", "petto"], det: "3 × 12" },
      { nome: "Floor press con med ball", muscoli: ["petto", "tricipiti"], det: "3 × 12" },
      // busto piegato a 90°: slam a terra e rimbalzi continui il più possibile
      { nome: "Med ball slam a 90°", muscoli: ["dorsali", "addome", "tricipiti"], det: "3 × 30 sec di rimbalzi", exp: true },
      { nome: "Push-up con rotazione a T", muscoli: ["petto", "obliqui", "spalleAnt"], det: "3 × 10 per lato" },
    ],
    addome: [
      { nome: "Plank", muscoli: ["addome", "obliqui"], det: "3 × 45 sec" },
      { nome: "Plank laterale", muscoli: ["obliqui", "addome"], det: "3 × 40 sec per lato" },
      { nome: "Mountain climber", muscoli: ["addome", "cardio"], det: "3 × 40 sec" },
      { nome: "Russian twist", muscoli: ["obliqui", "addome"], det: "3 × 20" },
      { nome: "Leg raises", muscoli: ["addome"], det: "3 × 15" },
      { nome: "Portafoglio", muscoli: ["addome"], det: "3 × 15" },
      { nome: "Corte", muscoli: ["addome"], det: "3 × 20" },
      { nome: "Corte con gambe alzate", muscoli: ["addome"], det: "3 × 20" },
      { nome: "Complete", muscoli: ["addome"], det: "3 × 15" },
      { nome: "Completa + colpi al sacco", muscoli: ["addome", "spalleAnt", "cardio"], det: "3 × 12" },
      { nome: "Tocco talloni", muscoli: ["obliqui"], det: "3 × 20 per lato" },
      { nome: "Crunch laterali", muscoli: ["obliqui"], det: "3 × 15 per lato" },
    ],
    gambe: [
      { nome: "Squat a corpo libero", muscoli: ["quadricipiti", "glutei"], det: "4 × 20" },
      { nome: "Affondi", muscoli: ["quadricipiti", "glutei"], det: "3 × 12 per gamba" },
      { nome: "Affondi laterali", muscoli: ["adduttori", "quadricipiti", "glutei"], det: "3 × 10 per lato" },
      { nome: "Jump squat", muscoli: ["quadricipiti", "glutei", "polpacci"], det: "4 × 12", exp: true },
      { nome: "Tenuta squat", muscoli: ["quadricipiti"], det: "3 × 45 sec" },
      { nome: "Affondi con ginocchiata", muscoli: ["quadricipiti", "glutei", "addome"], det: "3 × 10 per gamba" },
      { nome: "Ginocchiata con un piede in appoggio alto", muscoli: ["glutei", "addome", "quadricipiti"], det: "3 × 12 per gamba" },
      { nome: "Affondo + switch", muscoli: ["quadricipiti", "glutei", "polpacci"], det: "3 × 12", exp: true },
      { nome: "Tuck Jump + calci", muscoli: ["quadricipiti", "polpacci", "addome"], det: "3 × 10", exp: true },
      { nome: "Skater jump (balzi laterali)", muscoli: ["quadricipiti", "glutei", "adduttori"], det: "3 × 20 (10 per lato)", exp: true },
      { nome: "Broad jump", muscoli: ["quadricipiti", "glutei", "polpacci"], det: "4 × 6", exp: true },
      { nome: "Single-leg RDL a corpo libero", muscoli: ["femorali", "glutei"], det: "3 × 10 per gamba" },
    ],
    completo: [
      { nome: "Burpees", muscoli: ["cardio", "petto", "quadricipiti"], det: "4 × 12" },
      { nome: "Jumping jack", muscoli: ["cardio", "polpacci", "spalleLat"], det: "3 × 40 sec" },
      { nome: "Corda", muscoli: ["cardio", "polpacci"], det: "3 round × 3 min" },
      { nome: "Ginocchiate al sacco", muscoli: ["addome", "glutei", "cardio"], det: "3 × 30 colpi" },
      { nome: "Shadow boxing con pesi", muscoli: ["spalleAnt", "spalleLat", "cardio"], det: "3 round × 2 min" },
      { nome: "Montanti con palla medica", muscoli: ["spalleAnt", "addome", "obliqui"], det: "3 × 20", exp: true },
      { nome: "Med ball slam con rotazione da un lato", muscoli: ["obliqui", "dorsali", "addome"], det: "3 × 10 per lato", exp: true },
      { nome: "Med ball overhead slam", muscoli: ["dorsali", "addome", "spalleAnt"], det: "3 × 12", exp: true },
      { nome: "Med ball spinte alte", muscoli: ["spalleAnt", "petto", "quadricipiti"], det: "3 × 12", exp: true },
      { nome: "Med ball rotation (spinte basse)", muscoli: ["obliqui", "petto", "addome"], det: "3 × 12 per lato", exp: true },
      { nome: "Squat + spinte verticali con med ball", muscoli: ["quadricipiti", "spalleAnt", "glutei"], det: "3 × 12", exp: true },
      { nome: "Sprawl", muscoli: ["cardio", "petto", "quadricipiti", "addome"], det: "4 × 12" },
      { nome: "Ginocchiate in clinch al sacco con presa", muscoli: ["addome", "glutei", "cardio"], det: "3 × 30 colpi" },
      { nome: "Isometria del collo", muscoli: ["collo"], det: "3 × 30 sec per direzione" },
    ],
  },
};

/* ============================================================
   Combinazioni
   Nelle combo AI PAD le azioni difensive sono nominate col colpo
   dell'AVVERSARIO: "roll gancio sx" = lui tira il gancio sinistro.
   ============================================================ */
const COMBINAZIONI = {
  sacco: [
    "Diretto + diretto + gancio + middle",
    "Jab + diretto + low kick dx",
    "Jab + diretto + finta low + spin elbow sx",
    "Jab + diretto + switch middle kick",
    "Jab + diretto + gancio sx + montante dx",
    "Jab + diretto + gancio sx + (quando torna indietro dal gancio) high kick dx + low kick dx",
    "Jab + jab + diretto + gancio sx + diretto",
    "Diretto + gomito dx + ginocchio + spinta + middle",
    "Montante + diretto + gancio + low",
    "Jab + gomito sx + gomito obliquo dx + ginocchio + teep",
    "Jab + gancio sx + low kick dx + diretto",
    "Jab + diretto che copre + ginocchiata + spinta + middle",
    "Jab + diretto + gancio al fegato + gomito dx",
    "Jab + diretto + low + (ripetere) + finta low + back heel high kick",
    "Jab + jab + question mark kick",
    "Jab + diretto + diretto al corpo",
    "Jab + diretto + finta diretto al corpo + diretto karate in faccia",
    "Teep + ginocchiata + gomito dx + gomito sx",
    "Jab + diretto + jab + diretto + montante al fegato sx",
    // aggiunte: il teep come apertura, il lavoro sul lato debole, il clinch
    "Teep sx + diretto + gancio sx + low kick dx",
    "Low kick dx + jab + diretto + low kick dx",
    "Jab + middle sx + diretto + middle sx (in switch)",
    "Jab + jab al corpo + high kick sx",
    "Diretto + ginocchiata dx + gomito sx",
    "Middle dx + spinning back elbow sx",
    "Jab + diretto + gancio sx + middle dx + check di rientro",
    "Jab + diretto + ginocchiata in salto dx",
  ],
  pad: [
    "Jab + diretto + uscita a sx",
    "Jab + diretto + schivata esterna jab + montante al corpo",
    "Slip esterno jab + diretto + slip gancio + gancio sx al corpo + gancio sx sopra + low kick",
    "Parare low kick + middle stessa gamba + diretto + slip diretto + gancio al corpo",
    "Roll gancio sx + diretto + gancio sx + schivata all'indietro + teep + gomito",
    "Blocco jab + parare gancio dx + diretto + slip in avanti dx + gancio dx + ginocchio",
    "Montanti veloci + gancio da schivare random",
    "Jab + diretto + roll gancio sx + gancio dx",
    // aggiunte reattive: sempre col nome del colpo dell'avversario
    "Parare teep + diretto + gancio sx + low kick dx",
    "Slip esterno diretto + gancio dx al corpo + gancio sx alto",
    "Check low kick dx + diretto + middle dx",
    "Roll gancio dx + gancio sx + gomito rotante dx",
    "Blocco middle kick + diretto + ginocchiata dx",
    "Schivata indietro dal middle + teep di rimessa + diretto",
  ],
};

/* ============================================================
   Schemi di lavoro al sacco / ai pad
   Ogni schema porta il proprio timer già configurato:
     tipo "round"    → timer a round (lavoro/recupero alternati)
     tipo "circuito" → sequenza a segmenti (per i round spezzati)
   ============================================================ */
const SCHEMI_SACCO = [
  {
    id: "liberi",
    nome: "Round liberi",
    det: "5 round × 3 min, recupero 1 min",
    note: "Combinazioni libere. Puoi darti un focus: solo gambe, solo boxe, solo gomiti.",
    timer: { tipo: "round", rounds: 5, work: 180, rest: 60 },
  },
  {
    id: "leggeri-pesanti",
    nome: "Leggeri / pesanti 40-20",
    det: "5 round × 3 min (40 sec leggeri + 20 sec pesanti × 3)",
    note: "Nei 40 secondi tieni ritmo e precisione, nei 20 metti potenza.",
    timer: {
      tipo: "circuito",
      giri: 5,
      recEs: 0,
      recGiri: 60,
      esercizi: [
        { nome: "Colpi leggeri", val: 40, unit: "sec" },
        { nome: "Colpi pesanti", val: 20, unit: "sec" },
        { nome: "Colpi leggeri", val: 40, unit: "sec" },
        { nome: "Colpi pesanti", val: 20, unit: "sec" },
        { nome: "Colpi leggeri", val: 40, unit: "sec" },
        { nome: "Colpi pesanti", val: 20, unit: "sec" },
      ],
    },
  },
  {
    id: "jab-diretto",
    nome: "Jab-diretto veloci + colpi forti",
    det: "5 round × 3 min (40 sec jab-diretto + 20 sec forti × 3)",
    note: "Nei 40 secondi solo jab e diretto il più veloce possibile.",
    timer: {
      tipo: "circuito",
      giri: 5,
      recEs: 0,
      recGiri: 60,
      esercizi: [
        { nome: "Jab-diretto veloci", val: 40, unit: "sec" },
        { nome: "Colpi forti", val: 20, unit: "sec" },
        { nome: "Jab-diretto veloci", val: 40, unit: "sec" },
        { nome: "Colpi forti", val: 20, unit: "sec" },
        { nome: "Jab-diretto veloci", val: 40, unit: "sec" },
        { nome: "Colpi forti", val: 20, unit: "sec" },
      ],
    },
  },
  {
    id: "ripetute",
    nome: "Ripetute sulla combinazione",
    det: "8 × (30 sec combinazione + 30 sec pausa)",
    note: "Ogni ripetuta lavora la stessa combinazione: cerca la pulizia, non la fretta.",
    timer: {
      tipo: "circuito",
      giri: 8,
      recEs: 0,
      recGiri: 30,
      esercizi: [{ nome: "Combinazione", val: 30, unit: "sec" }],
    },
  },
  {
    id: "tecnica",
    nome: "Round tecnici lunghi",
    det: "5 round × 2 min, recupero 45 sec",
    note: "Un solo gesto tecnico per round, ripetuto fino a farlo diventare automatico.",
    timer: { tipo: "round", rounds: 5, work: 120, rest: 45 },
  },
  {
    id: "piramide",
    nome: "Piramide di colpi",
    det: "4 round × 3 min, recupero 1 min",
    note: "1 colpo, poi 2, poi 3, poi 4 e si ridiscende. Ogni colpo deve restare pulito.",
    timer: { tipo: "round", rounds: 4, work: 180, rest: 60 },
  },
  {
    id: "finale",
    nome: "Ultimi 15 secondi a tutta",
    det: "5 round × 3 min (2:45 normali + 15 sec a tutta)",
    note: "Il finale svuota il serbatoio: è lì che si costruisce la testa per il terzo round.",
    timer: {
      tipo: "circuito",
      giri: 5,
      recEs: 0,
      recGiri: 60,
      esercizi: [
        { nome: "Ritmo di gara", val: 165, unit: "sec" },
        { nome: "A TUTTA", val: 15, unit: "sec" },
      ],
    },
  },
  {
    id: "difensivo",
    nome: "Round difensivo",
    det: "5 round × 3 min, recupero 1 min",
    note: "Solo schivate, parate e check: un solo colpo di rimessa ogni azione difesa.",
    timer: { tipo: "round", rounds: 5, work: 180, rest: 60 },
  },
  {
    id: "fisso-libero",
    nome: "Combinazione fissa + libero",
    det: "5 × (30 sec combinazione + 30 sec libero), recupero 30 sec",
    note: "Prima lo schema, poi l'istinto: serve a far diventare tua la combinazione.",
    timer: {
      tipo: "circuito",
      giri: 5,
      recEs: 0,
      recGiri: 30,
      esercizi: [
        { nome: "Combinazione fissa", val: 30, unit: "sec" },
        { nome: "Colpi liberi", val: 30, unit: "sec" },
      ],
    },
  },
  {
    id: "lato-debole",
    nome: "Solo lato debole",
    det: "4 round × 3 min, recupero 1 min",
    note: "Tutto in switch o di sinistra: il lato che non ti viene naturale è quello che ti manca.",
    timer: { tipo: "round", rounds: 4, work: 180, rest: 60 },
  },
];

/* ============================================================
   Indice per nome: serve a risalire dai nomi salvati negli
   allenamenti ai muscoli coinvolti.
   ============================================================ */
const CATALOGO_INDEX = (() => {
  const idx = {};
  Object.entries(CATALOGO).forEach(([ambito, gruppi]) =>
    Object.entries(gruppi).forEach(([gruppo, lista]) =>
      lista.forEach((e) => {
        const key = e.nome.toLowerCase();
        // se un esercizio compare in più gruppi tengo la prima definizione
        if (!idx[key]) idx[key] = Object.assign({}, e, { ambito, gruppo });
      })
    )
  );
  return idx;
})();

function trovaEsercizio(nome) {
  return nome ? CATALOGO_INDEX[String(nome).trim().toLowerCase()] || null : null;
}

function muscoliDi(nome) {
  const e = trovaEsercizio(nome);
  return e ? e.muscoli : null;
}

function gruppoCatalogo(ambito, gruppo) {
  return (CATALOGO[ambito] && CATALOGO[ambito][gruppo]) || [];
}

/* Trasforma un dettaglio ("3 × 45 sec", "4 × 12") nei valori
   che servono al circuito automatico */
function detACircuito(det) {
  const s = String(det || "");
  const sec = s.match(/(\d+)\s*sec/i);
  if (sec) return { val: +sec[1], unit: "sec" };
  const min = s.match(/(\d+)\s*min/i);
  if (min) return { val: +min[1], unit: "min" };
  const rip = s.match(/[×x]\s*(\d+)/);
  if (rip) return { val: +rip[1], unit: "rip" };
  return { val: 40, unit: "sec" };
}
