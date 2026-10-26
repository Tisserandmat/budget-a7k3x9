'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const P = require('../periode.js');

test('le mois budgétaire va du 9 au 8', () => {
  const oct8 = P.periodeDe('2026-10-08');
  assert.equal(oct8.debut, '2026-09-09');
  assert.equal(oct8.fin, '2026-10-08');
  assert.equal(oct8.id, '2026-09');

  const oct9 = P.periodeDe('2026-10-09');
  assert.equal(oct9.debut, '2026-10-09');
  assert.equal(oct9.fin, '2026-11-08');
  assert.equal(oct9.id, '2026-10');

  const nov8 = P.periodeDe('2026-11-08');
  assert.equal(nov8.id, '2026-10');
  const nov9 = P.periodeDe('2026-11-09');
  assert.equal(nov9.debut, '2026-11-09');
  assert.equal(nov9.fin, '2026-12-08');

  const jan5 = P.periodeDe('2026-01-05');
  assert.equal(jan5.debut, '2025-12-09');
  assert.equal(jan5.fin, '2026-01-08');
  assert.equal(jan5.id, '2025-12');
});

test('la paie du mois est versée le 9 du mois suivant', () => {
  const nov = P.periodeDe('2026-11-15');
  assert.equal(P.datePaie(nov), '2026-12-09');
  assert.equal(P.moisPrecedent(nov).id, '2026-10');
  assert.equal(P.moisSuivant(nov).id, '2026-12');
});

test('jours fériés français', () => {
  assert.equal(P.paques(2026), '2026-04-05');
  assert.equal(P.estFerie('2026-11-01'), 'Toussaint');
  assert.equal(P.estFerie('2026-11-11'), 'Armistice');
  assert.equal(P.estFerie('2026-08-15'), 'Assomption');
  assert.equal(P.estFerie('2026-11-12'), '');
  assert.equal(P.weekday('2026-11-11'), 3);
  assert.equal(P.weekday('2026-08-15'), 6);
  assert.equal(P.lundi('2026-11-11'), '2026-11-09');
  assert.equal(P.lundi('2026-11-01'), '2026-10-26');
});

test('un prélèvement du 5 tombe dans le mois suivant du budget', () => {
  const oct = P.periodeDe('2026-10-20');
  assert.equal(P.dateDansPeriode(oct, 28), '2026-10-28');
  assert.equal(P.dateDansPeriode(oct, 5), '2026-11-05');
});
