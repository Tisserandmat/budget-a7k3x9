'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../calc.js');

/* Taux ronds, sans rapport avec un bulletin réel. */
const P = {
  taux: 10,
  heuresPoste: 8,
  heuresJournee: 8,
  nuitMatin: 2,
  nuitNuit: 6,
  nuitSamNuit: 6,
  majNuit: 0.25,
  majSamMatin: 0.25,
  majSamApm: 1,
  majSamNuit: 1.5,
  majFerie: 1,
  primeEquipe: 5,
  panierNuit: 3,
  panierJour: 3,
  transport: 1,
  tx13e: 0.1,
  txIFM: 0.1,
  txCP: 0.1,
  txCotis: 0.2,
  txExoHS: 0.1,
  txCsgNonDed: 0.03,
  pas: 0.1,
  hs1Seuil: 35,
  hs2Seuil: 43,
  majHS1: 0.25,
  majHS2: 0.5,
  journeeNet: 50,
  journeeBrut: 70
};

test('un après-midi isolé suit la formule, IFM et CP inclus', () => {
  const r = C.parPoste(P).apm;
  /* heures 80 + prime 5, 13e 8,50, IFM 9,35, CP 9,435 → brut 112,285 */
  assert.equal(r.brut, 112.29);
  assert.equal(r.treizieme, 8.5);
  assert.equal(r.ifm, 9.35);
  assert.equal(r.netApresPAS, 81.51);
  assert.equal(r.indemnites, 1);
});

test('le 13e ignore le férié et les heures sup., l\'IFM les inclut', () => {
  const ferie = C.calculerMois(P, { '2026-11-11': 'M' }, 2026, 11);
  const ordinaire = C.calculerMois(P, { '2026-11-12': 'M' }, 2026, 11);
  assert.equal(ferie.detail.treizieme, ordinaire.detail.treizieme);
  assert.ok(ferie.detail.ifm > ordinaire.detail.ifm);
  assert.ok(ferie.brut > ordinaire.brut);
  assert.equal(ferie.detail.paniersJour, 1);
  assert.equal(ordinaire.detail.paniersJour, 0);
  assert.ok(ferie.gainFerie > 0);
  assert.equal(ordinaire.gainFerie, 0);
});

test('un samedi férié n\'ouvre qu\'un seul panier', () => {
  const r = C.calculerMois(P, { '2026-08-15': 'M' }, 2026, 8);
  assert.equal(r.detail.paniersJour, 1);
  assert.equal(r.samedis, 1);
  assert.equal(r.lignes[0].libelle, 'Sam. M');
  assert.equal(r.feries.length, 1);
  const nuit = C.calculerMois(P, { '2026-08-15': 'N' }, 2026, 8);
  assert.equal(nuit.detail.paniersNuit, 1);
  assert.equal(nuit.detail.paniersJour, 0);
  assert.equal(nuit.lignes[0].libelle, 'Sam. N');
});

test('les heures sup. se calculent par semaine civile', () => {
  const cinq = {};
  ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'].forEach((d) => { cinq[d] = 'M'; });
  const r5 = C.calculerMois(P, cinq, 2026, 11);
  assert.equal(r5.hs25, 5);
  assert.equal(r5.hs50, 0);
  assert.ok(r5.gainHS > 0);

  const six = Object.assign({}, cinq, { '2026-11-07': 'M' });
  const r6 = C.calculerMois(P, six, 2026, 11);
  assert.equal(r6.hs25, 8);
  assert.equal(r6.hs50, 5);
  assert.ok(r6.gainHS > r5.gainHS);
});

test('une semaine à cheval rattache les heures sup. au mois du franchissement', () => {
  const planning = {
    '2026-11-30': 'N',
    '2026-12-01': 'N',
    '2026-12-02': 'N',
    '2026-12-03': 'N',
    '2026-12-04': 'N'
  };
  const params = Object.assign({}, P, { heuresPoste: 10 });
  const nov = C.calculerMois(params, planning, 2026, 11);
  const dec = C.calculerMois(params, planning, 2026, 12);
  assert.equal(nov.postes, 1);
  assert.equal(nov.hs25, 0);
  assert.equal(nov.hs50, 0);
  assert.equal(dec.postes, 4);
  assert.ok(dec.hs25 > 0);
});

