'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const CSV = require('../csv.js');
const K = require('../classement.js');
const P = require('../periode.js');
const M = require('../modele.js');

const profil = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'profil.exemple.json'), 'utf8'));

test('CSV N26 anglais : séparateur, décimales, mois du 9 au 8', () => {
  const texte = fs.readFileSync(path.join(__dirname, '..', 'exemple-releve.csv'), 'utf8');
  const res = CSV.parser(texte);
  assert.equal(res.separateur, ',');
  assert.equal(res.erreurs.length, 0);
  assert.ok(res.mouvements.length >= 8);
  const per = P.periodeDe('2026-10-20');
  const gardes = res.mouvements.filter((m) => P.dansPeriode(m.date, per));
  const hors = res.mouvements.filter((m) => !P.dansPeriode(m.date, per));
  assert.ok(hors.some((m) => m.date === '2026-10-08'));
  assert.ok(hors.some((m) => m.date === '2026-11-09'));
  assert.ok(gardes.some((m) => m.date === '2026-11-08'));
  assert.ok(gardes.every((m) => m.date >= '2026-10-09' && m.date <= '2026-11-08'));
});

test('CSV français : point-virgule et virgule décimale', () => {
  const texte = [
    'Date de réservation;Date de valeur;Nom du partenaire;IBAN du partenaire;Type;Référence de paiement;Nom du compte;Montant (EUR)',
    '12/10/2026;12/10/2026;SUPERMARCHE EXEMPLE;;Présentation;Ticket;Principal;-18,40',
    '13/10/2026;13/10/2026;Vers Courses;;;Espace;Principal;-120,00'
  ].join('\n');
  const res = CSV.parser(texte);
  assert.equal(res.separateur, ';');
  assert.equal(res.mouvements.length, 2);
  assert.equal(res.mouvements[0].date, '2026-10-12');
  assert.equal(res.mouvements[0].montant, -18.4);
  assert.equal(res.mouvements[0].partenaire, 'SUPERMARCHE EXEMPLE');
  assert.equal(res.mouvements[1].montant, -120);
});

test('le profil l\'emporte sur le mot-clé, les virements Vers/De sont ignorés', () => {
  const texte = fs.readFileSync(path.join(__dirname, '..', 'exemple-releve.csv'), 'utf8');
  const per = P.periodeDe('2026-10-20');
  const classes = CSV.parser(texte).mouvements.map((m) => Object.assign({}, m, K.classer(m, profil, [])));
  const dans = classes.filter((m) => P.dansPeriode(m.date, per));
  const parNom = (nom) => dans.find((m) => m.partenaire === nom);

  assert.equal(parNom('Vers Courses').ignore, true);
  assert.equal(parNom('De Filet').ignore, true);
  assert.equal(parNom('CAFE EXEMPLE').poche, 'perso');
  assert.equal(parNom('CAFE EXEMPLE').source, 'profil');
  assert.equal(parNom('SUPERMARCHE EXEMPLE').poche, 'courses');
  assert.equal(parNom('STATION CARBURANT').poche, 'essence');
  assert.equal(parNom('FAST FOOD EXEMPLE').poche, 'restau');
  assert.equal(parNom('PARKING CENTRE').poche, 'voiture');
  assert.equal(parNom('PHARMACIE EXEMPLE').poche, 'perso');
  assert.equal(parNom('BOULANGERIE EXEMPLE').poche, 'courses');
  assert.equal(parNom('COMMERCE INCONNU').poche, null);
  assert.equal(parNom('COMMERCE INCONNU').douteux, true);
  assert.equal(parNom('EPICERIE DU QUARTIER').poche, 'activites');
  assert.equal(parNom('EPICERIE DU QUARTIER').source, 'espace');

  const avecIban = K.classer({ partenaire: 'Vers Quelquun', iban: 'EX00TEST', montant: -20 }, profil, []);
  assert.equal(avecIban.ignore, false);
});

test('une règle locale enregistrée reclasse le mouvement', () => {
  const m = { partenaire: 'COMMERCE INCONNU', iban: '', montant: -9.9, reference: '', espace: 'Main' };
  const avant = K.classer(m, profil, []);
  assert.equal(avant.poche, null);
  const apres = K.classer(m, profil, [{ contient: 'COMMERCE INCONNU', poche: 'activites' }]);
  assert.equal(apres.poche, 'activites');
  assert.equal(apres.source, 'profil');
});

test('le texte extrait d\'un relevé retrouve la date et le montant', () => {
  const ops = CSV.parserTexte('SUPERMARCHE EXEMPLE 12.10.2026 − 10,50 €\nSTATION CARBURANT 14/10/2026 - 40,00 €\n');
  assert.equal(ops.length, 2);
  assert.equal(ops[0].date, '2026-10-12');
  assert.equal(ops[0].montant, -10.5);
  assert.equal(ops[1].montant, -40);
});

test('après import, poches, reste à dépenser et compte courant bougent', () => {
  const per = P.periodeDe('2026-10-20');
  const mouvs = CSV.parser(fs.readFileSync(path.join(__dirname, '..', 'exemple-releve.csv'), 'utf8'))
    .mouvements
    .filter((m) => P.dansPeriode(m.date, per))
    .map((m) => {
      const c = K.classer(m, profil, []);
      return Object.assign({}, m, c, { poche: c.poche || (c.ignore || c.categorie === 'revenu' ? null : 'compte') });
    });
  const vide = M.bilan(profil, { mouvements: [], bulletins: { '2026-09': 1500 } }, per);
  const plein = M.bilan(profil, { mouvements: mouvs, bulletins: { '2026-09': 1500 } }, per);
  const courses = plein.poches.find((p) => p.id === 'courses');
  assert.ok(courses.depense > 0);
  assert.ok(courses.reste < courses.budget);
  assert.ok(plein.resteADepenser < vide.resteADepenser);
  assert.ok(plein.depenseCompte > 0);
  assert.notEqual(plein.soldeCompte, vide.soldeCompte);
  assert.equal(vide.aBalayer, M.r2(Math.max(0, 1500 - vide.vire11 - vide.vire12 - vide.fixesTotal - vide.tampon)));
});

test('le filet respecte son plafond et les objectifs se suivent', () => {
  const per = P.periodeDe('2026-10-20');
  const plein = M.bilan(profil, { filetSolde: 140, mouvements: [] }, per);
  const filet = plein.poches.find((p) => p.id === 'filet');
  assert.ok(filet.budget < filet.budgetMensuel);
  assert.equal(plein.objectifActif.id, profil.objectifs[0].id);
  const fini = M.bilan(profil, {
    versements: [{ objectifId: profil.objectifs[0].id, montant: 100000, date: '2026-10-12' }]
  }, per);
  assert.equal(fini.objectifActif.id, profil.objectifs[1].id);
});
