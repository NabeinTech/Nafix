// Premier test d'intégration HTTP réel sur server/api/app.js — jusqu'ici,
// seuls les DAO/services étaient testés directement (voir
// dao/multiTenantIsolation.test.js, server/api/auth/tokenService.rotation.test.js) ;
// aucun test n'appelait une vraie route Express, donc jamais vérifié : la
// validation d'entrée, le middleware d'authentification, le gate
// d'abonnement, les codes de statut HTTP renvoyés au client.
//
// creerApp() (server/api/app.js) est explicitement conçu pour ça depuis
// Sprint 15 ("app.listen(0) dans les tests, port réel dans server.js") —
// jamais exploité jusqu'à présent. Pas de supertest (dépendance absente,
// même philosophie "fetch natif plutôt qu'un SDK" que emailService.js/
// paydunyaService.js) : un vrai serveur HTTP sur un port éphémère + fetch().
//
// Connexion à la base LOCALE de développement (config/db.config.json — la
// même que la suite Electron test-sprintN.js), jamais à la base Railway de
// production : deux organisations de test isolées, nettoyées en fin
// d'exécution quoi qu'il arrive. Exécution : node server/api/app.http.test.js
const assert = require('assert')

const dbConfig = require('../../config/db.config.json')
process.env.PGHOST = dbConfig.host
process.env.PGPORT = String(dbConfig.port)
process.env.PGUSER = dbConfig.user
process.env.PGPASSWORD = dbConfig.password
process.env.PGDATABASE = dbConfig.database
process.env.PGSSL = 'disable'
process.env.JWT_SECRET = process.env.JWT_SECRET || `secret-test-http-${process.pid}`

const pool = require('../../db/pool')
const { creerApp } = require('./app')
const organisationsService = require('../../core/services/organisationsService')

const SUFFIXE = `${process.pid}_${Date.now()}`
const MOT_DE_PASSE = 'mot-de-passe-test-1234'