test('le poste Journée est un montant fixe et ses heures comptent pour le seuil', () => {
  const planning = {
    '2026-11-02': 'M',
    '2026-11-03': 'M',
    '2026-11-04': 'M',
    '2026-11-05': 'M',
    '2026-11-06': 'J'
  };
  const r = C.calculerMois(P, planning, 2026, 11);
  assert.equal(r.familles.journee, 1);
  assert.equal(r.hs25, 5);
  assert.equal(r.detail.journeeNet, 50);
  assert.equal(r.detail.journeeBrut, 70);
  const sans = C.calculerMois(P, {
    '2026-11-02': 'M', '2026-11-03': 'M', '2026-11-04': 'M', '2026-11-05': 'M'
  }, 2026, 11);
  assert.ok(Math.abs((r.net - sans.net) - (50 + (r.gainHS - sans.gainHS))) < 0.02);
});

test('les samedis portent le libellé demandé', () => {
  assert.equal(C.libelleCourt('2026-11-07', 'M'), 'Sam. M');
  assert.equal(C.libelleCourt('2026-11-07', 'AM'), 'Sam. AM');
  assert.equal(C.libelleCourt('2026-11-07', 'N'), 'Sam. N');
  assert.equal(C.libelleCourt('2026-11-04', 'M'), 'M');
  assert.equal(C.libelleCourt('2026-11-06', 'J'), 'J');
});

test('profil local non versionné : totaux de référence', () => {
  const fichier = path.join(__dirname, 'fixtures/private/section7.json');
  if (!fs.existsSync(fichier)) return;
  const fx = JSON.parse(fs.readFileSync(fichier, 'utf8'));
  const mois = C.calculerMois(fx.params, fx.planning, fx.annee, fx.mois);
  assert.ok(Math.abs(mois.net - fx.attendu.net) < 0.011, 'net du mois');
  assert.ok(Math.abs(mois.brut - fx.attendu.brut) < 0.011, 'brut du mois');
  assert.ok(Math.abs(mois.hs25 - fx.attendu.hs25) < 0.011, 'heures sup. 25 %');
  assert.ok(Math.abs(mois.hs50 - fx.attendu.hs50) < 0.011, 'heures sup. 50 %');
  assert.equal(mois.postes, fx.attendu.postes);
  assert.ok(Math.abs(mois.gainHS - fx.attendu.gainHS) < 0.02, 'gain heures sup.');
  assert.ok(Math.abs(mois.gainFerie - fx.attendu.gainFerie) < 0.02, 'gain férié');
  fx.attendu.semaines.forEach((s) => {
    const got = mois.semaines.find((w) => w.lundi === s.lundi);
    assert.ok(got, 'semaine ' + s.lundi);
    assert.ok(Math.abs(got.net - s.net) < 0.02, 'net semaine ' + s.lundi);
    assert.ok(Math.abs(got.brut - s.brut) < 0.02, 'brut semaine ' + s.lundi);
  });
  const postes = C.parPoste(fx.params);
  Object.keys(fx.attendu.postesNets).forEach((k) => {
    assert.ok(Math.abs(postes[k].netApresPAS - fx.attendu.postesNets[k]) < 0.011, 'poste ' + k);
  });
  if (fx.cinqMatins) {
    const cinq = C.calculerMois(fx.params, fx.cinqMatins.planning, fx.cinqMatins.annee, fx.cinqMatins.mois);
    assert.ok(Math.abs(cinq.net - fx.cinqMatins.net) < 0.011, 'cinq matins');
    assert.ok(Math.abs(cinq.brut - fx.cinqMatins.brut) < 0.011, 'cinq matins brut');
  }
});
