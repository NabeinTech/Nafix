// Audit du 22/08/2026 — vérifie tokenService.js contre une vraie base
// PostgreSQL : rotation du refresh token à chaque rafraîchissement, révocation
// en cascade de toutes les sessions actives quand un token déjà tourné
// réapparaît (signal de vol — voir le commentaire d'en-tête de
// tokenService.js), coupure d'accès à la désactivation d'une organisation.
//
// Même convention que permissionsService.reconciliation.test.js : script
// Node nu (assert + ok/fail), aucun framework de test. Exécution :
// node server/api/auth/tokenService.rotation.test.js
const assert = require('assert')
const jwt = require('jsonwebtoken')
const pool = require('../../../db/pool')
const OrganisationsDAO = require('../../../dao/OrganisationsDAO')
const UtilisateursDAO = require('../../../dao/UtilisateursDAO')

const SUFFIXE = `${process.pid}_${Date.now()}`
const SECRET_TEST = `secret-de-test-suffisamment-long-${SUFFIXE}`

async function main() {
  const resultats = []
  function ok(l) { resultats.push({ l, ok: true }) }
  function fail(l, e) { resultats.push({ l, ok: false, err: e ? (e.message || String(e)) : '' }) }

  const secretOriginal = process.env.JWT_SECRET
  process.env.JWT_SECRET = SECRET_TEST
  // tokenService lit process.env.JWT_SECRET à chaque appel (getSecret()) —
  // le require doit donc arriver APRÈS l'avoir positionné, pas en haut du
  // fichier avec les autres require, pour ne jamais dépendre de l'ordre
  // d'évaluation des imports.
  const tokenService = require('./tokenService')

  const MOT_DE_PASSE = 'mot-de-passe-test-1234'
  let org, utilisateur

  try {
    org = await OrganisationsDAO.create({ nom: 'Test Rotation Tokens', code: `test_tokens_${SUFFIXE}` })
    const { succes } = await UtilisateursDAO.create(
      { nom: 'Testeur', username: `test_user_${SUFFIXE}`, password: MOT_DE_PASSE, role: 'administrateur', email: null },
      org.id
    )
    assert.ok(succes, 'préparation : utilisateur de test créé')
    utilisateur = succes

    // ---- A. Connexion — émet un couple de tokens valides ----
    let paireInitiale
    try {
      const { succes: s, erreur } = await tokenService.connexion(utilisateur.username, MOT_DE_PASSE)
      assert.ok(!erreur, 'connexion avec identifiants corrects ne doit pas échouer : ' + erreur)
      assert.ok(s.accessToken && s.refreshToken)
      const payload = tokenService.verifierAccessToken(s.accessToken)
      assert.strictEqual(payload.sub, utilisateur.id)
      assert.strictEqual(payload.organisationId, org.id)
      assert.strictEqual(payload.role, 'administrateur')
      assert.strictEqual(payload.type, 'access')
      paireInitiale = s
      ok('CONNEXION — émet un access token (payload correct) et un refresh token')
    } catch (e) { fail('CONNEXION — échec inattendu', e) }

    // ---- B. Mauvais mot de passe / utilisateur inconnu — jamais de détail
    // sur ce qui a échoué (anti-énumération, même message dans les deux cas) ----
    try {
      const r1 = await tokenService.connexion(utilisateur.username, 'mauvais-mot-de-passe')
      const r2 = await tokenService.connexion(`inconnu_${SUFFIXE}`, MOT_DE_PASSE)
      assert.strictEqual(r1.erreur, 'Identifiant ou mot de passe incorrect !')
      assert.strictEqual(r2.erreur, r1.erreur)
      ok('CONNEXION REFUSÉE — mauvais mot de passe et utilisateur inconnu renvoient le même message')
    } catch (e) { fail('CONNEXION REFUSÉE — comportement incorrect', e) }

    // ---- C. Rotation — rafraîchir change le refresh token, l'ancien devient
    // inutilisable pour un nouveau rafraîchissement normal ----
    let paireApresRotation
    try {
      const { succes: s, erreur } = await tokenService.rafraichir(paireInitiale.refreshToken)
      assert.ok(!erreur, 'rafraîchissement avec un refresh token valide ne doit pas échouer : ' + erreur)
      assert.notStrictEqual(s.refreshToken, paireInitiale.refreshToken, 'un nouveau refresh token doit être émis à chaque rotation')
      // Pas d'assertion sur l'accessToken : un JWT est une fonction pure de
      // son payload (mêmes claims + même seconde d'émission via `iat` =
      // même signature), rien à voir avec la rotation du refresh token —
      // seul ce dernier (aléatoire, jamais dérivé du contenu) doit changer.
      paireApresRotation = s
      ok('ROTATION — rafraîchir un refresh token valide émet une nouvelle paire, distincte de la précédente')
    } catch (e) { fail('ROTATION — comportement incorrect', e) }

    // ---- D. Réutilisation d'un refresh token déjà tourné = signal de vol :
    // révoque TOUTES les sessions actives de l'utilisateur, pas seulement
    // celle-ci — y compris la session "légitime" issue de la rotation C. ----
    try {
      const r = await tokenService.rafraichir(paireInitiale.refreshToken)
      assert.strictEqual(r.erreur, 'Refresh token déjà utilisé — toutes les sessions ont été révoquées par sécurité')

      const rApresCascade = await tokenService.rafraichir(paireApresRotation.refreshToken)
      assert.ok(rApresCascade.erreur, 'la session issue de la rotation C doit elle aussi être révoquée par la cascade')

      ok('VOL DÉTECTÉ — rejouer un refresh token déjà tourné révoque toutes les sessions actives, y compris les plus récentes')
    } catch (e) { fail('VOL DÉTECTÉ — la cascade de révocation ne s\'est pas appliquée', e) }

    // ---- E. Déconnexion révoque le token ciblé ----
    let paireE
    try {
      const { succes: s } = await tokenService.connexion(utilisateur.username, MOT_DE_PASSE)
      paireE = s
      await tokenService.deconnexion(s.refreshToken)
      const r = await tokenService.rafraichir(s.refreshToken)
      assert.ok(r.erreur, 'un refresh token désactivé par déconnexion ne doit plus permettre de rafraîchir')
      ok('DÉCONNEXION — révoque le refresh token ciblé, inutilisable ensuite')
    } catch (e) { fail('DÉCONNEXION — comportement incorrect', e) }

    // ---- F. Type de token invalide — un token qui n'est pas de type
    // "access" (même signé avec le bon secret) doit être rejeté ----
    try {
      const tokenAutreType = jwt.sign({ sub: utilisateur.id, organisationId: org.id, role: 'administrateur', type: 'refresh' }, SECRET_TEST, { expiresIn: '5m' })
      assert.throws(() => tokenService.verifierAccessToken(tokenAutreType), /Type de token invalide/)
      ok('TYPE INVALIDE — un token signé correctement mais de type différent de "access" est rejeté')
    } catch (e) { fail('TYPE INVALIDE — accepté à tort', e) }

    // ---- G. Organisation désactivée — coupe la connexion ET le
    // rafraîchissement (pas seulement au prochain login complet) ----
    try {
      const { succes: sAvant } = await tokenService.connexion(utilisateur.username, MOT_DE_PASSE)
      await OrganisationsDAO.setStatut(org.id, 'inactive')

      const rConnexion = await tokenService.connexion(utilisateur.username, MOT_DE_PASSE)
      assert.strictEqual(rConnexion.erreur, 'Votre organisation a été désactivée. Contactez votre administrateur.')

      const rRafraichir = await tokenService.rafraichir(sAvant.refreshToken)
      assert.strictEqual(rRafraichir.erreur, 'Votre organisation a été désactivée. Contactez votre administrateur.')

      await OrganisationsDAO.setStatut(org.id, 'active')
      ok('ORGANISATION DÉSACTIVÉE — bloque à la fois une nouvelle connexion et le rafraîchissement d\'une session déjà ouverte')
    } catch (e) {
      fail('ORGANISATION DÉSACTIVÉE — pas correctement bloquée', e)
      await OrganisationsDAO.setStatut(org.id, 'active').catch(() => {})
    }
  } finally {
    if (secretOriginal === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = secretOriginal

    if (org?.id) {
      await pool.query('DELETE FROM utilisateurs WHERE organisation_id = $1', [org.id])
      await pool.query('DELETE FROM organisations WHERE id = $1', [org.id])
    }
  }

  console.log('\n=== RÉSULTATS — Rotation des refresh tokens (server/api/auth/tokenService) ===')
  for (const r of resultats) console.log((r.ok ? 'OK   ' : 'FAIL ') + r.l + (r.ok ? '' : ' :: ' + r.err))
  const echecs = resultats.filter(r => !r.ok)
  console.log(`\nTotal: ${resultats.length}, Échecs: ${echecs.length}`)
  await pool.end()
  process.exit(echecs.length ? 1 : 0)
}

main().catch(async e => {
  console.error('ERREUR FATALE', e)
  try { await pool.end() } catch {}
  process.exit(1)
})
