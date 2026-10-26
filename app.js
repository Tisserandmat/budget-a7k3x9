/* Interface. Toutes les données restent dans le navigateur. */
(function () {
  'use strict';
  var KEY = 'budget-v2';
  var P = window.BudgetPeriode;
  var C = window.BudgetCalc;
  var K = window.BudgetClassement;
  var CSV = window.BudgetCsv;
  var M = window.BudgetModele;

  var onglet = 'accueil';
  var brouillon = null;
  var toastTimer = 0;

  function etatVide() {
    return {
      v: 2, theme: 'auto', profil: null, reglesLocales: [], planningLocal: {},
      mouvements: [], versements: [], balayages: [], bulletins: {}, dettes: [],
      filetSolde: null, moisVu: null, moisPlanning: null
    };
  }
  var S = etatVide();

  function charger() {
    try {
      var brut = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (brut && brut.v === 2) S = Object.assign(etatVide(), brut);
    } catch (e) { S = etatVide(); }
    if (!S.profil) {
      try {
        var ancien = JSON.parse(localStorage.getItem('budget-v1') || 'null');
        if (ancien && ancien.v === 1) S.profil = profilDepuisV1(ancien);
      } catch (e) { /* ancienne sauvegarde illisible */ }
    }
  }
  function sauver() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); }
    catch (e) { toast('Stockage plein ou bloqué'); }
  }
  function profilDepuisV1(d) {
    var o = d.objectifs || {};
    return {
      type: 'budget-profil', version: 1, prenom: '', initiales: '', equipe: '',
      paie: d.params || {}, tampon: 0,
      fixes: (d.charges || []).map(function (c) { return { nom: c.nom, montant: c.montant, jour: 1 }; }),
      poches: (d.espaces || []).filter(function (e) { return !e.objectif; }).map(function (e) {
        return { id: e.id, nom: e.nom, budget: e.montant, role: 'depense', jour: 11 };
      }),
      objectifs: [o.obj1, o.obj2].filter(Boolean).map(function (x, i) {
        return { id: 'obj' + (i + 1), nom: x.nom, cible: x.cible, mensuel: i === 0 ? (o.mensuel || 0) : 0, epargne: i === 0 ? (o.epargne || 0) : 0, jour: 12 };
      }),
      regles: [], planning: {}
    };
  }

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function eur(n, cents) {
    var v = Math.round((Number(n) || 0) * 100) / 100;
    var neg = v < 0;
    var abs = Math.abs(v);
    var avec = cents === true || (cents !== false && Math.round(abs * 100) % 100 !== 0);
    var s = avec ? abs.toFixed(2).replace('.', ',') : String(Math.round(abs));
    var morceaux = s.split(',');
    morceaux[0] = morceaux[0].replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
    return (neg ? '−\u00a0' : '') + morceaux.join(',') + '\u00a0€';
  }
  function hfr(n) {
    var v = Math.round((Number(n) || 0) * 100) / 100;
    var s = (Math.round(v * 100) % 100 === 0 ? String(Math.round(v)) : v.toFixed(2).replace('.', ','));
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function toast(t) {
    var e = $('toast');
    e.textContent = t;
    e.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { e.classList.remove('on'); }, 1800);
  }
  function num(v) { return M.num(v); }

  function periodeBudget() {
    if (S.moisVu) {
      var p = S.moisVu.split('-');
      return P.periodeDe(P.iso(+p[0], +p[1], P.JOUR_DEBUT));
    }
    return periodeCourante();
  }
  function moisPlanning() {
    if (S.moisPlanning) {
      var p = S.moisPlanning.split('-');
      return { annee: +p[0], mois: +p[1] };
    }
    var per = periodeCourante();
    return { annee: per.annee, mois: per.mois };
  }
  function bilanDe(per) { return M.bilan(S.profil, S, per); }
  function periodeCourante() { return P.periodeDe(P.aujourdHui()); }
  function courant() { return bilanDe(periodeBudget()); }
  function accueilBilan() { return bilanDe(periodeCourante()); }

  function themeResolu() {
    if (S.theme === 'clair' || S.theme === 'sombre') return S.theme;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'clair' : 'sombre';
  }
  function appliquerTheme() {
    var t = themeResolu();
    document.documentElement.setAttribute('data-theme', t);
    var meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.setAttribute('content', t === 'clair' ? '#f3f5f8' : '#0e1014');
    var btn = $('theme');
    if (btn) {
      btn.innerHTML = t === 'clair'
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5z"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
      btn.setAttribute('aria-label', t === 'clair' ? 'Passer au thème sombre' : 'Passer au thème clair');
    }
  }
  function basculerTheme() {
    S.theme = themeResolu() === 'clair' ? 'sombre' : 'clair';
    sauver();
    appliquerTheme();
  }

  function initiales() {
    var p = S.profil || {};
    if (p.initiales) return p.initiales.slice(0, 3).toUpperCase();
    if (p.prenom) return p.prenom.slice(0, 2).toUpperCase();
    return '•';
  }
  function iconeHorloge() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/><path d="M12 8v5l3 2"/></svg>';
  }
  function navMois(id, label) {
    return '<div class="seg"><button type="button" class="arr" data-mois="-1" data-cible="' + id + '" aria-label="Mois précédent">‹</button>' +
      '<div class="m">' + esc(label) + '</div>' +
      '<button type="button" class="arr" data-mois="1" data-cible="' + id + '" aria-label="Mois suivant">›</button></div>';
  }
  function jauge(depense, budget) {
    var used = budget > 0 ? Math.min(1, Math.max(0, depense / budget)) : (depense > 0 ? 1 : 0);
    var cls = depense > budget || used >= 0.9 ? 'rd' : used >= 0.75 ? 'o' : 'g';
    return { w: Math.round(used * 100), cls: cls };
  }
  function pluriel(n, un, plus) { return n + ' ' + (n > 1 ? plus : un); }

  function banniere() {
    return '<div class="banner"><p>Importe ton profil pour la paie, les poches et le planning. Rien ne quitte cet appareil.</p>' +
      '<div class="btns"><button type="button" class="btn" data-act="profil">Importer le profil</button>' +
      '<button type="button" class="btn sec" data-act="exemple">Profil d\'exemple</button></div></div>';
  }

  function htmlCompte(b) {
    var base = b.fixesTotal + b.tampon;
    var ratio = base > 0 ? Math.max(0, Math.min(1, b.soldeCompte / base)) : 0;
    var cls = b.alerteTampon ? 'rd' : ratio < 0.35 ? 'o' : 'g';
    return '<button type="button" class="env cc' + (b.alerteTampon ? ' alerte' : '') + '" data-tab="budget">' +
      '<div><div class="n">Compte courant</div><div class="t">fixes ' + eur(b.fixesTotal) + ' · tampon ' + eur(b.tampon) + '</div></div>' +
      '<div class="ccv"><div class="v" id="solde-cc">' + eur(b.soldeCompte) + '</div><div class="gauge"><i class="' + cls + '" style="width:' + Math.round(ratio * 100) + '%"></i></div></div></button>';
  }
  function htmlMini(p) {
    var j = jauge(p.depense, p.budget);
    return '<button type="button" class="env" data-tab="budget"><div class="n">' + esc(p.court) + '</div>' +
      '<div class="v' + (p.reste < 0 ? ' neg' : '') + '">' + eur(p.reste) + '</div>' +
      '<div class="t">restants / ' + eur(p.budget, false) + '</div>' +
      '<div class="gauge"><i class="' + j.cls + '" style="width:' + j.w + '%"></i></div></button>';
  }

  function ligneBulletin(b) {
    var nom = P.MOIS[b.moisPaieRecue.mois - 1];
    var quand = P.dateCourte(P.datePaie(b.moisPaieRecue));
    if (b.paieRecueEstimee) {
      return 'Paie de ' + nom + ' (versée vers le ' + quand + ') : estimation ' + eur(b.paieRecue, true) + ' · en attente du bulletin';
    }
    return 'Paie de ' + nom + ' : bulletin ' + eur(b.paieRecue, true);
  }

  function htmlAccueil(b) {
    var h = '';
    if (!S.profil) h += banniere();
    else if (S.profil.exemple) h += '<p class="demo">Données d\'exemple. Importe ton profil pour tes montants.</p>';
    var auj = P.aujourdHui();
    if (b.periode.id === periodeCourante().id) {
      var prel = M.prochainPrelevement(b, auj);
      if (prel) {
        var jours = P.joursEntre(auj, prel.date);
        var quand = jours <= 0 ? 'aujourd\'hui' : (jours === 1 ? 'demain' : 'dans ' + jours + ' jours');
        h += '<button type="button" class="alert" data-tab="budget"><span class="dot">' + iconeHorloge() + '</span><span><b>Prélèvement ' +
          quand + '</b><span>' + esc(prel.nom) + ' · ' + eur(prel.montant) + ' · ' + esc(P.dateLongue(prel.date)) +
          '</span></span><span class="chev">›</span></button>';
      }
    }
    var taux = S.profil && S.profil.paie && S.profil.paie.taux;
    h += '<article class="card hero"><div class="lbl">Prochaine paie</div><div class="big" id="net-paie">' + eur(b.paie.net, true) + '</div>' +
      '<div class="hsub">versée vers le ' + esc(P.dateCourte(b.verseLe)) + ' · travail de ' + P.MOIS[b.periode.mois - 1] + '</div>' +
      '<div class="note">estimation · tout compris · ' + b.paie.postes + ' poste' + (b.paie.postes > 1 ? 's' : '') + ' du planning</div>' +
      (taux ? '' : '<div class="pnote">Taux horaire manquant : importe ton profil.</div>') +
      '<button type="button" class="oct" id="bulletin">' + esc(ligneBulletin(b)) + '</button>' +
      '<div class="sep"></div><div class="reste"><div><div class="lbl">Reste à dépenser</div><div class="v" id="reste">' +
      eur(b.resteADepenser) + ' <small>sur ' + eur(b.budgetDepenses, false) + '</small></div></div>' +
      '<button type="button" class="more" data-tab="budget">Voir le détail ›</button></div></article>';

    h += '<div class="sec"><h2>Enveloppes</h2><button type="button" class="more" data-tab="budget">Tout voir ›</button></div>';
    h += htmlCompte(b);
    var deps = b.poches.filter(function (p) { return p.role === 'depense'; });
    h += '<div class="grid">' + deps.slice(0, 6).map(htmlMini).join('') + '</div>';

    if (b.objectifs.length) {
      var a = b.objectifActif || b.objectifs[0];
      var suivant = b.objectifs.filter(function (o) { return o.ordre === a.ordre + 1; })[0];
      var pct = a.cible > 0 ? Math.min(100, Math.round(100 * a.epargne / a.cible)) : 0;
      h += '<article class="card goal"><div class="row"><span class="name">' + esc(a.nom) + '</span><span class="sub">' +
        eur(a.epargne) + ' sur ' + eur(a.cible) + ' · <span class="pct">' + pct + ' %</span></span></div>' +
        '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
        '<div class="sweep-line" id="balayage">Le 8 : <b>' + eur(b.aBalayer) + '</b> à balayer' +
        (a && !a.atteint ? ' vers ' + esc(a.nom) : '') + '</div>' +
        (suivant ? '<div class="next"><div class="lock">' + suivant.ordre + '</div><div>Ensuite : <b>' + esc(suivant.nom) + ' ' + eur(suivant.cible) + '</b></div></div>' : '') +
        '</article>';
    }
    if (b.alerteTampon) h += '<p class="badline">Le compte courant est sous le tampon de ' + eur(b.tampon) + '.</p>';
    return h;
  }

  function htmlPlanning() {
    var mp = moisPlanning();
    var per = P.periodeDe(P.iso(mp.annee, mp.mois, P.JOUR_DEBUT));
    var b = bilanDe(per);
    var planning = b.planning;
    var jours = P.joursDuMois(mp.annee, mp.mois);
    var decalage = (P.weekday(jours[0]) + 6) % 7;
    var cellules = '';
    for (var i = 0; i < decalage; i++) cellules += '<div class="d e"></div>';
    var auj = P.aujourdHui();
    jours.forEach(function (d) {
      var code = C.codeCanon(planning[d] || 'R');
      var kind = C.kindOf(d, code);
      var fam = (kind === 'matin' || kind === 'samMatin') ? 'm'
        : (kind === 'apm' || kind === 'samApm') ? 'a'
        : (kind === 'nuit' || kind === 'samNuit') ? 'n'
        : kind === 'journee' ? 'j' : 'r';
      var fer = P.estFerie(d);
      var wd = P.weekday(d);
      var cls = 'd ' + fam;
      if (wd === 6 && code !== 'R') cls += ' sat';
      if (wd === 0) cls += ' sun';
      if (fer) cls += ' fer';
      if (d === auj) cls += ' today';
      cellules += '<button type="button" class="' + cls + '" data-jour="' + d + '" aria-label="' + esc(P.dateLongue(d)) + '">' +
        (fer ? '<em>Férié</em>' : '') + '<b>' + P.parse(d).d + '</b><span>' + esc(C.libelleCourt(d, code)) + '</span></button>';
    });
    var hor = (S.profil && S.profil.horaires) || {};
    var leg = [
      ['m', 'Matin' + (hor.M ? ' ' + hor.M : '')],
      ['a', 'Après-midi' + (hor.AM ? ' ' + hor.AM : '')],
      ['n', 'Nuit' + (hor.N ? ' ' + hor.N : '')],
      ['j', 'Journée' + (hor.J ? ' ' + hor.J : '')],
      ['r', 'Repos']
    ];
    var f = b.paie.familles;
    var feries = b.paie.feries.map(function (d) {
      var x = P.parse(d);
      return x.d + '/' + P.pad(x.m);
    });
    var hs = b.paie.hs25 + b.paie.hs50;
    return navMois('planning', P.libelleMois(mp.annee, mp.mois)) +
      '<div class="wk"><div>L</div><div>M</div><div>M</div><div>J</div><div>V</div><div>S</div><div>D</div></div>' +
      '<div class="cal">' + cellules + '</div>' +
      '<div class="legend">' + leg.map(function (x) {
        return '<span><i style="background:var(--' + (x[0] === 'm' ? 'm' : x[0] === 'a' ? 'a' : x[0] === 'n' ? 'n' : x[0] === 'j' ? 'j' : 'r') + ')"></i>' + esc(x[1]) + '</span>';
      }).join('') + '<span><i class="sat"></i>Samedi (majoré)</span><span><i class="ferl"></i>Férié</span></div>' +
      '<article class="card total"><div class="t1">' + b.paie.postes + ' postes : ' +
        pluriel(f.matin, 'matin', 'matins') + ', ' + pluriel(f.apm, 'après-midi', 'après-midi') + ', ' + pluriel(f.nuit, 'nuit', 'nuits') + '</div>' +
      '<div class="t2">' + pluriel(f.journee, 'journée', 'journées') + ' · ' + pluriel(b.paie.samedis, 'samedi', 'samedis') +
        ' · ' + (feries.length ? 'férié ' + feries.join(', ') : 'aucun férié travaillé') + ' · ' + hfr(hs) + ' h sup.</div>' +
      '<div class="pay"><div><div class="lbl">Paie prévue</div><div class="v">' + eur(b.paie.net, true) + '</div>' +
        '<div class="note">estimation · tout compris</div><div class="pnote">versée vers le ' + esc(P.dateCourte(b.verseLe)) + '</div></div>' +
        '<button type="button" class="more" id="detail-paie">Voir le détail ›</button></div></article>';
  }

  function htmlPocheLarge(p) {
    var j = jauge(p.depense, p.budget);
    var extra = '';
    if (p.role === 'reserve') extra = '<div class="t">plafond ' + eur(p.plafond) + (p.solde != null ? ' · déjà ' + eur(p.solde) : '') + '</div>';
    if (p.role === 'exception') extra = '<div class="t">hors reste à dépenser</div>';
    return '<article class="env wide"><div class="n">' + esc(p.nom) + '</div>' + extra +
      '<div class="trois"><div><span class="mut">Budget</span><b>' + eur(p.budget) + '</b></div>' +
      '<div><span class="mut">Dépensé</span><b>' + eur(p.depense) + '</b></div>' +
      '<div><span class="mut">Reste</span><b class="' + (p.reste < 0 ? 'neg' : '') + '">' + eur(p.reste) + '</b></div></div>' +
      '<div class="gauge"><i class="' + j.cls + '" style="width:' + j.w + '%"></i></div></article>';
  }

  function optionsPoches(sel) {
    var b = courant();
    var h = '<option value=""' + (sel ? '' : ' selected') + '>À classer</option>' +
      '<option value="compte"' + (sel === 'compte' ? ' selected' : '') + '>Compte courant</option>';
    b.poches.forEach(function (p) {
      h += '<option value="' + esc(p.id) + '"' + (sel === p.id ? ' selected' : '') + '>' + esc(p.nom) + '</option>';
    });
    return h;
  }

  function htmlMouvements(per) {
    var liste = (S.mouvements || []).filter(function (m) { return m.date >= per.debut && m.date <= per.fin && !m.ignore; })
      .slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    if (!liste.length) return '<p class="empty">Aucun mouvement sur ce mois. Importe un relevé ou ajoute une dépense.</p>';
    return liste.map(function (m) {
      var signe = m.montant > 0 ? '+' : '−';
      return '<div class="mv"><div class="top"><div><div class="qui">' + esc(m.partenaire || 'Dépense') + '</div>' +
        '<div class="mut">' + esc(P.dateCourte(m.date)) + (m.motif ? ' · ' + esc(m.motif) : '') + '</div></div>' +
        '<b>' + signe + eur(Math.abs(m.montant)) + '</b></div>' +
        (m.categorie === 'revenu' ? '' : '<select data-mvt="' + esc(m.id) + '" aria-label="Poche">' + optionsPoches(m.poche) + '</select>') +
        '</div>';
    }).join('');
  }

  function htmlBudget(b) {
    var h = navMois('budget', P.libellePeriode(b.periode) + ' · du ' + P.dateCourte(b.periode.debut) + ' au ' + P.dateCourte(b.periode.fin));
    h += '<article class="card hero"><div class="lbl">Reste à dépenser</div><div class="big" id="reste-budget">' + eur(b.resteADepenser) + '</div>' +
      '<div class="mut">sur ' + eur(b.budgetDepenses, false) + ' virés le 11</div><div class="sep"></div>' +
      '<div class="lbl">À balayer le 8</div><div class="hsub" id="balayage-budget">' + eur(b.aBalayer) +
      (b.objectifActif ? ' vers ' + esc(b.objectifActif.nom) : '') + '</div>' +
      '<div class="pnote">Paie reçue ' + eur(b.paieRecue, true) + (b.paieRecueEstimee ? ' (estimation)' : '') +
      ' − enveloppes ' + eur(b.vire11) + ' − objectif ' + eur(b.vire12) + ' − fixes ' + eur(b.fixesTotal) + ' − tampon ' + eur(b.tampon) + '.</div>' +
      (b.balayageFait ? '<div class="note">Balayage déjà enregistré : ' + eur(b.balayageFait) + '</div>' : '') +
      '<button type="button" class="btn" id="enregistrer-balayage"' + (b.aBalayer <= 0 || !b.objectifActif ? ' disabled' : '') + '>Enregistrer le balayage</button></article>';
    if (b.alerteTampon) h += '<p class="badline">Sous le tampon de ' + eur(b.tampon) + '. Solde estimé ' + eur(b.soldeCompte) + '.</p>';
    h += '<p class="groupe">Compte courant</p>' + htmlCompte(b);
    h += '<div class="card"><div class="lbl">Fixes du mois</div>' + (b.fixes.length ? b.fixes.map(function (f) {
      return '<div class="row"><span>' + esc(f.nom) + '<div class="mut">' + esc(P.dateCourte(f.date)) + '</div></span><b>' + eur(f.montant) + '</b></div>';
    }).join('') + '<div class="row"><span>Total</span><b>' + eur(b.fixesTotal) + '</b></div>' : '<p class="empty">Aucune charge dans le profil.</p>') + '</div>';
    h += '<p class="groupe">Virés le 11</p>';
    b.poches.forEach(function (p) { h += htmlPocheLarge(p); });
    h += '<p class="groupe">Mouvements du mois</p><div class="card" id="mouvements">' + htmlMouvements(b.periode) + '</div>';
    h += '<div class="card"><h2 style="margin:0 0 6px;font-size:16px">Ajouter une dépense</h2>' +
      '<div class="trois"><div><label class="f">Montant</label><input id="dep-montant" inputmode="decimal" placeholder="0,00"></div>' +
      '<div style="grid-column:span 2"><label class="f">Poche</label><select id="dep-poche">' + optionsPoches('courses') + '</select></div></div>' +
      '<label class="f">Libellé</label><input id="dep-lib" maxlength="80" placeholder="Note">' +
      '<button type="button" class="btn" id="dep-ajout">Ajouter</button></div>';
    h += '<button type="button" class="btn" data-act="releve">Importer un relevé N26</button>' +
      '<button type="button" class="btn sec" data-act="exemple-csv">Essayer le relevé d\'exemple</button>' +
      '<button type="button" class="btn sec" id="envoyer">Envoyer à Trésorier</button>' +
      '<p class="mut">Destinataire suggéré : ' + esc((S.profil && S.profil.tresorier && S.profil.tresorier.email) || 'à renseigner dans le profil') + '. Le fichier reste sur l\'appareil tant que tu ne le partages pas.</p>';
    return h;
  }

  function htmlObjectifs(b) {
    var h = '';
    if (!b.objectifs.length) h += '<p class="empty">Aucun objectif dans le profil.</p>';
    b.objectifs.forEach(function (o) {
      var pct = o.cible > 0 ? Math.min(100, Math.round(100 * o.epargne / o.cible)) : 0;
      h += '<article class="card goal"><div class="row"><span class="name">' + o.ordre + '. ' + esc(o.nom) + '</span><span class="pct">' + pct + ' %</span></div>' +
        '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
        '<div class="row"><span>Épargné</span><b>' + eur(o.epargne) + '</b></div>' +
        '<div class="row"><span>Cible</span><b>' + eur(o.cible) + '</b></div>' +
        '<div class="row"><span>Reste</span><b>' + eur(o.reste) + '</b></div>' +
        '<div class="mut">' + (o.atteint ? 'Atteint' : (o === b.objectifActif ? 'En cours · viré le 12 : ' + eur(b.vire12) : 'Ensuite')) + '</div></article>';
    });
    h += '<div class="card"><h2 style="margin:0 0 6px;font-size:16px">Versement</h2>' +
      '<label class="f">Montant</label><input id="vers-montant" inputmode="decimal" placeholder="0,00">' +
      '<button type="button" class="btn" id="vers-ajout">Ajouter à l\'objectif en cours</button></div>';
    h += '<div class="sec"><h2>On me doit</h2></div><div class="card" id="dettes">';
    if (!(S.dettes || []).length) h += '<p class="empty">Aucune somme en attente.</p>';
    (S.dettes || []).forEach(function (d) {
      h += '<div class="dette' + (d.rembourse ? ' on' : '') + '"><input type="checkbox" data-dette="' + esc(d.id) + '"' + (d.rembourse ? ' checked' : '') + ' aria-label="Remboursé">' +
        '<div style="flex:1"><b>' + esc(d.nom) + '</b><div class="mut">' + eur(d.montant) + (d.date ? ' · ' + esc(P.dateCourte(d.date)) : '') + '</div></div>' +
        '<button type="button" class="x" data-dette-sup="' + esc(d.id) + '" aria-label="Supprimer">✕</button></div>';
    });
    h += '<label class="f">Nom</label><input id="dette-nom" maxlength="60">' +
      '<div class="trois"><div><label class="f">Montant</label><input id="dette-montant" inputmode="decimal"></div>' +
      '<div style="grid-column:span 2"><label class="f">Date prévue</label><input id="dette-date" type="date"></div></div>' +
      '<button type="button" class="btn sec" id="dette-ajout">Ajouter</button></div>';
    return h;
  }

  function entete() {
    var b = onglet === 'budget' ? courant() : accueilBilan();
    var petit = 'Bonjour';
    var titre = P.libellePeriode(b.periode).replace(/ \d{4}$/, '');
    if (onglet === 'accueil') {
      petit = (S.profil && S.profil.prenom) ? ('Bonjour ' + S.profil.prenom) : 'Bonjour';
    } else if (onglet === 'planning') {
      petit = (S.profil && S.profil.equipe) || 'Planning';
      titre = 'Planning';
    } else if (onglet === 'budget') {
      petit = 'Enveloppes';
      titre = 'Budget';
    } else {
      petit = 'Épargne';
      titre = 'Objectifs';
    }
    $('bonjour').textContent = petit;
    $('titre').textContent = titre;
    $('reglages').textContent = initiales();
    document.querySelectorAll('#nav button').forEach(function (btn) {
      btn.classList.toggle('on', btn.dataset.tab === onglet);
    });
  }

  function rendre() {
    var actuel = accueilBilan();
    $('s-accueil').innerHTML = htmlAccueil(actuel);
    $('s-planning').innerHTML = htmlPlanning();
    $('s-budget').innerHTML = htmlBudget(courant());
    $('s-objectifs').innerHTML = htmlObjectifs(actuel);
    document.querySelectorAll('main section').forEach(function (s) {
      s.classList.toggle('on', s.id === 's-' + onglet);
    });
    entete();
    appliquerTheme();
  }

  function ouvrir(html) {
    $('sheet').innerHTML = '<div class="grab"></div>' + html;
    $('sheet').hidden = false;
    $('overlay').hidden = false;
  }
  function fermer() {
    $('sheet').hidden = true;
    $('overlay').hidden = true;
    $('sheet').innerHTML = '';
    brouillon = null;
  }

  function fichePaie() {
    var mp = onglet === 'planning' ? moisPlanning() : { annee: courant().periode.annee, mois: courant().periode.mois };
    var b = bilanDe(P.periodeDe(P.iso(mp.annee, mp.mois, P.JOUR_DEBUT)));
    var d = b.paie.detail;
    var h = '<div class="head"><h2>Détail de la paie</h2><button type="button" class="xbtn" data-act="fermer" aria-label="Fermer">✕</button></div>' +
      '<p class="note">Estimation · tout compris</p>' +
      '<div class="row"><span>Brut</span><b>' + eur(b.paie.brut, true) + '</b></div>' +
      '<div class="row"><span>Cotisations</span><span>− ' + eur(d.cotisations, true) + '</span></div>' +
      '<div class="row"><span>Paniers et transport</span><span>+ ' + eur(d.indemnites, true) + '</span></div>' +
      '<div class="row"><span>Net avant impôt</span><b>' + eur(d.netAvantImpot, true) + '</b></div>' +
      '<div class="row"><span>PAS</span><span>− ' + eur(d.pas, true) + '</span></div>' +
      '<div class="row"><span>Net après PAS</span><b>' + eur(b.paie.net, true) + '</b></div>' +
      '<div class="row"><span>Dont heures sup.</span><b>' + eur(b.paie.gainHS, true) + '</b></div>' +
      '<div class="row"><span>Dont férié</span><b>' + eur(b.paie.gainFerie, true) + '</b></div>' +
      '<div class="row"><span>Dont 13e / IFM / CP</span><span>' + eur(d.treizieme, true) + ' · ' + eur(d.ifm, true) + ' · ' + eur(d.iccp, true) + '</span></div>';
    b.paie.semaines.forEach(function (s) {
      h += '<div class="sem"><div><b>Semaine du ' + esc(P.dateCourte(s.lundi)) + '</b><div class="mut">' +
        s.postes + ' postes · ' + hfr(s.heures) + ' h' +
        (s.hs25 || s.hs50 ? ' · sup. ' + hfr(s.hs25) + ' h / ' + hfr(s.hs50) + ' h' : '') + '</div></div><b>' + eur(s.net, true) + '</b></div>';
    });
    ouvrir(h);
  }

  function ficheBulletin() {
    var b = accueilBilan();
    ouvrir('<div class="head"><h2>Bulletin reçu</h2><button type="button" class="xbtn" data-act="fermer" aria-label="Fermer">✕</button></div>' +
      '<p class="mut">Net après PAS de la paie de ' + P.MOIS[b.moisPaieRecue.mois - 1] + ', versée vers le ' + esc(P.dateCourte(P.datePaie(b.moisPaieRecue))) + '. Laisse vide pour garder l\'estimation.</p>' +
      '<label class="f">Montant net</label><input id="bulletin-montant" inputmode="decimal" value="' + (b.paieRecueEstimee ? '' : String(b.paieRecue).replace('.', ',')) + '">' +
      '<button type="button" class="btn" id="bulletin-ok">Enregistrer</button>');
  }

  function ficheReglages() {
    var email = (S.profil && S.profil.tresorier && S.profil.tresorier.email) || '';
    ouvrir('<div class="head"><h2>Réglages</h2><button type="button" class="xbtn" data-act="fermer" aria-label="Fermer">✕</button></div>' +
      '<div class="lbl">Thème</div><div class="choix" id="choix-theme">' +
      ['auto', 'clair', 'sombre'].map(function (t) {
        return '<button type="button" data-theme="' + t + '"' + (S.theme === t ? ' class="on"' : '') + '>' +
          (t === 'auto' ? 'Système' : t === 'clair' ? 'Jour' : 'Nuit') + '</button>';
      }).join('') + '</div>' +
      '<button type="button" class="btn" data-act="profil">Importer un profil JSON</button>' +
      '<button type="button" class="btn sec" data-act="exemple">Charger le profil d\'exemple</button>' +
      '<button type="button" class="btn sec" data-act="export-profil">Exporter le profil (règles comprises)</button>' +
      '<button type="button" class="btn sec" data-act="export-sauve">Exporter la sauvegarde</button>' +
      '<button type="button" class="btn sec" data-act="import-sauve">Importer une sauvegarde</button>' +
      '<p class="mut">Destinataire Trésorier : ' + esc(email || 'non renseigné') + '. Aucune donnée n\'est envoyée à un serveur.</p>');
  }

  function telecharger(nom, texte, type) {
    var blob = new Blob([texte], { type: type || 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nom;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  function profilExportable() {
    var p = JSON.parse(JSON.stringify(S.profil || { type: 'budget-profil', version: 1 }));
    var vus = {};
    var regles = (S.reglesLocales || []).concat(p.regles || []).filter(function (r) {
      var k = K.norm(r.contient) + '|' + r.poche;
      if (!r.contient || vus[k]) return false;
      vus[k] = true;
      return true;
    });
    p.regles = regles;
    p.exemple = false;
    p.type = 'budget-profil';
    return p;
  }

  function appliquerProfil(p) {
    if (!p || typeof p !== 'object' || (!p.paie && !p.poches)) throw new Error('profil');
    S.profil = p;
    sauver();
    rendre();
    toast('Profil importé');
  }

  function lireJson(fichier, ok) {
    var rd = new FileReader();
    rd.onload = function () {
      try { ok(JSON.parse(rd.result)); }
      catch (e) { toast('Fichier JSON illisible'); }
    };
    rd.readAsText(fichier);
  }

  async function envoyer() {
    var b = courant();
    var data = {
      type: 'budget-mois',
      version: 1,
      genereLe: new Date().toISOString(),
      periode: { id: b.periode.id, debut: b.periode.debut, fin: b.periode.fin, libelle: P.libellePeriode(b.periode) },
      destinataire: (S.profil && S.profil.tresorier && S.profil.tresorier.email) || '',
      postes: b.paie.lignes,
      paieEstimee: {
        nette: b.paie.net, brute: b.paie.brut, toutCompris: true, verseeVers: b.verseLe,
        heuresSup: { h25: b.paie.hs25, h50: b.paie.hs50, gain: b.paie.gainHS },
        ferie: b.paie.gainFerie,
        semaines: b.paie.semaines.map(function (s) {
          return { lundi: s.lundi, postes: s.postes, heures: s.heures, hs25: s.hs25, hs50: s.hs50, net: s.net, brut: s.brut };
        })
      },
      paieRecue: { nette: b.paieRecue, estimee: b.paieRecueEstimee, mois: b.moisPaieRecue.id },
      poches: b.poches.map(function (p) {
        return { id: p.id, nom: p.nom, budget: p.budget, depense: p.depense, reste: p.reste };
      }),
      compteCourant: { solde: b.soldeCompte, tampon: b.tampon, fixes: b.fixesTotal, alerte: b.alerteTampon },
      resteADepenser: b.resteADepenser,
      aBalayer: b.aBalayer,
      mouvements: (S.mouvements || []).filter(function (m) { return m.date >= b.periode.debut && m.date <= b.periode.fin; }).map(function (m) {
        return { date: m.date, partenaire: m.partenaire, montant: m.montant, poche: m.poche, reference: m.reference || '', espace: m.espace || '', ignore: !!m.ignore, categorie: m.categorie || '' };
      }),
      objectifs: b.objectifs,
      onMeDoit: S.dettes || []
    };
    var nom = 'budget-' + b.periode.id + '.json';
    var texte = JSON.stringify(data, null, 2);
    var fichier = new File([texte], nom, { type: 'application/json' });
    var message = 'Budget ' + P.libellePeriode(b.periode) + (data.destinataire ? ' — destinataire suggéré : ' + data.destinataire : '');
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [fichier] })) {
      try {
        await navigator.share({ files: [fichier], title: 'Budget ' + P.libellePeriode(b.periode), text: message });
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return;
      }
    }
    telecharger(nom, texte);
    toast(data.destinataire ? 'Fichier téléchargé' : 'Fichier téléchargé');
  }

  function preparerImport(mouvements) {
    var per = periodeBudget();
    brouillon = {
      periode: per,
      lignes: mouvements.map(function (m, i) {
        var c = K.classer(m, S.profil || { poches: [] }, S.reglesLocales || []);
        return {
          i: i, date: m.date, partenaire: m.partenaire || '', montant: m.montant,
          reference: m.reference || '', espace: m.espace || '', type: m.type || '',
          poche: c.poche, ignore: c.ignore, douteux: c.douteux, categorie: c.categorie,
          source: c.source, motif: c.motif, sauverRegle: false,
          hors: !P.dansPeriode(m.date, per)
        };
      })
    };
    rendreImport();
  }
  function rendreImport() {
    if (!brouillon) return;
    var lignes = brouillon.lignes;
    var dans = lignes.filter(function (l) { return !l.hors; });
    var hors = lignes.length - dans.length;
    var aClasser = dans.filter(function (l) { return !l.ignore && l.categorie !== 'revenu' && !l.poche; }).length;
    var h = '<div class="head"><h2>Vérifier le relevé</h2><button type="button" class="xbtn" data-act="fermer" aria-label="Fermer">✕</button></div>' +
      '<p class="mut">' + esc(P.libellePeriode(brouillon.periode)) + ' · du ' + esc(P.dateCourte(brouillon.periode.debut)) +
      ' au ' + esc(P.dateCourte(brouillon.periode.fin)) + '. ' + hors + ' hors période, non importé' + (hors > 1 ? 's' : '') + '.</p>' +
      '<button type="button" class="btn sec" id="reste-compte">Mettre les lignes à classer sur le compte courant</button>';
    dans.forEach(function (l) {
      var cls = (!l.ignore && l.categorie !== 'revenu' && (!l.poche || l.douteux)) ? ' mv todo' : ' mv';
      h += '<div class="' + cls.trim() + '"><div class="top"><div><div class="qui">' + esc(l.partenaire || 'Mouvement') + '</div>' +
        '<div class="mut">' + esc(P.dateCourte(l.date)) + ' · ' + esc(l.motif) + (l.espace ? ' · ' + esc(l.espace) : '') +
        (l.douteux && l.poche ? ' · à vérifier' : '') + '</div></div><b>' + (l.montant > 0 ? '+' : '−') + eur(Math.abs(l.montant)) + '</b></div>';
      if (!l.ignore && l.categorie !== 'revenu') {
        h += '<select data-brouillon="' + l.i + '" aria-label="Poche de ' + esc(l.partenaire) + '">' + optionsPoches(l.poche) + '</select>' +
          '<label class="check"><input type="checkbox" data-regle="' + l.i + '"' + (l.sauverRegle ? ' checked' : '') + '> Enregistrer comme règle du profil</label>';
      }
      h += '</div>';
    });
    if (!dans.length) h += '<p class="empty">Aucun mouvement sur ce mois budgétaire.</p>';
    h += '<button type="button" class="btn" id="confirmer-import">Importer ' + (dans.length - aClasser) + ' mouvements</button>' +
      (aClasser ? '<p class="mut">' + aClasser + ' ligne' + (aClasser > 1 ? 's' : '') + ' sans poche ne seront pas importées.</p>' : '');
    ouvrir(h);
  }

  function confirmerImport() {
    if (!brouillon) return;
    var per = brouillon.periode;
    var ajoutes = [];
    var laisse = 0;
    brouillon.lignes.forEach(function (l) {
      if (l.hors) return;
      if (!l.ignore && l.categorie !== 'revenu' && !l.poche) { laisse++; return; }
      if (l.sauverRegle && l.partenaire && l.poche) {
        var existe = (S.reglesLocales || []).some(function (r) {
          return K.norm(r.contient) === K.norm(l.partenaire) && r.poche === l.poche;
        });
        if (!existe) S.reglesLocales.unshift({ contient: l.partenaire, poche: l.poche });
      }
      ajoutes.push({
        id: uid(), date: l.date, partenaire: l.partenaire, montant: l.montant,
        reference: l.reference, espace: l.espace, type: l.type,
        poche: l.poche, ignore: !!l.ignore, douteux: false,
        categorie: l.ignore ? 'interne' : (l.categorie || 'depense'),
        motif: l.motif, source: 'import'
      });
    });
    S.mouvements = (S.mouvements || []).filter(function (m) {
      return m.source !== 'import' || m.date < per.debut || m.date > per.fin;
    }).concat(ajoutes);
    sauver();
    fermer();
    onglet = 'budget';
    rendre();
    toast(ajoutes.length + ' mouvement' + (ajoutes.length > 1 ? 's' : '') + ' importé' + (ajoutes.length > 1 ? 's' : '') + (laisse ? ' · ' + laisse + ' laissé' + (laisse > 1 ? 's' : '') : ''));
  }

  function lignesPdf(items) {
    var a = [];
    items.forEach(function (it) {
      if (!it.str || !String(it.str).trim()) return;
      var t = it.transform || [1, 0, 0, 1, 0, 0];
      a.push({ s: it.str, x: t[4], y: t[5], w: it.width || 0, h: Math.abs(t[3]) || 8 });
    });
    a.sort(function (p, q) { return q.y - p.y || p.x - q.x; });
    var lignes = [];
    a.forEach(function (it) {
      var l = lignes[lignes.length - 1];
      if (l && Math.abs(l.y - it.y) <= Math.max(1.5, it.h * 0.45)) l.its.push(it);
      else lignes.push({ y: it.y, its: [it] });
    });
    return lignes.map(function (l) {
      l.its.sort(function (p, q) { return p.x - q.x; });
      var s = '';
      var fin = null;
      l.its.forEach(function (it) {
        if (fin != null) {
          var trou = it.x - fin;
          s += trou > it.h * 1.2 ? '   ' : (trou > it.h * 0.12 ? ' ' : '');
        }
        s += it.s;
        fin = it.x + it.w;
      });
      return s.trim();
    }).join('\n');
  }
  function chargerPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    return new Promise(function (ok, ko) {
      var s = document.createElement('script');
      s.src = 'vendor/pdf.min.js';
      s.onload = function () { ok(window.pdfjsLib); };
      s.onerror = function () { ko(new Error('pdf')); };
      document.head.appendChild(s);
    });
  }
  async function textePdf(buf) {
    var lib = await chargerPdfJs();
    lib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
    var doc = await lib.getDocument({ data: new Uint8Array(buf), isEvalSupported: false, disableFontFace: true, verbosity: 0 }).promise;
    var pages = [];
    for (var i = 1; i <= doc.numPages; i++) {
      var page = await doc.getPage(i);
      var tc = await page.getTextContent();
      pages.push(lignesPdf(tc.items));
    }
    try { doc.destroy(); } catch (e) { /* déjà fermé */ }
    return pages.join('\n');
  }

  async function importerFichierReleve(fichier) {
    try {
      var nom = fichier.name || '';
      if (/\.pdf$/i.test(nom) || fichier.type === 'application/pdf') {
        var buf = await fichier.arrayBuffer();
        var texte = await textePdf(buf);
        var ops = CSV.parserTexte(texte);
        if (!ops.length) { toast('Aucune opération reconnue dans ce PDF'); return; }
        preparerImport(ops);
        return;
      }
      var texteCsv = await fichier.text();
      var res = CSV.parser(texteCsv);
      if (res.erreurs.length && !res.mouvements.length) { toast(res.erreurs[0]); return; }
      if (!res.mouvements.length) { toast('Aucune opération dans ce fichier'); return; }
      preparerImport(res.mouvements);
    } catch (e) {
      toast('Import impossible');
    }
  }

  function changerMois(cible, delta) {
    if (cible === 'planning') {
      var mp = moisPlanning();
      var n = P.addMonths(mp.annee, mp.mois, delta);
      S.moisPlanning = n.y + '-' + P.pad(n.m);
    } else {
      var per = periodeBudget();
      var suivant = delta > 0 ? P.moisSuivant(per) : P.moisPrecedent(per);
      S.moisVu = suivant.id;
    }
    sauver();
    rendre();
  }

  function cycleJour(date) {
    var planning = M.planningEffectif(S.profil, S.planningLocal);
    var ordre = ['M', 'AM', 'N', 'J', 'R'];
    var cur = C.codeCanon(planning[date] || 'R');
    var i = ordre.indexOf(cur);
    S.planningLocal[date] = ordre[(i + 1) % ordre.length];
    sauver();
    rendre();
  }

  function enregistrerBalayage() {
    var b = courant();
    if (b.aBalayer <= 0 || !b.objectifActif) return;
    S.balayages.push({ id: uid(), periode: b.periode.id, objectifId: b.objectifActif.id, montant: b.aBalayer, date: b.periode.fin });
    sauver();
    rendre();
    toast('Balayage enregistré');
  }

  document.body.addEventListener('click', function (ev) {
    var t = ev.target.closest('button, [data-tab]');
    if (!t) return;
    if (t.id === 'theme') { basculerTheme(); return; }
    if (t.id === 'reglages') { ficheReglages(); return; }
    if (t.dataset.tab && t.closest('nav, .env, .alert, .more, main')) {
      onglet = t.dataset.tab;
      rendre();
      window.scrollTo(0, 0);
      return;
    }
    if (t.dataset.mois) { changerMois(t.dataset.cible, parseInt(t.dataset.mois, 10)); return; }
    if (t.dataset.jour) { cycleJour(t.dataset.jour); return; }
    if (t.dataset.theme) {
      S.theme = t.dataset.theme;
      sauver();
      appliquerTheme();
      ficheReglages();
      return;
    }
    if (t.dataset.detteSup) {
      S.dettes = (S.dettes || []).filter(function (d) { return d.id !== t.dataset.detteSup; });
      sauver(); rendre(); return;
    }
    var act = t.dataset.act || t.id;
    if (act === 'fermer') { fermer(); return; }
    if (act === 'profil') { $('fichier-profil').click(); return; }
    if (act === 'exemple') {
      fetch('profil.exemple.json').then(function (r) { return r.json(); }).then(function (p) {
        S.profil = p; sauver(); fermer(); rendre(); toast('Profil d\'exemple chargé');
      }).catch(function () { toast('Exemple introuvable'); });
      return;
    }
    if (act === 'export-profil') { telecharger('profil-budget.json', JSON.stringify(profilExportable(), null, 2)); return; }
    if (act === 'export-sauve') {
      telecharger('budget-sauvegarde.json', JSON.stringify({ type: 'budget-sauvegarde', version: 2, etat: S }, null, 2));
      return;
    }
    if (act === 'import-sauve') { $('fichier-sauvegarde').click(); return; }
    if (act === 'releve') { $('fichier-releve').click(); return; }
    if (act === 'exemple-csv') {
      fetch('exemple-releve.csv').then(function (r) { return r.text(); }).then(function (texte) {
        var res = CSV.parser(texte);
        preparerImport(res.mouvements);
      }).catch(function () { toast('Relevé d\'exemple introuvable'); });
      return;
    }
    if (act === 'envoyer' || t.id === 'envoyer') { envoyer(); return; }
    if (t.id === 'detail-paie') { fichePaie(); return; }
    if (t.id === 'bulletin') { ficheBulletin(); return; }
    if (t.id === 'bulletin-ok') {
      var b = accueilBilan();
      var v = $('bulletin-montant').value.trim();
      if (!v) delete S.bulletins[b.moisPaieRecue.id];
      else S.bulletins[b.moisPaieRecue.id] = num(v);
      sauver(); fermer(); rendre(); toast('Bulletin enregistré');
      return;
    }
    if (t.id === 'enregistrer-balayage') { enregistrerBalayage(); return; }
    if (t.id === 'dep-ajout') {
      var montant = num($('dep-montant').value);
      var poche = $('dep-poche').value;
      if (montant <= 0 || !poche) { toast('Montant et poche ?'); return; }
      var per = periodeBudget();
      S.mouvements.push({
        id: uid(), date: P.aujourdHui() < per.debut || P.aujourdHui() > per.fin ? per.debut : P.aujourdHui(),
        partenaire: $('dep-lib').value.trim().slice(0, 80) || 'Dépense',
        montant: -Math.round(montant * 100) / 100, poche: poche, categorie: 'depense', source: 'manuel', motif: 'Saisie'
      });
      sauver(); rendre(); toast('Dépense ajoutée');
      return;
    }
    if (t.id === 'vers-ajout') {
      var b2 = courant();
      var montantV = num($('vers-montant').value);
      if (montantV === 0 || !b2.objectifActif) { toast('Montant ?'); return; }
      S.versements.push({ id: uid(), date: P.aujourdHui(), montant: montantV, objectifId: b2.objectifActif.id });
      sauver(); rendre(); toast('Versement ajouté');
      return;
    }
    if (t.id === 'dette-ajout') {
      var nom = $('dette-nom').value.trim();
      var md = num($('dette-montant').value);
      if (!nom || md <= 0) { toast('Nom et montant ?'); return; }
      S.dettes.push({ id: uid(), nom: nom.slice(0, 60), montant: Math.round(md * 100) / 100, date: $('dette-date').value || '', rembourse: false });
      sauver(); rendre(); toast('Ajouté');
      return;
    }
    if (t.id === 'reste-compte') {
      if (!brouillon) return;
      brouillon.lignes.forEach(function (l) {
        if (!l.hors && !l.ignore && l.categorie !== 'revenu' && !l.poche) { l.poche = 'compte'; l.douteux = false; l.motif = 'Compte courant'; }
      });
      rendreImport();
      return;
    }
    if (t.id === 'confirmer-import') { confirmerImport(); }
  });

  document.body.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t.dataset && t.dataset.mvt) {
      var id = t.dataset.mvt;
      var m = (S.mouvements || []).filter(function (x) { return x.id === id; })[0];
      if (!m) return;
      m.poche = t.value || null;
      m.douteux = false;
      m.motif = 'Corrigé';
      if (!m.poche) m.categorie = 'depense';
      sauver(); rendre();
      return;
    }
    if (t.dataset && t.dataset.brouillon != null && brouillon) {
      var ligne = brouillon.lignes.filter(function (l) { return String(l.i) === t.dataset.brouillon; })[0];
      if (!ligne) return;
      ligne.poche = t.value || null;
      ligne.douteux = !ligne.poche;
      ligne.motif = ligne.poche ? 'Choix manuel' : 'À classer';
      var y = $('sheet').scrollTop;
      rendreImport();
      $('sheet').scrollTop = y;
      return;
    }
    if (t.dataset && t.dataset.regle != null && brouillon) {
      var ligneR = brouillon.lignes.filter(function (l) { return String(l.i) === t.dataset.regle; })[0];
      if (ligneR) ligneR.sauverRegle = t.checked;
      return;
    }
    if (t.dataset && t.dataset.dette) {
      var dette = (S.dettes || []).filter(function (d) { return d.id === t.dataset.dette; })[0];
      if (!dette) return;
      dette.rembourse = t.checked;
      sauver();
      rendre();
    }
  });

  $('fichier-profil').addEventListener('change', function () {
    var f = this.files && this.files[0];
    this.value = '';
    if (!f) return;
    lireJson(f, function (data) {
      var profil = data && data.type === 'budget-profil' ? data : (data && data.paie ? data : null);
      if (data && data.v === 1 && data.params) profil = profilDepuisV1(data);
      if (!profil) { toast('Ce JSON n\'est pas un profil'); return; }
      appliquerProfil(profil);
      fermer();
    });
  });
  $('fichier-sauvegarde').addEventListener('change', function () {
    var f = this.files && this.files[0];
    this.value = '';
    if (!f) return;
    lireJson(f, function (data) {
      var etat = data && data.type === 'budget-sauvegarde' ? data.etat : (data && data.v === 2 ? data : null);
      if (!etat) { toast('Sauvegarde invalide'); return; }
      S = Object.assign(etatVide(), etat);
      sauver(); fermer(); rendre(); toast('Sauvegarde importée');
    });
  });
  $('fichier-releve').addEventListener('change', function () {
    var f = this.files && this.files[0];
    this.value = '';
    if (f) importerFichierReleve(f);
  });
  $('overlay').addEventListener('click', fermer);

  var media = window.matchMedia('(prefers-color-scheme: light)');
  if (media.addEventListener) media.addEventListener('change', function () { if (S.theme === 'auto') appliquerTheme(); });

  charger();
  rendre();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('service-worker.js').catch(function () {});
  }
})();
