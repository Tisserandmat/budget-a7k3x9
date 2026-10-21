/* Moteur de calcul de paie générique (intérim, travail posté).
   Valeurs par défaut neutres : tous les montants sont à 0, à remplir via Réglages ou par import de profil.
   Les pourcentages marqués « exemple » sont des valeurs génériques à vérifier sur ta propre fiche de paie. */
(function (root) {
  var DEFAULTS = {
    taux: 0,              // € brut/h : à renseigner
    heuresPoste: 7,       // exemple : heures payées par poste
    nuitMatin: 0,         // heures de nuit dans un poste du matin
    nuitNuit: 7,          // exemple : heures de nuit dans un poste de nuit
    nuitSamNuit: 7,       // exemple : heures de nuit dans un samedi nuit
    majNuit: 0.25,        // exemple : majoration heures de nuit 25 %
    majSamApm: 0,         // majoration samedi après-midi
    majSamMatin: 0,       // majoration samedi matin
    majSamNuit: 0,        // majoration samedi nuit
    primeEquipe: 0,       // prime par poste (€)
    panierNuit: 0,        // panier nuit (€)
    panierJour: 0,        // panier jour (€)
    transport: 0,         // indemnité de transport par poste (€)
    tx13e: 0,             // prime de 13e mois (taux)
    txIFM: 0.10,          // exemple : indemnité de fin de mission 10 %
    txCP: 0.10,           // exemple : congés payés 10 %
    txCotis: 0.22,        // exemple : cotisations salariales / brut
    txExoHS: 0.1131,      // exemple : réduction de cotisations sur heures sup.
    txCsgNonDed: 0.029,   // exemple : CSG/CRDS non déductible
    pas: 0                // taux de prélèvement à la source : à renseigner
  };
  var TYPES = ['matin', 'apm', 'nuit', 'samMatin', 'samApm', 'samNuit'];

  function r2(x) { return Math.round(x * 100) / 100; }

  function simuler(p, c, opts) {
    p = Object.assign({}, DEFAULTS, p || {});
    c = Object.assign({ matin: 0, apm: 0, nuit: 0, samMatin: 0, samApm: 0, samNuit: 0,
      hs25: 0, hs50: 0, ferie: 0, paniersJour: 0, autresHeures: 0 }, c || {});
    opts = Object.assign({ ifmcp: true }, opts || {});
    var R = p.taux, h = p.heuresPoste;
    var postes = c.matin + c.apm + c.nuit + c.samMatin + c.samApm + c.samNuit;
    var base = (postes * h + c.autresHeures) * R;
    var hNuit = (c.matin + c.samMatin) * p.nuitMatin + c.nuit * p.nuitNuit + c.samNuit * p.nuitSamNuit;
    var majNuit = hNuit * R * p.majNuit;
    var majSam = h * R * (c.samApm * p.majSamApm + c.samMatin * p.majSamMatin + c.samNuit * p.majSamNuit);
    var majHS = R * (c.hs25 * 0.25 + c.hs50 * 0.50);
    var hsBase = R * (c.hs25 * 1.25 + c.hs50 * 1.50);
    var majFerie = c.ferie * R * 1.0;
    var prime = postes * p.primeEquipe;
    var salaire = base + majNuit + majSam + majHS + majFerie;
    var treizieme = salaire * p.tx13e;
    var G = salaire + prime + treizieme;
    var ifm = G * p.txIFM;
    var iccp = (G - treizieme + ifm) * p.txCP;
    var brutSans = G, brutAvec = G + ifm + iccp;
    var indemn = (c.nuit + c.samNuit) * p.panierNuit + c.paniersJour * p.panierJour + postes * p.transport;
    function net(brut) {
      var cotis = p.txCotis * brut - p.txExoHS * hsBase;
      var netSocial = brut - cotis;
      var netAvant = netSocial + indemn;
      var imposable = netSocial + p.txCsgNonDed * brut - hsBase;
      var pas = p.pas * imposable;
      return { brut: r2(brut), cotisations: r2(cotis), netSocial: r2(netSocial), indemnites: r2(indemn),
        netAvantImpot: r2(netAvant), netImposable: r2(imposable), pas: r2(pas), netApresPAS: r2(netAvant - pas) };
    }
    var avec = net(brutAvec), sans = net(brutSans);
    var res = Object.assign({}, opts.ifmcp ? avec : sans);
    res.postes = postes; res.ifm = r2(ifm); res.iccp = r2(iccp); res.treizieme = r2(treizieme);
    res.avec = avec; res.sans = sans;
    res.partIFMCPnet = r2(avec.netApresPAS - sans.netApresPAS);
    return res;
  }

  function parPoste(p) {
    var out = {};
    TYPES.forEach(function (t) { var c = {}; c[t] = 1; out[t] = simuler(p, c, { ifmcp: true }); });
    return out;
  }

  var api = { DEFAULTS: DEFAULTS, TYPES: TYPES, simuler: simuler, parPoste: parPoste };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PaieCalc = api;
})(this);
