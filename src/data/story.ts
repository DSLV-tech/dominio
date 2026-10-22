// ─── La Notte Lunga di Novarata ───────────────────────────────────────────────
// Trama: il sindaco Augusto Venier muore nell'incendio di Palazzo del Potere.
// Il Prefetto commissaria la città: tra trenta notti arriverà il commissario,
// e tratterà con chi tiene Novarata. Quattro fazioni scendono in strada.
// Sotto la guerra corre un mistero: chi ha appiccato il fuoco, e perché?
// La voce narrante è Livia Sarti, cronista della Gazzetta di Novarata.
// Chi vince la partita decide quale verità finisce in prima pagina.

import type {
  StoryPage, StoryAct, FactionLore, TerritoryLore, ZoneLore, Epilogues,
  FactionId, TerritoryId, ZoneId, EventCardId,
} from '../types';

export const NEWSPAPER = 'La Gazzetta di Novarata';
export const CHRONICLER = 'Livia Sarti';

// ─── Prologo ──────────────────────────────────────────────────────────────────

export const PROLOGUE: readonly StoryPage[] = [
  {
    kicker: 'Novarata · 3 novembre · ore 23:40',
    title: 'Il palazzo brucia',
    paragraphs: [
      'Le fiamme si vedono dal porto. Palazzo del Potere, sede del Comune da duecento anni, arde come una torcia sopra Piazza Grande.',
      'All\'alba i pompieri trovano il corpo del sindaco Augusto Venier nell\'archivio del terzo piano. La porta era chiusa a chiave. Dall\'interno.',
    ],
  },
  {
    kicker: 'Prefettura · comunicato n. 114',
    title: 'Trenta notti',
    paragraphs: [
      'Il Consiglio comunale è sciolto. Tra trenta notti arriverà da Roma un commissario straordinario.',
      'Tutti in città sanno cosa significa: il commissario non governerà contro chi tiene le strade. Tratterà con lui.',
      'Novarata ha trenta notti per scegliersi un padrone.',
    ],
  },
  {
    kicker: `Appunti di ${CHRONICLER}, cronista`,
    title: 'Quattro mani sulla città',
    paragraphs: [
      'Gli avvocati del Centro, la famiglia del Porto, i ragazzi dei palazzoni, le ronde delle Colline. Ognuno aveva un motivo per volere Venier fuori dai giochi.',
      'Io scriverò quello che vedo. Ma lo so già: alla fine, la verità sull\'incendio sarà quella di chi resta in piedi.',
    ],
  },
];

// ─── Atti (si aprono all'inizio del turno indicato) ──────────────────────────

export const STORY_ACTS: readonly StoryAct[] = [
  {
    number: 1,
    round: 1,
    title: 'La notte dell\'incendio',
    paragraphs: [
      'La città non dorme. Le serrande restano abbassate, i tram girano vuoti, e in ogni quartiere qualcuno conta i suoi uomini.',
      'Le prime mosse decidono chi parte in vantaggio. Nessuno vuole essere il primo a sparare, tutti vogliono essere i primi ad arrivare.',
    ],
    clue: 'L\'archivio era chiuso dall\'interno. Venier non era solo, quella notte.',
  },
  {
    number: 2,
    round: 3,
    title: 'Le strade parlano',
    paragraphs: [
      'I vigili del fuoco consegnano il rapporto: l\'incendio è partito da tre punti diversi. Non è stato un incidente.',
      'Dall\'archivio manca una sola cartella. Sulla costola c\'era scritto «PRG 2027», il nuovo Piano Regolatore.',
    ],
    clue: 'Il Piano Regolatore 2027 è sparito. Qualcuno lo voleva morto quanto il sindaco.',
  },
  {
    number: 3,
    round: 5,
    title: 'Il piano Aurora',
    paragraphs: [
      'Una copia del piano arriva in redazione, senza mittente. Venier stava per vendere mezza città ad Aurora Sviluppo: il Porto Vecchio raso al suolo per un porto turistico, i palazzi popolari della Suburbia abbattuti, le Colline aperte al cemento.',
      'Adesso ogni fazione ha un movente. E ognuna giura di non averlo mai visto.',
    ],
    clue: 'Sulla bozza c\'è una firma di approvazione: le iniziali «E.M.»',
  },
  {
    number: 4,
    round: 7,
    title: 'Prima dell\'alba',
    paragraphs: [
      'Il commissario ha anticipato l\'arrivo. Le ultime notti decidono tutto: chi tiene Piazza Grande parlerà a nome di Novarata.',
      'In redazione arriva una telefonata anonima: «Venier ha aperto lui la porta dell\'archivio. Conosceva chi è entrato».',
    ],
    clue: 'Il sindaco conosceva il suo assassino. Lo aspettava.',
  },
];

