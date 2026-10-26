'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const P = require('../periode.js');
const M = require('../modele.js');

const profil = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'profil.exemple.json'), 'utf8'));

test('une surcharge locale remplace les fixes, une poche et l\'ordre des objectifs', () => {
  const per = P.periodeDe('2026-10-20');
  const etat = {
    surcharge: {
      tampon: 10,
      fixes: [{ id: 'loyer', nom: 'Loyer test', montant: 100, jour: 5 }],
      poches: { courses: { budget: 70 } },
      objectifs: {
        'projet-b': { ordre: 1, cible: 200, mensuel: 15, epargne: 0 },
        'projet-a': { ordre: 2 }
      }
    }
  };
  const b = M.bilan(profil, etat, per);
  assert.equal(b.tampon, 10);
  assert.equal(b.fixes.length, 1);
  assert.equal(b.fixes[0].nom, 'Loyer test');
  assert.equal(b.fixes[0].montant, 100);
  assert.equal(b.fixes[0].date, '2026-11-05');
  const courses = b.poches.find((p) => p.id === 'courses');
  assert.equal(courses.budget, 70);
  assert.equal(b.objectifs[0].id, 'projet-b');
  assert.equal(b.objectifs[0].mensuel, 15);
  assert.equal(b.objectifs[1].id, 'projet-a');
  assert.equal(b.vire12, 15);
  const exporte = M.appliquerSurcharge(profil, etat.surcharge);
  assert.equal(exporte.poches.find((p) => p.id === 'courses').budget, 70);
  assert.equal(exporte.fixes[0].jour, 5);
});

test('réimporter le même mouvement le marque en doublon sans l\'ajouter', () => {
  const ligne = {
    date: '2026-10-12', partenaire: 'SUPERMARCHE EXEMPLE', montant: -34.5,
    reference: 'Ticket', poche: 'courses', ignore: false, categorie: 'depense', hors: false
  };
  const existants = [{ date: '2026-10-12', partenaire: 'Supermarché Exemple', montant: -34.5, reference: 'Ticket' }];
  const marques = M.marquerDoublons([
    ligne,
    Object.assign({}, ligne, { reference: 'Autre' })
  ], existants);
  assert.equal(marques[0].doublon, true);
  assert.equal(marques[1].doublon, false);
  const doubles = M.marquerDoublons([ligne, Object.assign({}, ligne)], []);
  assert.equal(doubles[0].doublon, false);
  assert.equal(doubles[1].doublon, true);
  assert.equal(M.lignesAImporter(marques).length, 1);
  marques[0].forcer = true;
  assert.equal(M.lignesAImporter(marques).length, 2);
  const sansPoche = M.lignesAImporter([{ date: '2026-10-12', partenaire: 'X', montant: -1, reference: '', poche: null, ignore: false, categorie: 'depense', hors: false, doublon: false }]);
  assert.equal(sansPoche.length, 0);
});
