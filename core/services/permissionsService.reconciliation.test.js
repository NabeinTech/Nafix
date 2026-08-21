// Test de réconciliation — garantit que core/services/permissionsService.js
// (CANAUX_RESTREINTS, contrôle serveur) reste cohérent avec
// src/utils/permissions.js (contrôle d'accès UI), sans jamais les fusionner
// techniquement (ES modules vs CommonJS — voir l'en-tête de
// permissionsService.js). Déterministe, aucune I/O réseau, aucune nouvelle
// dépendance : uniquement assert/fs/os/path/url/vm, natifs à Node.
//
// Exécution : node core/services/permissionsService.reconciliation.test.js
// Code de sortie 0 si tout passe, 1 sinon (compatible CI).
const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { pathToFileURL } = require('url')
const { verifierPermission, CANAUX_RESTREINTS } = require('./permissionsService')

// Liste figée des canaux sensibles constatés par l'audit de réconciliation —
// si l'un d'eux disparaissait un jour de CANAUX_RESTREINTS, une protection
// existante aurait été retirée sans le vouloir.
const CANAUX_ATTENDUS = [
  'db:reinitialiser',
  'utilisateurs:create',
  'utilisateurs:delete',
  'utilisateurs:updatePassword',
  'utilisateurs:updateRole',
  'utilisateurs:updatePermissions',
  'parametres:save',
  'parametres:exporterSauvegarde',
  'organisations:update',
  'organisations:setStatut',
  'domaine:save',
  'utilisateurs:getAll',
  'db:getStats',
  'parametres:importerSauvegarde',
  'organisations:creerOrganisation'
]

const TOUS_LES_ROLES = ['administrateur', 'gerant', 'comptable', 'caissier']

// src/utils/permissions.js est un vrai module ES (export const ...), jamais
// exécuté par du Node « nu » en production (seulement via Babel/Webpack
// côté React) — donc ni require()-able, ni import()-able tel quel ici
// (aucun package.json de ce dépôt ne déclare "type": "module"). On copie
// son contenu, à l'identique, dans un fichier temporaire .mjs (extension qui
// force Node à le reconnaître comme un module ES quel que soit
// package.json), pour utiliser ses véritables exports tels qu'écrits dans
// le code source — pas une réinterprétation manuelle du fichier.
async function chargerPermissionsUI() {
  const cheminSource = path.join(__dirname, '..', '..', 'src', 'utils', 'permissions.js')
  const contenu = fs.readFileSync(cheminSource, 'utf8')
  const cheminTemp = path.join(os.tmpdir(), `nafix-permissions-ui-${process.pid}-${Date.now()}.mjs`)
  fs.writeFileSync(cheminTemp, contenu, 'utf8')
  try {
    return await import(pathToFileURL(cheminTemp).href)
  } finally {
    fs.unlinkSync(cheminTemp)
  }
}

async function main() {
  const resultats = []
  function ok(l) { resultats.push({ l, ok: true }) }
  function fail(l, e) { resultats.push({ l, ok: false, err: e ? (e.message || String(e)) : '' }) }

  const { PERMISSIONS } = await chargerPermissionsUI()

  // Rôles ayant effectivement accès au module /parametres côté UI — c'est
  // l'ancrage de toute la protection CANAUX_RESTREINTS (le commentaire
  // d'origine de permissionsService.js : « seul administrateur a
  // /parametres »).
  const rolesAvecParametres = Object.keys(PERMISSIONS)
    .filter(role => PERMISSIONS[role].modules.includes('/parametres'))

  // ---- A. L'ancrage lui-même n'a pas dérivé ----
  try {
    assert.deepStrictEqual(rolesAvecParametres, ['administrateur'])
    ok('ANCRAGE — seul "administrateur" a accès au module /parametres côté UI')
  } catch (e) {
    fail('ANCRAGE — accès à /parametres a changé', new Error('rôles avec accès: ' + JSON.stringify(rolesAvecParametres) + ' (attendu: ["administrateur"] uniquement)'))
  }

  // ---- B. Aucun canal sensible attendu n'a disparu ----
  const canauxManquants = CANAUX_ATTENDUS.filter(c => !(c in CANAUX_RESTREINTS))
  if (canauxManquants.length === 0) {
    ok(`COUVERTURE — les ${CANAUX_ATTENDUS.length} canaux sensibles attendus sont tous encore protégés`)
  } else {
    fail('COUVERTURE — canal sensible sans protection', new Error(JSON.stringify(canauxManquants)))
  }

  // ---- C. Chaque canal de CANAUX_RESTREINTS (présent ou futur) n'autorise
  // que des rôles qui ont eux-mêmes accès à /parametres côté UI — détecte
  // aussi bien une entrée trop permissive existante qu'une nouvelle entrée
  // ajoutée sans la restreindre correctement ----
  const canauxTropPermissifs = []
  for (const [canal, roles] of Object.entries(CANAUX_RESTREINTS)) {
    for (const role of roles) {
      if (!rolesAvecParametres.includes(role)) canauxTropPermissifs.push({ canal, role })
    }
  }
  if (canauxTropPermissifs.length === 0) {
    ok(`ÉTANCHÉITÉ — les ${Object.keys(CANAUX_RESTREINTS).length} canaux de CANAUX_RESTREINTS n'autorisent que des rôles ayant accès à /parametres`)
  } else {
    fail('ÉTANCHÉITÉ — rôle inférieur autorisé à tort', new Error(JSON.stringify(canauxTropPermissifs)))
  }

  // ---- D. Comportement réel de verifierPermission() pour chaque canal ----
  let comportementOk = true
  for (const canal of Object.keys(CANAUX_RESTREINTS)) {
    try {
      verifierPermission(canal, { role: 'administrateur' })
    } catch (e) {
      comportementOk = false
      fail(`COMPORTEMENT — "${canal}" devrait autoriser administrateur`, e)
    }
    for (const role of TOUS_LES_ROLES) {
      if (CANAUX_RESTREINTS[canal].includes(role)) continue
      try {
        verifierPermission(canal, { role })
        comportementOk = false
        fail(`COMPORTEMENT — "${canal}" ne devrait PAS autoriser le rôle "${role}"`, new Error('accepté à tort'))
      } catch (e) {
        // refus attendu
      }
    }
    try {
      verifierPermission(canal, null)
      comportementOk = false
      fail(`COMPORTEMENT — "${canal}" sans session devrait être refusé`, new Error('accepté à tort'))
    } catch (e) {
      // refus attendu
    }
  }
  if (comportementOk) {
    ok(`COMPORTEMENT — verifierPermission() se comporte correctement pour les ${Object.keys(CANAUX_RESTREINTS).length} canaux (administrateur autorisé ; autres rôles et absence de session refusés)`)
  }

  console.log('\n=== RÉSULTATS — Réconciliation permissions UI / serveur ===')
  for (const r of resultats) console.log((r.ok ? 'OK   ' : 'FAIL ') + r.l + (r.ok ? '' : ' :: ' + r.err))
  const echecs = resultats.filter(r => !r.ok)
  console.log(`\nTotal: ${resultats.length}, Échecs: ${echecs.length}`)
  process.exit(echecs.length ? 1 : 0)
}

main().catch(e => { console.error('ERREUR FATALE', e); process.exit(1) })