async function main() {
  const resultats = []
  function ok(l) { resultats.push({ l, ok: true }) }
  function fail(l, e) { resultats.push({ l, ok: false, err: e ? (e.message || String(e)) : '' }) }

  const app = creerApp()
  const serveur = app.listen(0)
  const port = serveur.address().port
  const base = `http://127.0.0.1:${port}`

  let orgAId, orgBId, produitId

  try {
    // ---- A. Route protégée sans token -> 401 ----
    try {
      const r = await fetch(`${base}/produits`)
      const corps = await r.json()
      assert.strictEqual(r.status, 401)
      assert.strictEqual(corps.erreur, 'Authentification requise')
      ok('SANS TOKEN — 401 sur une route protégée')
    } catch (e) { fail('SANS TOKEN', e) }

    // ---- B. Inscription réelle via HTTP — crée organisation + admin, auto-connecte ----
    let tokenA
    const usernameA = `test_http_a_${SUFFIXE}`
    try {
      const r = await fetch(`${base}/auth/signup`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom: 'Test HTTP A', adminNom: 'Admin A', username: usernameA, password: MOT_DE_PASSE, email: null })
      })
      const corps = await r.json()
      assert.strictEqual(r.status, 201)
      assert.ok(corps.accessToken, 'la reponse de /auth/signup doit contenir un accessToken (auto-connexion)')
      tokenA = corps.accessToken

      const { rows: [u] } = await pool.query('SELECT organisation_id FROM utilisateurs WHERE username = $1', [usernameA])
      orgAId = u.organisation_id
      const { rows: [a] } = await pool.query('SELECT statut FROM abonnements WHERE organisation_id = $1', [orgAId])
      assert.strictEqual(a.statut, 'essai', 'une organisation fraichement inscrite doit demarrer en essai')
      ok('SIGNUP — POST /auth/signup crée organisation + admin + abonnement essai, et auto-connecte (201 + accessToken)')
    } catch (e) { fail('SIGNUP', e) }

    // ---- C. Ré-inscription avec le même identifiant -> erreur explicite ----
    try {
      const r = await fetch(`${base}/auth/signup`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom: 'Doublon', adminNom: 'Doublon', username: usernameA, password: MOT_DE_PASSE, email: null })
      })
      const corps = await r.json()
      assert.strictEqual(r.status, 400)
      assert.strictEqual(corps.erreur, 'Cet identifiant existe déjà !')
      ok('SIGNUP DOUBLON — même identifiant refusé (400, message explicite)')
    } catch (e) { fail('SIGNUP DOUBLON', e) }

    // ---- D. Organisation B, créée côté service (pas HTTP) pour tester /auth/login séparément ----
    const usernameB = `test_http_b_${SUFFIXE}`
    let tokenB
    try {
      const creation = await organisationsService.creerAvecAdmin({ nom: 'Test HTTP B', adminNom: 'Admin B', username: usernameB, password: MOT_DE_PASSE, email: null })
      assert.ok(creation.succes, 'préparation : organisation B créée')
      orgBId = creation.succes.organisation.id

      const r = await fetch(`${base}/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameB, password: MOT_DE_PASSE })
      })
      const corps = await r.json()
      assert.strictEqual(r.status, 200)
      assert.ok(corps.accessToken)
      tokenB = corps.accessToken
      ok('LOGIN — identifiants corrects renvoient 200 + accessToken')
    } catch (e) { fail('LOGIN', e) }

    // ---- E. Mauvais mot de passe -> 401, message générique (anti-énumération) ----
    try {
      const r = await fetch(`${base}/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameB, password: 'mauvais-mot-de-passe' })
      })
      assert.strictEqual(r.status, 401)
      ok('LOGIN REFUSÉ — mauvais mot de passe -> 401')
    } catch (e) { fail('LOGIN REFUSÉ', e) }

    // ---- F. Token valide -> liste vide au départ ----
    try {
      const r = await fetch(`${base}/produits`, { headers: { Authorization: `Bearer ${tokenA}` } })
      const corps = await r.json()
      assert.strictEqual(r.status, 200)
      assert.ok(Array.isArray(corps) && corps.length === 0)
      ok('TOKEN VALIDE — GET /produits renvoie 200 + tableau vide pour une organisation neuve')
    } catch (e) { fail('TOKEN VALIDE', e) }

    // ---- G. Création d'un produit via HTTP, organisation A ----
    try {
      const r = await fetch(`${base}/produits`, {
        method: 'POST', headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom: `Produit HTTP ${SUFFIXE}`, prix_vente: 1000, stock_actuel: 5 })
      })
      const corps = await r.json()
      assert.strictEqual(r.status, 201)
      assert.ok(corps.succes?.id, 'produitsService.create renvoie {succes: produit}, pas le produit directement')
      produitId = corps.succes.id
      ok('CRÉATION — POST /produits renvoie 201 + le produit créé')
    } catch (e) { fail('CRÉATION', e) }

    // ---- H. Isolation multi-tenant via HTTP — B ne voit jamais le produit de A ----
    try {
      const r = await fetch(`${base}/produits`, { headers: { Authorization: `Bearer ${tokenB}` } })
      const corps = await r.json()
      assert.ok(!corps.some(p => p.id === produitId), 'le produit de A ne doit jamais apparaître dans la liste de B')
      ok('ISOLATION HTTP — GET /produits d\'une organisation ne renvoie jamais les produits d\'une autre')
    } catch (e) { fail('ISOLATION HTTP — lecture', e) }

    // ---- I. B ne peut pas supprimer le produit de A (DELETE scope organisation_id) ----
    try {
      await fetch(`${base}/produits/${produitId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${tokenB}` } })
      const verif = await pool.query('SELECT id FROM produits WHERE id = $1', [produitId])
      assert.strictEqual(verif.rows.length, 1, 'le produit de A doit toujours exister après une tentative de suppression par B')
      ok('ISOLATION HTTP — DELETE avec le token d\'une autre organisation ne supprime rien')
    } catch (e) { fail('ISOLATION HTTP — suppression', e) }

    // ---- J. Gate d'abonnement — organisation suspendue bloquée sur les routes
    // métier, mais /abonnement reste consultable ----
    try {
      await pool.query("UPDATE abonnements SET statut = 'suspendu' WHERE organisation_id = $1", [orgAId])

      const rProduits = await fetch(`${base}/produits`, { headers: { Authorization: `Bearer ${tokenA}` } })
      const corpsProduits = await rProduits.json()
      assert.strictEqual(rProduits.status, 402)
      assert.strictEqual(corpsProduits.statutAbonnement, 'suspendu')

      const rAbonnement = await fetch(`${base}/abonnement`, { headers: { Authorization: `Bearer ${tokenA}` } })
      assert.notStrictEqual(rAbonnement.status, 402, '/abonnement doit rester accessible même abonnement suspendu')

      ok('GATE ABONNEMENT — organisation suspendue bloquée (402) sur les routes métier, /abonnement reste consultable')
    } catch (e) {
      fail('GATE ABONNEMENT', e)
    } finally {
      await pool.query("UPDATE abonnements SET statut = 'essai' WHERE organisation_id = $1", [orgAId]).catch(() => {})
    }

    // ---- K. Route inconnue -> 404 propre ----
    try {
      const r = await fetch(`${base}/route-qui-nexiste-pas`, { headers: { Authorization: `Bearer ${tokenA}` } })
      const corps = await r.json()
      assert.strictEqual(r.status, 404)
      assert.ok(corps.erreur)
      ok('ROUTE INCONNUE — 404 propre avec {erreur}')
    } catch (e) { fail('ROUTE INCONNUE', e) }
  } finally {
    if (produitId) await pool.query('DELETE FROM produits WHERE id = $1', [produitId]).catch(() => {})
    for (const orgId of [orgAId, orgBId]) {
      if (!orgId) continue
      await pool.query('DELETE FROM utilisateurs WHERE organisation_id = $1', [orgId]).catch(() => {})
      await pool.query('DELETE FROM abonnements WHERE organisation_id = $1', [orgId]).catch(() => {})
      await pool.query('DELETE FROM organisations WHERE id = $1', [orgId]).catch(() => {})
    }
    // Compteurs de rate limiting générés par ce test (loopback local, jamais
    // une IP cliente réelle) — pour que relancer ce fichier plusieurs fois de
    // suite ne finisse pas par se heurter à sa propre limite.
    await pool.query("DELETE FROM limites_tentatives WHERE cle IN ('127.0.0.1', '::1', '::ffff:127.0.0.1')").catch(() => {})
    await new Promise(resolve => serveur.close(resolve))
  }

  console.log('\n=== RÉSULTATS — Intégration HTTP (server/api/app.js) ===')
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
