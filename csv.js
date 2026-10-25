/* Lecture d'un export CSV N26 (en-têtes anglais ou français)
   et d'un texte de relevé déjà extrait. Tout reste en local. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BudgetCsv = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function norm(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  var ALIAS = {
    date: ['booking date', 'date', 'date de reservation', 'date de comptabilisation', 'date d operation', 'date operation', 'jour'],
    partenaire: ['partner name', 'payee', 'beneficiaire', 'nom du partenaire', 'partenaire', 'contrepartie', 'nom du beneficiaire', 'libelle', 'description'],
    iban: ['partner iban', 'iban du partenaire', 'iban partenaire', 'iban'],
    type: ['type', 'transaction type', 'type de transaction', 'mode de paiement', 'payment type'],
    reference: ['payment reference', 'reference de paiement', 'reference', 'communication', 'motif'],
    espace: ['account name', 'space name', 'nom du compte', 'nom de l espace', 'espace', 'space'],
    montant: ['amount (eur)', 'montant (eur)', 'amount eur', 'montant eur', 'amount', 'montant', 'valeur']
  };

  function detecterSep(ligne) {
    var meilleur = ',';
    var score = -1;
    [',', ';', '\t'].forEach(function (sep) {
      var n = 0;
      var q = false;
      for (var i = 0; i < ligne.length; i++) {
        var c = ligne[i];
        if (c === '"') q = !q;
        else if (!q && c === sep) n++;
      }
      if (n > score) { score = n; meilleur = sep; }
    });
    return meilleur;
  }
  function parseLigne(ligne, sep) {
    var out = [];
    var cur = '';
    var q = false;
    for (var i = 0; i < ligne.length; i++) {
      var c = ligne[i];
      if (q) {
        if (c === '"') {
          if (ligne[i + 1] === '"') { cur += '"'; i++; }
          else q = false;
        } else cur += c;
      } else if (c === '"') q = true;
      else if (c === sep) { out.push(cur); cur = ''; }
      else cur += c;
    }
    out.push(cur);
    return out.map(function (s) { return s.trim(); });
  }
  function lignes(texte) {
    return String(texte || '')
      .replace(/^\uFEFF/, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .filter(function (l, i, a) { return l.length && (l.trim() || i === 0); });
  }

  function trouverCol(headers, aliases, exclure) {
    var h = headers.map(norm);
    var a, i;
    for (a = 0; a < aliases.length; a++) {
      i = h.indexOf(aliases[a]);
      if (i >= 0 && !(exclure && exclure.test(h[i]))) return i;
    }
    for (a = 0; a < aliases.length; a++) {
      for (i = 0; i < h.length; i++) {
        if (exclure && exclure.test(h[i])) continue;
        if (h[i].indexOf(aliases[a]) >= 0) return i;
      }
    }
    return -1;
  }

  function montant(v) {
    if (typeof v === 'number') return isFinite(v) ? Math.round(v * 100) / 100 : null;
    var s = String(v == null ? '' : v).trim();
    if (!s) return null;
    s = s.replace(/[\s\u00a0\u202f]/g, '').replace(/€/g, '').replace(/eur/ig, '');
    s = s.replace(/−/g, '-').replace(/–/g, '-');
    if (/^\(.*\)$/.test(s)) s = '-' + s.slice(1, -1);
    var lastComma = s.lastIndexOf(',');
    var lastDot = s.lastIndexOf('.');
    if (lastComma >= 0 && lastDot >= 0) {
      if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
      else s = s.replace(/,/g, '');
    } else if (lastComma >= 0) {
      if (/,\d{1,2}$/.test(s)) s = s.replace(',', '.');
      else s = s.replace(/,/g, '');
    }
    if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
    var n = parseFloat(s);
    return isFinite(n) ? Math.round(n * 100) / 100 : null;
  }

  function parseDate(v) {
    var s = String(v || '').trim();
    var iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return iso[1] + '-' + iso[2] + '-' + iso[3];
    var dmy = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
    if (dmy) {
      var d = ('0' + dmy[1]).slice(-2);
      var m = ('0' + dmy[2]).slice(-2);
      return dmy[3] + '-' + m + '-' + d;
    }
    return '';
  }

  function parser(texte) {
    var ls = lignes(texte);
    if (!ls.length) return { separateur: ',', mouvements: [], erreurs: ['fichier vide'] };
    var sep = detecterSep(ls[0]);
    var rows = ls.map(function (l) { return parseLigne(l, sep); }).filter(function (r) {
      return r.some(function (c) { return c.trim(); });
    });
    if (!rows.length) return { separateur: sep, mouvements: [], erreurs: ['fichier vide'] };
    var headers = rows[0];
    var idx = {
      date: trouverCol(headers, ALIAS.date, /valeur|value/),
      partenaire: trouverCol(headers, ALIAS.partenaire),
      iban: trouverCol(headers, ALIAS.iban),
      type: trouverCol(headers, ALIAS.type),
      reference: trouverCol(headers, ALIAS.reference),
      espace: trouverCol(headers, ALIAS.espace),
      montant: trouverCol(headers, ALIAS.montant)
    };
    if (idx.date < 0 || idx.montant < 0) {
      return { separateur: sep, mouvements: [], erreurs: ['colonnes date et montant introuvables'] };
    }
    var mouvements = [];
    var erreurs = [];
    for (var i = 1; i < rows.length; i++) {
      var r = rows[i];
      var date = parseDate(r[idx.date]);
      var mont = montant(r[idx.montant]);
      if (!date || mont == null) {
        if (r.join('').trim()) erreurs.push(i + 1);
        continue;
      }
      function col(k) { return idx[k] >= 0 ? (r[idx[k]] || '').trim() : ''; }
      mouvements.push({
        date: date,
        partenaire: col('partenaire'),
        iban: col('iban'),
        type: col('type'),
        reference: col('reference'),
        espace: col('espace'),
        montant: mont
      });
    }
    return { separateur: sep, mouvements: mouvements, erreurs: erreurs };
  }

  /* Lignes déjà extraites d'un PDF : « LIBELLÉ 12.10.2026 − 10,00 € ». */
  var RX = /^(.*?)\s+(\d{2}[./-]\d{2}[./-]\d{4})\s+([+\-−–])\s*(\d[\d\s\u00a0\u202f.,]*[.,]\d{2})\s*€?\s*$/;
  function parserTexte(texte) {
    var ops = [];
    String(texte || '').split(/\n/).forEach(function (ligne) {
      var t = ligne.replace(/\s+/g, ' ').trim();
      var m = t.match(RX);
      if (!m) return;
      var negatif = /-|−|–/.test(m[3]);
      var mont = montant((negatif ? '-' : '') + m[4]);
      var date = parseDate(m[2]);
      if (!date || mont == null) return;
      if (!negatif) mont = Math.abs(mont);
      ops.push({
        date: date,
        partenaire: m[1].trim(),
        iban: '',
        type: '',
        reference: '',
        espace: '',
        montant: mont
      });
    });
    return ops;
  }

  return {
    parser: parser,
    parserTexte: parserTexte,
    montant: montant,
    parseDate: parseDate,
    norm: norm
  };
});
