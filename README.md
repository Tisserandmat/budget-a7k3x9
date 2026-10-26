# Budget

Application de budget mensuel et d'estimation de paie, en français, utilisable sur iPhone. C'est une PWA : une fois ouverte, elle fonctionne hors ligne. **Tout reste dans le téléphone** (mémoire du navigateur). Il n'y a pas de serveur et pas de compte.

Le dépôt est public. Il ne contient aucun montant réel, aucun IBAN, aucune adresse et aucun nom de commerçant personnel. Ces informations vivent dans un **profil JSON que tu importes** et qui ne doit pas être commité.

## Installer

1. Sers le dossier en HTTPS, ou en local (`python3 -m http.server`), puis ouvre `index.html`.
2. Sur iPhone : Safari → Partager → **Sur l'écran d'accueil**.
3. L'app se relance ensuite sans réseau. Le premier chargement doit avoir vu tous les fichiers (le service worker les met en cache).

## Importer ton profil

Le profil décrit ta paie, tes poches, tes charges, tes objectifs, ton planning et l'adresse suggérée du trésorier.

1. Copie `profil.exemple.json` chez toi, hors du dépôt.
2. Remplace les valeurs fictives par les tiennes. Le format est décrit dans `profil.schema.json` et ci-dessous.
3. Dans l'app : touche les initiales en haut à droite → **Importer un profil JSON**.

Tu peux aussi charger le profil d'exemple pour voir l'app avec des chiffres ronds, clairement marqués comme exemple.

Champs principaux :

| Champ | Rôle |
|---|---|
| `paie` | Taux horaire, heures, majorations, paniers, IFM, congés, cotisations, PAS, seuils d'heures sup., montant fixe d'un poste Journée |
| `tampon` | Minimum à laisser sur le compte courant. Alerte en dessous. Le 8, ce qui dépasse part vers l'objectif |
| `fixes` | Charges du compte courant (nom, montant, jour) |
| `poches` | Enveloppes virées le 11 : budget, et pour le Filet un plafond |
| `objectifs` | Dans l'ordre. Le versement du 12 va au premier qui n'est pas atteint |
| `regles` | Commerçants personnels : `{ "contient": "…", "poche": "courses" }`. Elles passent devant les mots-clés génériques |
| `planning` | Dates `AAAA-MM-JJ` → `M`, `AM`, `N`, `J` ou `R` |
| `tresorier.email` | Destinataire suggéré quand tu partages le mois. Rien n'est envoyé tout seul |

Les identifiants de poches reconnus par les mots-clés du code : `courses`, `essence`, `restau`, `perso`, `voiture`, `vape`, `activites`, `amendes`, `filet`.

## Mois du 9 au 8

Le mois budgétaire suit la paie : il commence le **9** et finit le **8** du mois suivant. Les filtres, le reste à dépenser et l'import ne comptent que les mouvements de cette fenêtre. La paie affichée est celle du travail de ce mois, versée vers le 9 du mois suivant. La carte « Prochaine paie » est toujours une estimation **tout compris** (heures sup. par semaine civile, férié, samedis, IFM, congés payés, et poste Journée au montant du profil).

## Modifier les montants sans réimporter

Sur l'onglet Budget, **Modifier** change les charges fixes (montant, jour du 1 au 28, ajout, suppression) et le budget de chaque poche. Le plafond du filet se règle sur sa poche. Sur Objectifs, chaque ligne a sa cible, son versement du 12, le montant déjà épargné, et les boutons Monter / Descendre.

Ces saisies restent dans le téléphone et passent devant le profil importé. **Exporter le profil** écrit un JSON déjà à jour. **Envoyer à Trésorier** contient les fixes, les poches et les objectifs tels qu'ils sont affichés. Dans les réglages, **Revenir aux montants du profil** efface ces modifications.

## Importer un relevé N26

1. Dans N26, exporte le CSV (en-têtes anglais ou français).
2. Onglet **Budget** → **Importer un relevé N26**, ou **Essayer le relevé d'exemple** (`exemple-releve.csv`, commerçants fictifs).
3. Seuls les mouvements du mois affiché (du 9 au 8) sont proposés.
4. Chaque ligne est classée : règle de ton profil, sinon Espace N26, sinon un mot-clé générique (supermarché, carburant, fast-food…). Les lignes douteuses ou inconnues se corrigent à la main. Coche **Enregistrer comme règle du profil** pour retenir le commerçant sur cet appareil.
5. Les virements `Vers …` / `De …` sans IBAN (transferts entre Espaces) ne comptent pas comme une dépense.
6. Après validation, les poches, le reste à dépenser, le compte courant et les objectifs se mettent à jour.
7. L'historique du mois (du 9 au 8) reste enregistré. On peut le filtrer par poche, le chercher, et reclasser une ligne. Un second import qui contient les mêmes opérations (même date, montant, libellé et référence) les signale comme doublons et ne les ajoute pas, sauf si tu coches « Importer quand même ». Les mouvements déjà classés ne sont pas effacés.

Le PDF est en secours : le texte est lu sur l'appareil avec pdf.js (fichier `vendor/`, licence Apache 2.0). Le CSV reste le format à préférer.

## Envoyer à Trésorier

Le bouton exporte un JSON du mois (postes, paie estimée, poches, mouvements classés, objectifs, « On me doit »). Sur iPhone, la feuille de partage s'ouvre avec le fichier en pièce jointe, pour l'envoyer par Mail au destinataire indiqué dans le profil. Sans cette API, le fichier est téléchargé. Aucun envoi automatique.

## Thème

Le thème suit celui du système au premier lancement. Le bouton à côté des initiales bascule entre jour et nuit ; le choix est mémorisé. Dans les réglages, **Système** revient au réglage du téléphone.

## Tests

```bash
node --test test/*.test.js
```

Les tests de paie du dépôt utilisent des taux fictifs. Pour rejouer un mois réel, place un fichier **non versionné** dans `test/fixtures/private/section7.json` (le dossier est dans `.gitignore`) avec `params`, `planning`, `annee`, `mois` et `attendu` (`net`, `brut`, `hs25`, `hs50`, `postes`, `gainHS`, `gainFerie`, `semaines`, `postesNets`). Le test le lit s'il est présent et ne l'écrit jamais dans git.
