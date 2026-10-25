/* Dates, mois budgétaire (du 9 au 8) et jours fériés français.
   Aucune donnée personnelle : uniquement le calendrier. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BudgetPeriode = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var JOUR_DEBUT = 9;

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(y, m, d) { return y + '-' + pad(m) + '-' + pad(d); }
  function parse(s) {
    var p = String(s || '').split('-');
    return { y: +p[0] || 0, m: +p[1] || 0, d: +p[2] || 0 };
  }
  function utc(s) {
    var p = parse(s);
    return new Date(Date.UTC(p.y, p.m - 1, p.d));
  }
  function fromUtc(dt) {
    return iso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }
  function valide(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false;
    var p = parse(s);
    if (p.m < 1 || p.m > 12 || p.d < 1) return false;
    return fromUtc(utc(s)) === s;
  }
  function addDays(s, n) {
    var dt = utc(s);
    dt.setUTCDate(dt.getUTCDate() + n);
    return fromUtc(dt);
  }
  function addMonths(y, m, delta) {
    var i = y * 12 + (m - 1) + delta;
    var yy = Math.floor(i / 12);
    var mm = i - yy * 12;
    return { y: yy, m: mm + 1 };
  }
  function dernierJour(y, m) {
    return new Date(Date.UTC(y, m, 0)).getUTCDate();
  }
  function weekday(s) { return utc(s).getUTCDay(); }
  function lundi(s) {
    var d = weekday(s);
    return addDays(s, d === 0 ? -6 : 1 - d);
  }

  /* Mois de paie : du 9 inclus au 8 du mois suivant inclus. */
  function periodeDe(dateIso, jourDebut) {
    var debutJour = jourDebut || JOUR_DEBUT;
    var p = parse(dateIso);
    var y = p.y;
    var m = p.m;
    if (p.d < debutJour) {
      var prev = addMonths(y, m, -1);
      y = prev.y;
      m = prev.m;
    }
    var suiv = addMonths(y, m, 1);
    return {
      debut: iso(y, m, debutJour),
      fin: iso(suiv.y, suiv.m, debutJour - 1),
      annee: y,
      mois: m,
      id: y + '-' + pad(m),
      jourDebut: debutJour
    };
  }
  function dansPeriode(dateIso, per) {
    return !!dateIso && dateIso >= per.debut && dateIso <= per.fin;
  }
  function moisSuivant(per) {
    var n = addMonths(per.annee, per.mois, 1);
    return periodeDe(iso(n.y, n.m, per.jourDebut || JOUR_DEBUT), per.jourDebut);
  }
  function moisPrecedent(per) {
    var n = addMonths(per.annee, per.mois, -1);
    return periodeDe(iso(n.y, n.m, per.jourDebut || JOUR_DEBUT), per.jourDebut);
  }
  /* La paie du travail de ce mois budgétaire est versée le 9 du mois suivant. */
  function datePaie(per) {
    var n = addMonths(per.annee, per.mois, 1);
    return iso(n.y, n.m, per.jourDebut || JOUR_DEBUT);
  }
  function aujourdHui(date) {
    if (date) return date;
    var d = new Date();
    return iso(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }

  function paques(annee) {
    var a = annee % 19;
    var b = Math.floor(annee / 100);
    var c = annee % 100;
    var d = Math.floor(b / 4);
    var e = b % 4;
    var f = Math.floor((b + 8) / 25);
    var g = Math.floor((b - f + 1) / 3);
    var h = (19 * a + b - d - g + 15) % 30;
    var i = Math.floor(c / 4);
    var k = c % 4;
    var l = (32 + 2 * e + 2 * i - h - k) % 7;
    var m = Math.floor((a + 11 * h + 22 * l) / 451);
    var mois = Math.floor((h + l - 7 * m + 114) / 31);
    var jour = ((h + l - 7 * m + 114) % 31) + 1;
    return iso(annee, mois, jour);
  }

  var cacheFeries = {};
  function feriesAnnee(annee) {
    if (cacheFeries[annee]) return cacheFeries[annee];
    var out = {};
    function add(date, nom) { out[date] = nom; }
    add(iso(annee, 1, 1), 'Jour de l\'an');
    var p = paques(annee);
    add(addDays(p, 1), 'Lundi de Pâques');
    add(iso(annee, 5, 1), 'Fête du Travail');
    add(iso(annee, 5, 8), 'Victoire 1945');
    add(addDays(p, 39), 'Ascension');
    add(addDays(p, 50), 'Lundi de Pentecôte');
    add(iso(annee, 7, 14), 'Fête nationale');
    add(iso(annee, 8, 15), 'Assomption');
    add(iso(annee, 11, 1), 'Toussaint');
    add(iso(annee, 11, 11), 'Armistice');
    add(iso(annee, 12, 25), 'Noël');
    cacheFeries[annee] = out;
    return out;
  }
  function estFerie(dateIso) {
    if (!valide(dateIso)) return '';
    var y = parse(dateIso).y;
    return feriesAnnee(y)[dateIso] || '';
  }

  function joursDuMois(annee, mois) {
    var n = dernierJour(annee, mois);
    var liste = [];
    for (var d = 1; d <= n; d++) liste.push(iso(annee, mois, d));
    return liste;
  }

  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var MOIS_COURT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  var JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

  function capital(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
  function libelleMois(annee, mois) { return capital(MOIS[mois - 1]) + ' ' + annee; }
  function libellePeriode(per) { return libelleMois(per.annee, per.mois); }
  function dateCourte(s) {
    var p = parse(s);
    return p.d + ' ' + MOIS_COURT[p.m - 1];
  }
  function dateLongue(s) {
    var p = parse(s);
    return capital(JOURS[weekday(s)]) + ' ' + p.d + ' ' + MOIS[p.m - 1];
  }
  function joursEntre(a, b) {
    return Math.round((utc(b) - utc(a)) / 86400000);
  }
  /* Jour d'un prélèvement dans le mois budgétaire : le 9 ou après tombe
     dans le mois de début, le 1 au 8 tombe dans le mois suivant. */
  function dateDansPeriode(per, jour) {
    var j = Math.round(jour);
    if (j >= per.jourDebut) return iso(per.annee, per.mois, j);
    var suiv = addMonths(per.annee, per.mois, 1);
    return iso(suiv.y, suiv.m, j);
  }

  return {
    JOUR_DEBUT: JOUR_DEBUT,
    iso: iso, parse: parse, valide: valide, pad: pad,
    addDays: addDays, addMonths: addMonths, dernierJour: dernierJour,
    weekday: weekday, lundi: lundi,
    periodeDe: periodeDe, dansPeriode: dansPeriode,
    moisSuivant: moisSuivant, moisPrecedent: moisPrecedent,
    datePaie: datePaie, aujourdHui: aujourdHui,
    paques: paques, feriesAnnee: feriesAnnee, estFerie: estFerie,
    joursDuMois: joursDuMois,
    MOIS: MOIS, MOIS_COURT: MOIS_COURT, JOURS: JOURS,
    libelleMois: libelleMois, libellePeriode: libellePeriode,
    dateCourte: dateCourte, dateLongue: dateLongue, joursEntre: joursEntre,
    dateDansPeriode: dateDansPeriode
  };
});
