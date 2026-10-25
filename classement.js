/* Classement des mouvements.
   Règles génériques (mots-clés de catégorie, neutres) dans ce fichier.
   Les règles par commerçant viennent du profil et passent devant. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BudgetClassement = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var REGLES_GENERIQUES = [
    { poche: 'courses', mots: ['supermarche', 'epicerie', 'alimentation', 'boulangerie', 'hypermarche', 'primeur'] },
    { poche: 'essence', mots: ['carburant', 'station-service', 'station service', 'essence', 'gasoil', 'gazole'] },
    { poche: 'restau', mots: ['restaurant', 'fast-food', 'fast food', 'fastfood', 'snack', 'brasserie', 'pizzeria', 'cafe'] },
    { poche: 'voiture', mots: ['garage', 'peage', 'controle technique', 'parking', 'stationnement'] },
    { poche: 'activites', mots: ['cinema', 'piscine', 'musee', 'billetterie', 'spectacle'] },
    { poche: 'vape', mots: ['cigarette electronique', 'e-liquide', 'eliquide', 'vape'] },
    { poche: 'perso', mots: ['pharmacie', 'coiffeur', 'pressing'] },
    { poche: 'amendes', mots: ['contravention', 'amende'] }
  ];

  function norm(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[_*]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function echappe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function hit(texte, mot) {
    var n = norm(texte);
    var m = norm(mot);
    if (m.length < 4) return false;
    if (m.indexOf(' ') >= 0 || m.length >= 6) return n.indexOf(m) >= 0;
    return new RegExp('(^|[^a-z0-9])' + echappe(m) + '([^a-z0-9]|$)').test(n);
  }
  function ibanPresent(v) {
    return String(v || '').replace(/[^0-9a-z]/gi, '').length >= 8;
  }
  function estInterne(m) {
    if (ibanPresent(m && m.iban)) return false;
    var n = norm((m && (m.partenaire || m.libelle)) || '');
    return /^(vers|de|to|from)\s+\S/.test(n);
  }
  function pocheExiste(profil, id) {
    if (id === 'compte') return true;
    return ((profil && profil.poches) || []).some(function (p) { return p.id === id; });
  }
  function texteMouvement(m) {
    return norm([m.partenaire, m.reference, m.type].filter(Boolean).join(' '));
  }
  function matchPerso(m, regles) {
    var texte = texteMouvement(m);
    for (var i = 0; i < regles.length; i++) {
      var r = regles[i];
      if (!r || r.actif === false) continue;
      var mot = norm(r.contient || '');
      if (mot && texte.indexOf(mot) >= 0) return r;
    }
    return null;
  }
  function matchEspace(m, profil) {
    var e = norm(m.espace || '');
    if (!e) return null;
    if (/^(main|primary|compte principal|espace principal|compte courant|n26|spaces)$/.test(e)) return null;
    var ps = (profil && profil.poches) || [];
    for (var i = 0; i < ps.length; i++) {
      var n = norm(ps[i].nom);
      var id = norm(ps[i].id).replace(/-/g, ' ');
      if (!n) continue;
      if (e === n || e === id) return ps[i].id;
      if (n.length >= 4 && (e.indexOf(n) >= 0 || n.indexOf(e) >= 0)) return ps[i].id;
    }
    return null;
  }
  function matchGenerique(m, profil) {
    var texte = [m.partenaire, m.reference, m.type].filter(Boolean).join(' ');
    var trouves = [];
    REGLES_GENERIQUES.forEach(function (r) {
      if (!pocheExiste(profil, r.poche)) return;
      if (r.mots.some(function (mot) { return hit(texte, mot); })) trouves.push(r.poche);
    });
    return trouves;
  }

  /* reglesLocales passent devant celles du profil (choix enregistrés sur l'appareil). */
  function classer(m, profil, reglesLocales) {
    m = m || {};
    if (estInterne(m)) {
      return { poche: null, ignore: true, douteux: false, categorie: 'interne', source: 'interne', motif: 'Virement entre Espaces' };
    }
    var regles = (reglesLocales || []).concat((profil && profil.regles) || []);
    var perso = matchPerso(m, regles);
    if (perso && pocheExiste(profil, perso.poche)) {
      return { poche: perso.poche, ignore: false, douteux: false, categorie: 'depense', source: 'profil', motif: 'Règle du profil' };
    }
    var esp = matchEspace(m, profil);
    if (esp) {
      return { poche: esp, ignore: false, douteux: false, categorie: 'depense', source: 'espace', motif: 'Espace N26' };
    }
    var gens = matchGenerique(m, profil);
    if (gens.length >= 1) {
      return {
        poche: gens[0], ignore: false, douteux: true, categorie: 'depense',
        source: 'generique', motif: gens.length > 1 ? 'Plusieurs mots-clés' : 'Mot-clé'
      };
    }
    if (Number(m.montant) > 0) {
      return { poche: null, ignore: false, douteux: false, categorie: 'revenu', source: 'revenu', motif: 'Entrée d\'argent' };
    }
    return { poche: null, ignore: false, douteux: true, categorie: 'depense', source: 'aucune', motif: 'À classer' };
  }

  return {
    REGLES_GENERIQUES: REGLES_GENERIQUES,
    norm: norm,
    estInterne: estInterne,
    classer: classer
  };
});
