// Audit du 22/08/2026 — vérifie traiterWebhook() (paydunyaService.js) contre
// une vraie base PostgreSQL : validation du hash, absence de confiance
// aveugle dans le corps du webhook (reconfirmation serveur-à-serveur),
// idempotence sur un paiement déjà complet. global.fetch est temporairement
// remplacé par une fausse implémentation pour simuler la réponse de
// PayDunya sans appel réseau réel — aucune nouvelle dépendance, fetch est
// déjà un global Node (même choix que paydunyaService.js lui-même).
//
// Même convention que permissionsService.reconciliation.test.js : script
// Node nu (assert + ok/fail), aucun framework de test. Exécution :
// node core/services/paydunyaService.webhook.test.js
const assert = require('assert')
const crypto = require('crypto')
const pool = require('../../db/pool')
const OrganisationsDAO = require('../../dao/OrganisationsDAO')
const paydunyaService = require('./paydunyaService')

const SUFFIXE = `${process.pid}_${Date.now()}`
const MASTER_KEY_TEST = `cle-test-${SUFFIXE}`
const hashValide = crypto.createHash('sha512').update(MASTER_KEY_TEST).digest('hex')

async function main() {
  const resultats = []
  function ok(l) { resultats.push({ l, ok: true }) }
  function fail(l, e) { resultats.push({ l, ok: false, err: e ? (e.message || String(e)) : '' }) }

  const masterKeyOriginale = process.env.PAYDUNYA_MASTER_KEY
  const fetchOriginal = global.fetch
  process.env.PAYDUNYA_MASTER_KEY = MASTER_KEY_TEST

  let org
  try {
    org = await OrganisationsDAO.create({ nom: 'Test Webhook PayDunya', code: `test_webhook_${SUFFIXE}` })
    const { rows: [plan] } = await pool.query("SELECT id, prix_mensuel FROM plans WHERE code = 'standard'")
    const { rows: [planEssai] } = await pool.query("SELECT id FROM plans WHERE code = 'essai_gratuit'")
    assert.ok(plan, 'préparation : le plan "standard" existe (seedé par db/migrate.js)')
    // traiterWebhook() fait un UPDATE abonnements, jamais un INSERT (la ligne
    // est censée exister depuis la création de l'organisation — voir
    // OrganisationsDAO.creerAvecAdmin) : reproduire cette précondition, sans
    // quoi la mise à jour ne toucherait silencieusement aucune ligne.
    await pool.query(
      "INSERT INTO abonnements (organisation_id, plan_id, statut) VALUES ($1,$2,'essai')",
      [org.id, planEssai.id]
    )

    // ---- A. Hash absent ou invalide — jamais de confiance dans le corps
    // seul, quel que soit son contenu par ailleurs. ----
    try {
      const r1 = await paydunyaService.traiterWebhook({})
      const r2 = await paydunyaService.traiterWebhook({ data: { hash: 'un-hash-invente' } })
      assert.strictEqual(r1.ignore, true)
      assert.strictEqual(r2.ignore, true)
      assert.strictEqual(r2.raison, 'hash invalide')
      ok('HASH — corps sans hash ou avec un hash incorrect systématiquement ignoré')
    } catch (e) { fail('HASH — un hash absent/invalide n\'a pas été rejeté', e) }

    // ---- B. Hash valide mais token de facture absent ----
    try {
      const r = await paydunyaService.traiterWebhook({ data: { hash: hashValide, invoice: {} } })
      assert.strictEqual(r.ignore, true)
      assert.strictEqual(r.raison, 'token absent')
      ok('TOKEN ABSENT — hash valide sans invoice.token correctement ignoré')
    } catch (e) { fail('TOKEN ABSENT — non détecté', e) }

    // ---- C. Hash valide, token inconnu en base (jamais émis par
    // creerFacture) — un attaquant qui connaîtrait la master key ne peut pas
    // fabriquer un paiement pour un token qui n'existe pas côté Nafix. ----
    try {
      const r = await paydunyaService.traiterWebhook({ data: { hash: hashValide, invoice: { token: `token-inconnu-${SUFFIXE}` } } })
      assert.strictEqual(r.ignore, true)
      assert.strictEqual(r.raison, 'inconnu ou deja traite')
      ok('TOKEN INCONNU — un invoice_token jamais créé par creerFacture() est ignoré')
    } catch (e) { fail('TOKEN INCONNU — non détecté', e) }

    // ---- D. Flux complet — paiement en attente, PayDunya confirme
    // "completed" : jamais confiance dans le corps du webhook seul, la
    // reconfirmation serveur-à-serveur (fetch simulé ici) est ce qui fait
    // foi. ----
    const tokenFactureD = `token-d-${SUFFIXE}`
    let appelsFetch = 0
    try {
      await pool.query(
        'INSERT INTO paiements (organisation_id, plan_id, montant, invoice_token) VALUES ($1,$2,$3,$4)',
        [org.id, plan.id, plan.prix_mensuel, tokenFactureD]
      )
      global.fetch = async (url) => {
        appelsFetch++
        assert.ok(String(url).includes(tokenFactureD), 'la confirmation doit porter sur le bon token')
        return { json: async () => ({ status: 'completed' }) }
      }

      const r = await paydunyaService.traiterWebhook({ data: { hash: hashValide, invoice: { token: tokenFactureD } } })
      assert.strictEqual(r.traite, true)
      assert.strictEqual(r.statut, 'complete')
      assert.strictEqual(appelsFetch, 1, 'la confirmation doit être appelée exactement une fois')

      const { rows: [paiementRelu] } = await pool.query('SELECT statut FROM paiements WHERE invoice_token = $1', [tokenFactureD])
      const { rows: [abonnementRelu] } = await pool.query('SELECT statut, plan_id FROM abonnements WHERE organisation_id = $1', [org.id])
      assert.strictEqual(paiementRelu.statut, 'complete')
      assert.strictEqual(abonnementRelu.statut, 'actif')
      assert.strictEqual(abonnementRelu.plan_id, plan.id)

      ok('FLUX COMPLET — paiement confirmé côté PayDunya : paiement "complete", abonnement "actif" sur le bon plan')
    } catch (e) { fail('FLUX COMPLET — traitement incorrect d\'une confirmation positive', e) }

    // ---- E. Idempotence — rejouer la même notification (PayDunya retente
    // en l'absence de réponse) ne doit jamais retraiter un paiement déjà
    // complet, ni rappeler la confirmation. ----
    try {
      appelsFetch = 0
      const r = await paydunyaService.traiterWebhook({ data: { hash: hashValide, invoice: { token: tokenFactureD } } })
      assert.strictEqual(r.ignore, true)
      assert.strictEqual(r.raison, 'inconnu ou deja traite')
      assert.strictEqual(appelsFetch, 0, 'un paiement déjà complet ne doit plus jamais déclencher de reconfirmation')
      ok('IDEMPOTENCE — rejouer la notification sur un paiement déjà complet est un no-op')
    } catch (e) { fail('IDEMPOTENCE — un paiement déjà complet a été retraité', e) }

    // ---- F. PayDunya confirme un statut autre que "completed" — le
    // paiement passe à "echoue", jamais à "complete" sur la seule foi du
    // corps du webhook. ----
    const tokenFactureF = `token-f-${SUFFIXE}`
    try {
      await pool.query(
        'INSERT INTO paiements (organisation_id, plan_id, montant, invoice_token) VALUES ($1,$2,$3,$4)',
        [org.id, plan.id, plan.prix_mensuel, tokenFactureF]
      )
      global.fetch = async () => ({ json: async () => ({ status: 'cancelled' }) })

      const r = await paydunyaService.traiterWebhook({ data: { hash: hashValide, invoice: { token: tokenFactureF } } })
      assert.strictEqual(r.traite, true)
      assert.strictEqual(r.statut, 'echoue')
      const { rows: [paiementRelu] } = await pool.query('SELECT statut FROM paiements WHERE invoice_token = $1', [tokenFactureF])
      assert.strictEqual(paiementRelu.statut, 'echoue')

      ok('CONFIRMATION NÉGATIVE — statut PayDunya différent de "completed" marque le paiement "echoue"')
    } catch (e) { fail('CONFIRMATION NÉGATIVE — non traitée correctement', e) }
  } finally {
    global.fetch = fetchOriginal
    if (masterKeyOriginale === undefined) delete process.env.PAYDUNYA_MASTER_KEY
    else process.env.PAYDUNYA_MASTER_KEY = masterKeyOriginale

    if (org?.id) {
      await pool.query('DELETE FROM paiements WHERE organisation_id = $1', [org.id])
      await pool.query('DELETE FROM abonnements WHERE organisation_id = $1', [org.id])
      await pool.query('DELETE FROM utilisateurs WHERE organisation_id = $1', [org.id])
      await pool.query('DELETE FROM organisations WHERE id = $1', [org.id])
    }
  }

  console.log('\n=== RÉSULTATS — Webhook PayDunya (paydunyaService.traiterWebhook) ===')
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