export function actForRound(round: number): StoryAct | undefined {
  return STORY_ACTS.find(a => a.round === round);
}

// ─── Fazioni ──────────────────────────────────────────────────────────────────

export const FACTION_LORE: Readonly<Record<FactionId, FactionLore>> = {
  BIANCHI: {
    leader: 'Ettore Malaspina',
    pronoun: 'lui',
    grammar: { plural: true, to: 'ai Colletti Bianchi', of: 'dei Colletti Bianchi' },
    leaderRole: 'Avvocato, ex vicesindaco',
    motto: 'Ogni firma è un\'arma.',
    motive: 'Era il numero due di Venier. Si considera il suo erede naturale e intende arrivare dal commissario con la città già in tasca.',
    secret: 'Le iniziali sulla bozza del piano Aurora sono le sue.',
  },
  MANO_NERA: {
    leader: 'Rosaria Calò',
    pronoun: 'lei',
    grammar: { plural: false, to: 'alla Mano Nera', of: 'della Mano Nera' },
    leaderRole: 'Armatrice, «Donna Rosaria»',
    motto: 'Il porto non dimentica.',
    motive: 'Il piano Aurora avrebbe cancellato le banchine, e con loro trent\'anni di affari della famiglia. Il porto è suo, e lo resterà.',
    secret: 'La notte dell\'incendio una sua barca ha lasciato il molo senza luci.',
  },
  STRADA: {
    leader: 'Nico «Ruggine» Ferraris',
    pronoun: 'lui',
    grammar: { plural: true, to: 'ai Figli della Strada', of: 'dei Figli della Strada' },
    leaderRole: 'Ex operaio, capo dei palazzoni',
    motto: 'Il cemento è casa nostra.',
    motive: 'Gli sgomberi erano già programmati. Per chi vive nella Suburbia non è una guerra di potere: è restare o sparire.',
    secret: 'Due dei suoi ragazzi erano in Piazza Grande quando è partito il fuoco.',
  },
  ORDINE: {
    leader: 'Adele Ventura',
    pronoun: 'lei',
    grammar: { plural: false, to: "all'Ordine Civico", of: "dell'Ordine Civico" },
    leaderRole: 'Colonnello in congedo',
    motto: 'Prima l\'ordine. Poi la legge.',
    motive: 'Le ronde sono nate per proteggere le Colline. Ventura ora pensa che solo una mano ferma possa salvare Novarata da se stessa.',
    secret: 'Le sue ronde avevano le chiavi di servizio del Palazzo.',
  },
};

// ─── Quartieri e zone ─────────────────────────────────────────────────────────

export const ZONE_LORE: Readonly<Record<ZoneId, ZoneLore>> = {
  CS: { tagline: 'Chi controlla il Centro controlla la narrativa.', inside: 'nel Centro Storico' },
  PV: { tagline: 'Contrabbando, dogane e accordi a bassa voce.', inside: 'nel Porto Vecchio' },
  PN: { tagline: 'Fabbriche e aeroporto: qui si contano i numeri.', inside: 'nella Periferia Nord' },
  CR: { tagline: 'Ville, università, ospedale. Facile da difendere.', inside: 'nelle Colline Residenziali' },
  SE: { tagline: 'Palazzoni e stazione. Alta densità, alta tensione.', inside: 'nella Suburbia Est' },
};

