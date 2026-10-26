/* Bilan d'un mois budgétaire : paie, poches, compte courant, objectifs.
   Les montants viennent du profil et des mouvements déjà classés. */
(function (root, factory) {
  var api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BudgetModele = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  function deps() {
    if (typeof module !== 'undefined' && module.exports) {
      return { C: require('./calc.js'), P: require('./periode.js') };
    }
    return { C: root.BudgetCalc, P: root.BudgetPeriode };
  }
  function r2(x) { return Math.round((x + Number.EPSILON) * 100) / 100; }
  function num(v) {
    var n = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.'));
    return isFinite(n) ? n : 0;
  }

  function normaliserProfil(p) {
    var d = deps();
    p = p && typeof p === 'object' ? p : {};
    var t = p.tresorier || {};
    return {
      type: 'budget-profil',
      version: 1,
      exemple: !!p.exemple,
      prenom: p.prenom || '',
      initiales: (p.initiales || '').slice(0, 3),
      equipe: p.equipe || '',
      tresorier: { nom: t.nom || '', email: t.email || '' },
      paie: d.C.normaliser(p.paie || {}),
      tampon: Math.max(0, num(p.tampon)),
      fixes: Array.isArray(p.fixes) ? p.fixes : [],
      poches: Array.isArray(p.poches) ? p.poches : [],
      objectifs: Array.isArray(p.objectifs) ? p.objectifs : [],
      regles: Array.isArray(p.regles) ? p.regles : [],
      planning: p.planning && typeof p.planning === 'object' ? p.planning : {},
      horaires: p.horaires && typeof p.horaires === 'object' ? p.horaires : {}
    };
  }

  function planningEffectif(profil, local) {
    var o = Object.assign({}, (profil && profil.planning) || {});
    Object.keys(local || {}).forEach(function (k) {
      if (local[k]) o[k] = local[k];
    });
    return o;
  }

  function budgetPoche(poche, soldeReserve) {
    var b = Math.max(0, num(poche.budget));
    if ((poche.role || '') === 'reserve' && poche.plafond != null && poche.plafond !== '') {
      var place = Math.max(0, num(poche.plafond) - num(soldeReserve));
      b = Math.min(b, place);
    }
    return r2(b);
  }

  function mouvementsMois(mouvements, per) {
    return (mouvements || []).filter(function (m) {
      return m && m.date >= per.debut && m.date <= per.fin;
    });
  }

  function depensePoche(mouvements, per, pocheId) {
    return r2(mouvementsMois(mouvements, per).filter(function (m) {
      return !m.ignore && m.categorie !== 'revenu' && m.categorie !== 'interne' && m.poche === pocheId;
    }).reduce(function (s, m) { return s - num(m.montant); }, 0));
  }

  function epargneObjectif(obj, etat) {
    var versements = (etat.versements || []).filter(function (v) { return v.objectifId === obj.id; });
    var balayages = (etat.balayages || []).filter(function (b) { return b.objectifId === obj.id; });
    return r2(num(obj.epargne) +
      versements.reduce(function (s, v) { return s + num(v.montant); }, 0) +
      balayages.reduce(function (s, b) { return s + num(b.montant); }, 0));
  }

  function bilan(profilIn, etat, per) {
    var d = deps();
    var profil = normaliserProfil(profilIn);
    etat = etat || {};
    var planning = planningEffectif(profil, etat.planningLocal);
    var paie = d.C.calculerMois(profil.paie, planning, per.annee, per.mois);
    var prec = d.P.moisPrecedent(per);
    var paiePrecedente = d.C.calculerMois(profil.paie, planning, prec.annee, prec.mois);
    var bulletin = etat.bulletins && etat.bulletins[prec.id];
    var aBulletin = bulletin != null && bulletin !== '';
    var paieRecue = aBulletin ? num(bulletin) : paiePrecedente.net;

    var filet = (profil.poches || []).filter(function (p) { return p.role === 'reserve'; })[0];
    var soldeReserve = 0;
    if (filet) soldeReserve = etat.filetSolde != null && etat.filetSolde !== '' ? num(etat.filetSolde) : num(filet.solde);

    var poches = profil.poches.map(function (poche) {
      var budget = budgetPoche(poche, poche.role === 'reserve' ? soldeReserve : 0);
      var dep = depensePoche(etat.mouvements, per, poche.id);
      return {
        id: poche.id,
        nom: poche.nom || poche.id,
        court: poche.court || poche.nom || poche.id,
        role: poche.role || 'depense',
        budget: budget,
        budgetMensuel: r2(num(poche.budget)),
        depense: dep,
        reste: r2(budget - dep),
        plafond: poche.plafond != null && poche.plafond !== '' ? num(poche.plafond) : null,
        solde: poche.role === 'reserve' ? r2(soldeReserve) : null,
        jour: poche.jour || 11
      };
    });

    var vire11 = r2(poches.reduce(function (s, p) { return s + p.budget; }, 0));
    var fixes = (profil.fixes || []).map(function (f) {
      return {
        id: f.id || f.nom,
        nom: f.nom || 'Charge',
        montant: r2(num(f.montant)),
        jour: f.jour || 1,
        date: d.P.dateDansPeriode(per, f.jour || 1)
      };
    });
    var fixesTotal = r2(fixes.reduce(function (s, f) { return s + f.montant; }, 0));

    var objectifs = profil.objectifs.map(function (o, i) {
      var ep = epargneObjectif(o, etat);
      var cible = r2(num(o.cible));
      return {
        id: o.id || ('obj' + (i + 1)),
        nom: o.nom || ('Objectif ' + (i + 1)),
        cible: cible,
        mensuel: r2(num(o.mensuel)),
        epargne: ep,
        reste: r2(Math.max(0, cible - ep)),
        atteint: cible > 0 && ep >= cible - 0.001,
        jour: o.jour || 12,
        ordre: i + 1
      };
    });
    var actif = null;
    for (var i = 0; i < objectifs.length; i++) {
      if (!objectifs[i].atteint) { actif = objectifs[i]; break; }
    }
    var vire12 = 0;
    if (actif) vire12 = r2(Math.min(actif.mensuel, actif.reste));

    var depenseCompte = depensePoche(etat.mouvements, per, 'compte');
    var balayageFait = r2((etat.balayages || []).filter(function (b) {
      return b.periode === per.id;
    }).reduce(function (s, b) { return s + num(b.montant); }, 0));
    var sortie = Math.max(depenseCompte, fixesTotal);
    var soldeActuel = r2(paieRecue - vire11 - vire12 - depenseCompte - balayageFait);
    var soldeProjete = r2(paieRecue - vire11 - vire12 - sortie - balayageFait);
    var aBalayer = r2(Math.max(0, soldeProjete - profil.tampon));
    var alerteTampon = soldeActuel < profil.tampon - 0.001;

    var aDepenser = poches.filter(function (p) { return p.role === 'depense'; });
    var reste = r2(aDepenser.reduce(function (s, p) { return s + p.reste; }, 0));
    var sur = r2(aDepenser.reduce(function (s, p) { return s + p.budget; }, 0));

    return {
      periode: per,
      profil: profil,
      planning: planning,
      paie: paie,
      verseLe: d.P.datePaie(per),
      paiePrecedente: paiePrecedente,
      paieRecue: r2(paieRecue),
      paieRecueEstimee: !aBulletin,
      moisPaieRecue: prec,
      poches: poches,
      vire11: vire11,
      fixes: fixes,
      fixesTotal: fixesTotal,
      objectifs: objectifs,
      objectifActif: actif,
      vire12: vire12,
      depenseCompte: depenseCompte,
      tampon: profil.tampon,
      soldeCompte: soldeActuel,
      soldeProjete: soldeProjete,
      aBalayer: aBalayer,
      balayageFait: balayageFait,
      alerteTampon: alerteTampon,
      resteADepenser: reste,
      budgetDepenses: sur
    };
  }

  function prochainPrelevement(bilanMois, aujourdHui) {
    var liste = (bilanMois.fixes || []).filter(function (f) {
      return f.date >= aujourdHui && f.date <= bilanMois.periode.fin;
    }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    return liste[0] || null;
  }

  return {
    normaliserProfil: normaliserProfil,
    planningEffectif: planningEffectif,
    budgetPoche: budgetPoche,
    mouvementsMois: mouvementsMois,
    bilan: bilan,
    prochainPrelevement: prochainPrelevement,
    r2: r2,
    num: num
  };
});
