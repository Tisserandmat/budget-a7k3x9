'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function fichiersSuivis() {
  return execSync('git ls-files --cached --others --exclude-standard', { encoding: 'utf8' })
    .split('\n')
    .map((f) => f.trim())
    .filter(Boolean)
    .filter((f) => !f.startsWith('vendor/'))
    .filter((f) => /\.(js|html|css|json|md|csv|webmanifest|txt)$/.test(f));
}

test('le dépôt suivi ne contient pas de donnée personnelle', () => {
  const interdits = [
    'Math' + 'ias',
    '13' + '.91',
    '13' + ',91',
    '3' + '225,96',
    '3' + '225.96',
    '3225' + '.96',
    '4166' + '.41',
    'Coff' + 'reo',
    'Rands' + 'tad',
    'Trott' + 'inette',
    'Mac' + 'Book'
  ];
  const fichiers = fichiersSuivis();
  assert.ok(fichiers.length > 5);
  fichiers.forEach((f) => {
    const texte = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    interdits.forEach((mot) => {
      assert.equal(texte.toLowerCase().includes(mot.toLowerCase()), false, f + ' contient un marqueur privé');
    });
    const courriels = texte.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
    courriels.forEach((e) => {
      const domaine = e.split('@')[1];
      assert.match(domaine, /^(example\.(com|org|net)|localhost)$/i, f + ' : ' + e);
    });
    assert.equal(/\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/.test(texte), false, f + ' ressemble à un IBAN');
  });
});

test('le profil d\'exemple est fictif et documenté', () => {
  const profil = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'profil.exemple.json'), 'utf8'));
  assert.equal(profil.type, 'budget-profil');
  assert.equal(profil.exemple, true);
  assert.equal(profil.paie.taux, 12);
  const ids = profil.poches.map((p) => p.id);
  ['courses', 'essence', 'restau', 'perso', 'voiture', 'vape', 'activites', 'filet', 'amendes'].forEach((id) => {
    assert.ok(ids.includes(id), id);
  });
  const filet = profil.poches.find((p) => p.id === 'filet');
  assert.ok(filet.plafond > 0);
  assert.equal(profil.poches.find((p) => p.id === 'amendes').budget, 0);
  assert.ok(profil.objectifs.length >= 2);
  assert.ok(profil.fixes.length >= 1);
  assert.equal(typeof profil.tampon, 'number');
  assert.match(profil.tresorier.email, /@example\.com$/);
});