export const TERRITORY_LORE: Readonly<Record<TerritoryId, TerritoryLore>> = {
  CS1: { line: 'Le macerie del Palazzo fumano ancora. Chi tiene la piazza parla per la città.' },
  CS2: { line: 'Il vescovo ha aperto le porte agli sfollati. Ascolta tutti, non giura per nessuno.' },
  CS3: { line: 'Ciò che resta del Comune. Nei corridoi bruciati si cercano ancora le carte.' },
  CS4: { line: 'I banchi aprono alle cinque. Le voci girano prima della frutta.' },
  PV1: { line: 'Gru ferme e container senza nome. Di notte qualcuno scarica lo stesso.' },
  PV2: { line: 'Il cuore del contrabbando. Da qui partono i camion verso nord.' },
  PV3: { line: 'Le famiglie dei pescatori pagano la protezione da tre generazioni.' },
  PV4: { line: 'I timbri della dogana valgono più delle leggi.' },
  PN1: { line: 'Ciminiere spente e cancelli presidiati. Gli operai aspettano un padrone nuovo.' },
  PN2: { line: 'Case basse e bar aperti fino a tardi. Qui si sceglie da che parte stare.' },
  PN3: { line: 'Voli sospesi per ordine della Prefettura. La pista è vuota, gli hangar no.' },
  PN4: { line: 'Unico ponte tra il porto e l\'est. Chi lo chiude, strangola la città.' },
  CR1: { line: 'Cancelli automatici e telecamere. I proprietari hanno già scelto chi pagare.' },
  CR2: { line: 'Gli studenti occupano l\'aula magna e stampano volantini contro tutti.' },
  CR3: { line: 'Sentieri e radure. Il posto giusto per sparire, o per far sparire.' },
  CR4: { line: 'Corsie piene. Nessuno chiede chi sei, solo da che parte sanguini.' },
  SE1: { line: 'Dodici piani di cemento e nessun ascensore funzionante. Qui nessuno se ne va.' },
  SE2: { line: 'Le vetrine sono sbarrate. Il parcheggio è diventato una piazza d\'armi.' },
  SE3: { line: 'I treni non partono, ma tutti passano da qui. Snodo di tre quartieri.' },
  SE4: { line: 'Capannoni dismessi e camion con la targa coperta.' },
};

// ─── Epiloghi (fazione × condizione di vittoria) ─────────────────────────────

export const EPILOGUES: Epilogues = {
  BIANCHI: {
    TOTAL_DOMINATION: 'Il commissario trova un\'unica firma su ogni porta della città: quella di Ettore Malaspina. La Gazzetta titola «Venier vittima di un corto circuito». Il piano Aurora viene approvato in una seduta di dieci minuti.',
    POLITICAL_CONTROL: 'Malaspina riceve il commissario sulle macerie di Piazza Grande, con le mani pulite e un sorriso stanco. L\'inchiesta sull\'incendio si chiude per «mancanza di elementi». Le iniziali E.M. non compaiono in nessun verbale.',
    ELIMINATION: 'Uno dopo l\'altro, i rivali di Malaspina sono finiti in tribunale, in esilio o nel silenzio. Novarata ha un nuovo sindaco prima ancora che si voti. Livia Sarti viene trasferita alla pagina dello sport.',
  },
  MANO_NERA: {
    TOTAL_DOMINATION: 'Le navi tornano ad attraccare senza luci, ma adesso lo fanno in tutta la città. Il piano Aurora brucia in un bidone sul molo. Nessuno chiede più chi abbia appiccato il primo fuoco.',
    POLITICAL_CONTROL: 'Donna Rosaria non si siede mai al tavolo del commissario: manda un nipote, e il commissario capisce. La Gazzetta scrive che Venier è morto per i suoi debiti. Sulle banchine si festeggia per tre giorni.',
    ELIMINATION: 'Il porto ha inghiottito la città, un quartiere alla volta. Quando il commissario arriva, trova solo un indirizzo a cui presentarsi. La barca senza luci non è mai esistita.',
  },
  STRADA: {
    TOTAL_DOMINATION: 'Per la prima volta i palazzoni guardano il Centro dall\'alto. Ruggine non vuole la fascia da sindaco: vuole che nessuno venga più sgomberato. La Gazzetta pubblica il piano Aurora per intero, in prima pagina.',
    POLITICAL_CONTROL: 'I ragazzi della Suburbia montano la guardia attorno a Piazza Grande. Il commissario firma la sospensione degli sgomberi davanti alle telecamere. La morte di Venier diventa «una vendetta della speculazione».',
    ELIMINATION: 'Le altre fazioni hanno sottovalutato chi non aveva niente da perdere. Novarata si sveglia con i murales al posto dei manifesti elettorali. Dei due ragazzi in piazza quella notte non parla più nessuno.',
  },
  ORDINE: {
    TOTAL_DOMINATION: 'Coprifuoco alle dieci, posti di blocco a ogni incrocio. La città è sicura come non lo è mai stata, e silenziosa come un cimitero. La Gazzetta esce con una sola colonna, approvata in anticipo.',
    POLITICAL_CONTROL: 'Adele Ventura consegna al commissario una città ordinata e un colpevole già pronto. Il processo dura un pomeriggio. Le chiavi di servizio del Palazzo vengono archiviate come «materiale non rilevante».',
    ELIMINATION: 'Le ronde hanno chiuso la partita come si chiude una porta. Nessuna fazione rimasta, nessuna voce fuori dal coro. Livia Sarti consegna l\'ultimo pezzo e lascia la redazione.',
  },
};

