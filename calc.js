/* Moteur de paie (intérim, travail posté).
   Tous les taux viennent du profil. Valeurs par défaut neutres, à 0 ou génériques.
   Règles :
   - net après PAS, IFM et CP toujours inclus (« tout compris ») ;
   - heures supplémentaires par semaine civile (au-delà de hs1Seuil, puis hs2Seuil) ;
   - la majoration d'heures sup. et celle du férié entrent dans l'IFM et les CP,
     pas dans la base du 13e mois ;
   - un férié travaillé est majoré (majFerie) et ouvre un seul panier jour,
     sauf si le poste a déjà le panier de nuit ;
   - un samedi utilise les taux du profil (majSamMatin, majSamApm, majSamNuit) ;
   - les heures de nuit d'un matin viennent de nuitMatin (poste commencé tôt) ;
   - un poste Journée est un montant fixe (journeeNet / journeeBrut),
     ses heures comptent seulement pour le seuil d'heures sup. */
(function (root, factory) {
  var api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BudgetCalc = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var DEFAULTS = {
    taux: 0,
    heuresPoste: 7,
    heuresJournee: 0,
    nuitMatin: 0,
    nuitNuit: 0,
    nuitSamNuit: 0,
    majNuit: 0.25,
    majSamMatin: 0,
    majSamApm: 0,
    majSamNuit: 0,
    majFerie: 1,
    primeEquipe: 0,
    panierNuit: 0,
    panierJour: 0,
    transport: 0,
    tx13e: 0,
    txIFM: 0.1,
    txCP: 0.1,
    txCotis: 0.22,
    txExoHS: 0.11,
    txCsgNonDed: 0.029,
    pas: 0,
    hs1Seuil: 35,
    hs2Seuil: 43,
    majHS1: 0.25,
    majHS2: 0.5,
    journeeNet: 0,
    journeeBrut: 0
  };

  function r2(x) { return Math.round((x + Number.EPSILON) * 100) / 100; }
  function num(v, d) {
    if (v == null || v === '') return d;
    var n = typeof v === 'number' ? v : parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
    return isFinite(n) ? n : d;
  }
  function normaliser(p) {
    var o = {};
    Object.keys(DEFAULTS).forEach(function (k) { o[k] = num(p && p[k], DEFAULTS[k]); });
    if (!(o.hs2Seuil > o.hs1Seuil)) o.hs2Seuil = o.hs1Seuil + 8;
    if (!(o.heuresJournee > 0)) o.heuresJournee = o.heuresPoste;
    return o;
  }
  function dates() {
    if (typeof module !== 'undefined' && module.exports) return require('./periode.js');
    return root.BudgetPeriode;
  }
  function cent(h) { return Math.round(h * 100); }

  function codeCanon(code) {
    var c = String(code || '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (c === 'M' || c === 'MATIN') return 'M';
    if (c === 'AM' || c === 'A' || c === 'APM' || c === 'APRES-MIDI') return 'AM';
    if (c === 'N' || c === 'NUIT') return 'N';
    if (c === 'J' || c === 'JOURNEE') return 'J';
    if (c === 'R' || c === 'REPOS' || c === '') return 'R';
    return 'R';
  }
  function kindOf(date, code) {
    var canon = codeCanon(code);
    if (canon === 'R') return 'repos';
    var sam = dates().weekday(date) === 6;
    if (canon === 'J') return 'journee';
    if (canon === 'M') return sam ? 'samMatin' : 'matin';
    if (canon === 'AM') return sam ? 'samApm' : 'apm';
    return sam ? 'samNuit' : 'nuit';
  }
  function libelleCourt(date, code) {
    var canon = codeCanon(code);
    if (canon === 'R') return '';
    var txt = canon === 'AM' ? 'AM' : canon;
    return dates().weekday(date) === 6 ? 'Sam. ' + txt : txt;
  }
  function heuresShiftCent(params, date, code) {
    var kind = kindOf(date, code);
    if (kind === 'repos') return 0;
    if (kind === 'journee') return cent(params.heuresJournee);
    return cent(params.heuresPoste);
  }

  function vide() {
    return {
      heuresPayeesCent: 0,
      heuresNuitCent: 0,
      coefSamCent: 0,
      coefFerieCent: 0,
      panierNuit: 0,
      panierJour: 0,
      transport: 0,
      postes: 0,
      postesHoraire: 0,
      samedis: 0,
      journee: 0,
      journeeNet: 0,
      journeeBrut: 0,
      hs25Cent: 0,
      hs50Cent: 0,
      comptes: { matin: 0, apm: 0, nuit: 0, samMatin: 0, samApm: 0, samNuit: 0, journee: 0 },
      feries: []
    };
  }
  function fusionner(a, b) {
    ['heuresPayeesCent', 'heuresNuitCent', 'coefSamCent', 'coefFerieCent', 'hs25Cent', 'hs50Cent',
      'panierNuit', 'panierJour', 'transport', 'postes', 'postesHoraire', 'samedis', 'journee',
      'journeeNet', 'journeeBrut'].forEach(function (k) { a[k] += b[k] || 0; });
    Object.keys(a.comptes).forEach(function (k) { a.comptes[k] += b.comptes[k] || 0; });
    if (b.feries && b.feries.length) a.feries = a.feries.concat(b.feries);
  }
  function cloneAcc(a) {
    var b = vide();
    fusionner(b, a);
    return b;
  }

  function ajouter(acc, params, date, code, ferieNom) {
    var kind = kindOf(date, code);
    if (kind === 'repos') return;
    acc.postes += 1;
    acc.comptes[kind] += 1;
    if (dates().weekday(date) === 6) acc.samedis += 1;
    if (kind === 'journee') {
      acc.journee += 1;
      acc.journeeNet += params.journeeNet;
      acc.journeeBrut += params.journeeBrut;
      return;
    }
    var hc = cent(params.heuresPoste);
    acc.heuresPayeesCent += hc;
    acc.postesHoraire += 1;
    var hNuit = 0;
    if (kind === 'matin' || kind === 'samMatin') hNuit = params.nuitMatin;
    else if (kind === 'nuit') hNuit = params.nuitNuit;
    else if (kind === 'samNuit') hNuit = params.nuitSamNuit;
    acc.heuresNuitCent += cent(hNuit);
    var majSam = 0;
    if (kind === 'samMatin') majSam = params.majSamMatin;
    else if (kind === 'samApm') majSam = params.majSamApm;
    else if (kind === 'samNuit') majSam = params.majSamNuit;
    acc.coefSamCent += hc * majSam;
    var nuit = kind === 'nuit' || kind === 'samNuit';
    if (ferieNom) {
      acc.coefFerieCent += hc;
      acc.feries.push(date);
    }
    if (nuit) acc.panierNuit += 1;
    else if (kind === 'samMatin' || kind === 'samApm' || ferieNom) acc.panierJour += 1;
    acc.transport += 1;
  }

  function simulerAcc(params, acc) {
    var R = params.taux;
    var base = acc.heuresPayeesCent / 100 * R;
    var majNuit = acc.heuresNuitCent / 100 * R * params.majNuit;
    var majSam = acc.coefSamCent / 100 * R;
    var majFerie = acc.coefFerieCent / 100 * R * params.majFerie;
    var hs25 = acc.hs25Cent / 100;
    var hs50 = acc.hs50Cent / 100;
    var majHS = R * (hs25 * params.majHS1 + hs50 * params.majHS2);
    var baseHS = R * (hs25 * (1 + params.majHS1) + hs50 * (1 + params.majHS2));
    var prime = acc.postesHoraire * params.primeEquipe;
    var base13 = base + majNuit + majSam + prime;
    var treizieme = base13 * params.tx13e;
    var baseIFM = base13 + treizieme + majHS + majFerie;
    var ifm = baseIFM * params.txIFM;
    var iccp = (baseIFM - treizieme + ifm) * params.txCP;
    var brutFormule = baseIFM + ifm + iccp;
    var indemn = acc.panierNuit * params.panierNuit + acc.panierJour * params.panierJour + acc.transport * params.transport;
    var cotis = params.txCotis * brutFormule - params.txExoHS * baseHS;
    var netSocial = brutFormule - cotis;
    var netAvant = netSocial + indemn;
    var imposable = netSocial + params.txCsgNonDed * brutFormule - baseHS;
    var pasMontant = params.pas * Math.max(0, imposable);
    var netFormule = netAvant - pasMontant;
    var heuresJ = acc.journee * params.heuresJournee;
    return {
      brut: r2(brutFormule + acc.journeeBrut),
      netApresPAS: r2(netFormule + acc.journeeNet),
      netAvantImpot: r2(netAvant + acc.journeeNet),
      cotisations: r2(cotis),
      pas: r2(pasMontant),
      netImposable: r2(imposable),
      indemnites: r2(indemn),
      ifm: r2(ifm),
      iccp: r2(iccp),
      treizieme: r2(treizieme),
      majHS: r2(majHS),
      majFerie: r2(majFerie),
      prime: r2(prime),
      postes: acc.postes,
      postesHoraire: acc.postesHoraire,
      heures: r2(acc.heuresPayeesCent / 100 + heuresJ),
      hs25: r2(hs25),
      hs50: r2(hs50),
      samedis: acc.samedis,
      paniersNuit: acc.panierNuit,
      paniersJour: acc.panierJour,
      comptes: Object.assign({}, acc.comptes),
      feries: acc.feries.slice(),
      journeeNet: r2(acc.journeeNet),
      journeeBrut: r2(acc.journeeBrut),
      _net: netFormule + acc.journeeNet,
      _brut: brutFormule + acc.journeeBrut
    };
  }

  function famillesDe(comptes) {
    return {
      matin: (comptes.matin || 0) + (comptes.samMatin || 0),
      apm: (comptes.apm || 0) + (comptes.samApm || 0),
      nuit: (comptes.nuit || 0) + (comptes.samNuit || 0),
      journee: comptes.journee || 0
    };
  }

  function listePostes(planning) {
    return Object.keys(planning || {}).filter(function (d) {
      return /^\d{4}-\d{2}-\d{2}$/.test(d);
    }).sort().map(function (d) {
      return { date: d, code: codeCanon(planning[d]) };
    }).filter(function (s) { return s.code !== 'R'; });
  }

  /* annee + mois = mois civil du travail (1-12). Les semaines à cheval
     utilisent le planning complet : les heures sup. sont rattachées au mois
     du poste qui fait passer la semaine au-dessus de hs1Seuil. */
  function calculerMois(paramsIn, planning, annee, mois) {
    var params = normaliser(paramsIn);
    var D = dates();
    var postes = listePostes(planning);
    var parSemaine = {};
    postes.forEach(function (s) {
      var lun = D.lundi(s.date);
      (parSemaine[lun] = parSemaine[lun] || []).push(s);
    });
    function dans(date) {
      var p = D.parse(date);
      return p.y === annee && p.m === mois;
    }

    var total = vide();
    var lignes = [];
    var semaines = [];

    Object.keys(parSemaine).sort().forEach(function (lun) {
      var shifts = parSemaine[lun];
      var heuresSem = 0;
      shifts.forEach(function (s) { heuresSem += heuresShiftCent(params, s.date, s.code); });
      var seuil1 = cent(params.hs1Seuil);
      var seuil2 = cent(params.hs2Seuil);
      var hs25 = Math.max(0, Math.min(heuresSem, seuil2) - seuil1);
      var hs50 = Math.max(0, heuresSem - seuil2);
      var dateBascule = null;
      if (hs25 + hs50 > 0) {
        var cumul = 0;
        for (var i = 0; i < shifts.length; i++) {
          var avant = cumul;
          cumul += heuresShiftCent(params, shifts[i].date, shifts[i].code);
          if (avant < seuil1 && cumul >= seuil1) { dateBascule = shifts[i].date; break; }
        }
      }
      var acc = vide();
      shifts.forEach(function (s) {
        if (!dans(s.date)) return;
        var fer = D.estFerie(s.date);
        ajouter(acc, params, s.date, s.code, fer);
        lignes.push({
          date: s.date,
          code: s.code,
          libelle: libelleCourt(s.date, s.code),
          ferie: fer || ''
        });
      });
      var hsIci = !!(dateBascule && dans(dateBascule));
      if (hsIci) {
        acc.hs25Cent = hs25;
        acc.hs50Cent = hs50;
      }
      if (!acc.postes && !hsIci) return;
      fusionner(total, acc);
      var sim = simulerAcc(params, acc);
      var sans = cloneAcc(acc);
      sans.hs25Cent = 0;
      sans.hs50Cent = 0;
      var gain = sim._net - simulerAcc(params, sans)._net;
      semaines.push({
        lundi: lun,
        dimanche: D.addDays(lun, 6),
        heures: sim.heures,
        heuresSemaine: r2(heuresSem / 100),
        hs25: hsIci ? r2(hs25 / 100) : 0,
        hs50: hsIci ? r2(hs50 / 100) : 0,
        hsDansMois: hsIci,
        postes: acc.postes,
        brut: sim.brut,
        net: sim.netApresPAS,
        gainHS: r2(gain),
        feries: acc.feries.slice()
      });
    });

    var simT = simulerAcc(params, total);
    var sansHS = cloneAcc(total);
    sansHS.hs25Cent = 0;
    sansHS.hs50Cent = 0;
    var gainHS = simT._net - simulerAcc(params, sansHS)._net;

    var sansF = vide();
    postes.forEach(function (s) {
      if (!dans(s.date)) return;
      ajouter(sansF, params, s.date, s.code, '');
    });
    sansF.hs25Cent = total.hs25Cent;
    sansF.hs50Cent = total.hs50Cent;
    var gainFerie = simT._net - simulerAcc(params, sansF)._net;

    lignes.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    var familles = famillesDe(total.comptes);
    return {
      annee: annee,
      mois: mois,
      postes: total.postes,
      comptes: total.comptes,
      familles: familles,
      samedis: total.samedis,
      heures: simT.heures,
      hs25: simT.hs25,
      hs50: simT.hs50,
      brut: simT.brut,
      net: simT.netApresPAS,
      gainHS: r2(gainHS),
      gainFerie: r2(gainFerie),
      feries: total.feries.slice(),
      lignes: lignes,
      semaines: semaines,
      detail: simT
    };
  }

  function parPoste(paramsIn) {
    var params = normaliser(paramsIn);
    function un(date, code) {
      var acc = vide();
      ajouter(acc, params, date, code, '');
      return simulerAcc(params, acc);
    }
    /* Mercredi et samedi sans férié : la majoration de samedi vient du jour. */
    return {
      matin: un('2026-03-04', 'M'),
      apm: un('2026-03-04', 'AM'),
      nuit: un('2026-03-04', 'N'),
      journee: un('2026-03-04', 'J'),
      samMatin: un('2026-03-07', 'M'),
      samApm: un('2026-03-07', 'AM'),
      samNuit: un('2026-03-07', 'N')
    };
  }

  return {
    DEFAULTS: DEFAULTS,
    normaliser: normaliser,
    codeCanon: codeCanon,
    kindOf: kindOf,
    libelleCourt: libelleCourt,
    calculerMois: calculerMois,
    parPoste: parPoste,
    r2: r2
  };
});