// ─── Dispacci degli eventi ────────────────────────────────────────────────────

export interface EventActor { readonly leader: string; readonly name: string }
export interface EventArticle { readonly headline: string; readonly body: string }

/** Articolo della Gazzetta per ciascuna carta evento giocata. */
export const EVENT_ARTICLES: Readonly<Record<EventCardId, (a: EventActor, t: EventActor | null, place: string | null) => EventArticle>> = {
  PROTESTA: a => ({
    headline: 'Piazza piena, Centro blindato',
    body: `${a.leader} manda la gente in strada: per tutta la notte nessuno tocca il Centro Storico.`,
  }),
  BLACKOUT: a => ({
    headline: 'Blackout su Novarata',
    body: `Salta la corrente in mezza città. ${a.leader} giura di non c'entrare, ma solo il Porto Vecchio resta illuminato.`,
  }),
  OPERAZIONE: (a, t, place) => ({
    headline: `Retata${place ? ` a ${place}` : ''}`,
    body: `Le volanti arrivano all'alba${place ? ` a ${place}` : ''}${t ? ` e ${t.leader} perde uomini` : ''}. In questura dicono che non c'è nessuna regia; in strada si fanno i nomi di ${a.leader}.`,
  }),
  ACCORDO_PACE: (a, t) => ({
    headline: 'Una stretta di mano al buio',
    body: `${a.leader} e ${t?.leader ?? 'un rivale'} si siedono allo stesso tavolo: fino al prossimo turno le armi restano nei bagagliai.`,
  }),
  MERCATO_NERO: a => ({
    headline: 'Il mercato nero non chiude mai',
    body: `Casse senza bolla attraversano i moli: ${a.leader} si ritrova con nuove carte in mano.`,
  }),
  IMMIGRAZIONE: (a, _t, place) => ({
    headline: `Arrivi nella notte${place ? ` a ${place}` : ''}`,
    body: `Tre camion senza targa scaricano gente${place ? ` a ${place}` : ' nella Suburbia'}. ${a.leader} dice che è solidarietà; gli altri dicono che sono rinforzi.`,
  }),
  CORRUZIONE: (a, t) => ({
    headline: 'Una busta passa di mano',
    body: `${t?.leader ?? 'Un rivale'} scopre di aver perso un documento prezioso. ${a.leader} non commenta, ma sorride.`,
  }),
  SCIOPERO: a => ({
    headline: 'Sciopero generale',
    body: `${a.leader} chiude i cancelli: domani ogni fazione avrà un uomo in meno da mandare in strada.`,
  }),
  RIOT: a => ({
    headline: 'La rivolta aiuta chi ha meno',
    body: `Dopo i disordini, la fazione più debole trova rinforzi inattesi. Si dice che ${a.leader} ne sappia qualcosa.`,
  }),
  ACCORDO_COMM: (a, t) => ({
    headline: 'Scambio al mercato di via dei Pescatori',
    body: `${a.leader} e ${t?.leader ?? 'un rivale'} si scambiano carte senza guardarsi in faccia. Nessuno dei due ammette di aver ceduto qualcosa.`,
  }),
  MEDIA_STORM: a => ({
    headline: 'Tempesta mediatica',
    body: `Una campagna di stampa scuote Piazza Grande: chi la tiene ora ha più dispacci da gestire. ${a.leader} brinda.`,
  }),
  RAPPRESAGLIA: a => ({
    headline: 'Si prepara una risposta',
    body: `${a.leader} avverte la città: chi toccherà i suoi quartieri riceverà la risposta alla prima occasione.`,
  }),
};
