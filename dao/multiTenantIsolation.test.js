// Audit du 22/08/2026 — vérifie contre une vraie base PostgreSQL que le
// cloisonnement organisation_id (voir docs/FONDATION-MULTI-TENANT.md §4) est
// réellement étanche, pas seulement "les requêtes ont l'air scopées à la
// lecture du code". Couvre ClientsDAO et ProduitsDAO (même pattern répété à
// l'identique dans tous les autres DAO métier — AchatsDAO, VentesDAO,
// DevisDAO, etc. — donc représentatif de l'ensemble).
//
// Même convention que permissionsService.reconciliation.test.js : script
// Node nu (assert + ok/fail), aucun framework de test. Crée deux
// organisations de test, opère avec l'une sur les données de l'autre,
// vérifie qu'aucune fuite de lecture/écriture/suppression ne traverse la
// frontière — puis nettoie tout ce qu'il a créé, quoi qu'il arrive.
//
// Nécessite une vraie connexion PostgreSQL (DATABASE_URL ou PGHOST/PGUSER/...
// dans l'environnement — voir server/api/.env.example). Exécution :
// node dao/multiTenantIsolation.test.js
const assert = require('assert')
const pool = require('../db/pool')
const OrganisationsDAO = require('./OrganisationsDAO')
const ClientsDAO = require('./ClientsDAO')
const ProduitsDAO = require('./ProduitsDAO')

const SUFFIXE = `${process.pid}_${Date.now()}`

async function main() {
  const resultats = []
  function ok(l) { resultats.push({ l, ok: true }) }
  function fail(l, e) { resultats.push({ l, ok: false, err: e ? (e.message || String(e)) : '' }) }

  let orgA, orgB
  try {
    orgA = await OrganisationsDAO.create({ nom: 'Test Isolation A', code: `test_iso_a_${SUFFIXE}` })
    orgB = await OrganisationsDAO.create({ nom: 'Test Isolation B', code: `test_iso_b_${SUFFIXE}` })

    const { succes: clientA } = await ClientsDAO.create(
      { nom: 'Client A', type: 'particulier', telephone: `7000${SUFFIXE}`.slice(0, 12), email: null, adresse: null },
      orgA.id
    )
    const { succes: produitA } = await ProduitsDAO.create(
      { nom: 'Produit A', categorie: 'Test', prix_achat: 100, prix_vente: 200, stock_actuel: 10, stock_minimum: 1, unite: 'unite' },
      orgA.id
    )
    assert.ok(clientA && produitA, 'préparation : client et produit de test créés dans orgA')

    // ---- A. Isolation en lecture ----
    try {
      const clientsVusParB = await ClientsDAO.getAll(orgB.id)
      const produitsVusParB = await ProduitsDAO.getAll(orgB.id)
      assert.ok(!clientsVusParB.some(c => c.id === clientA.id), 'orgB ne doit pas voir le client de orgA')
      assert.ok(!produitsVusParB.some(p => p.id === produitA.id), 'orgB ne doit pas voir le produit de orgA')
      ok('LECTURE — orgB.getAll() ne retourne aucune donnée appartenant à orgA')
    } catch (e) { fail('LECTURE — fuite de données entre organisations', e) }

    // ---- B. Isolation en écriture (update) — control positif inclus : une
    // requête cassée qui ne modifierait jamais rien (même en bonne
    // organisation) ferait passer ce test à tort sans le contrôle positif. ----
    try {
      await ClientsDAO.update({ ...clientA, nom: 'HACKED PAR ORG B' }, orgB.id)
      const [clientRelu] = (await ClientsDAO.getAll(orgA.id)).filter(c => c.id === clientA.id)
      assert.strictEqual(clientRelu.nom, 'Client A', 'update depuis orgB ne doit avoir aucun effet sur le client de orgA')

      await ClientsDAO.update({ ...clientA, nom: 'Client A modifié' }, orgA.id)
      const [clientReluBis] = (await ClientsDAO.getAll(orgA.id)).filter(c => c.id === clientA.id)
      assert.strictEqual(clientReluBis.nom, 'Client A modifié', 'contrôle positif : orgA peut modifier son propre client')

      ok('ÉCRITURE — update cross-organisation sans effet ; update légitime toujours fonctionnel (contrôle positif)')
    } catch (e) { fail('ÉCRITURE — update cross-organisation a modifié une donnée hors périmètre', e) }

    // ---- C. Isolation en suppression ----
    try {
      await ClientsDAO.delete(clientA.id, orgB.id)
      await ProduitsDAO.delete(produitA.id, orgB.id)
      const clientEncorePresent = (await ClientsDAO.getAll(orgA.id)).some(c => c.id === clientA.id)
      const produitEncorePresent = (await ProduitsDAO.getAll(orgA.id)).some(p => p.id === produitA.id)
      assert.ok(clientEncorePresent, 'delete depuis orgB ne doit pas supprimer le client de orgA')
      assert.ok(produitEncorePresent, 'delete depuis orgB ne doit pas supprimer le produit de orgA')

      await ClientsDAO.delete(clientA.id, orgA.id)
      const clientSupprime = (await ClientsDAO.getAll(orgA.id)).some(c => c.id === clientA.id)
      assert.ok(!clientSupprime, 'contrôle positif : orgA peut supprimer son propre client')

      ok('SUPPRESSION — delete cross-organisation sans effet ; delete légitime toujours fonctionnel (contrôle positif)')
    } catch (e) { fail('SUPPRESSION — delete cross-organisation a supprimé une donnée hors périmètre', e) }
  } finally {
    // Nettoyage — dans cet ordre : utilisateurs (aucun créé ici, mais ordre
    // conservé pour rester copiable tel quel par un futur test qui en
    // créerait) puis organisations. clients/produits n'ont pas de FK vers
    // organisations (voir docs/FONDATION-MULTI-TENANT.md §3.2) donc un
    // nettoyage explicite est nécessaire pour ne rien laisser derrière soi.
    const idsOrg = [orgA?.id, orgB?.id].filter(Boolean)
    if (idsOrg.length) {
      await pool.query('DELETE FROM clients WHERE organisation_id = ANY($1)', [idsOrg])
      await pool.query('DELETE FROM produits WHERE organisation_id = ANY($1)', [idsOrg])
      await pool.query('DELETE FROM utilisateurs WHERE organisation_id = ANY($1)', [idsOrg])
      await pool.query('DELETE FROM organisations WHERE id = ANY($1)', [idsOrg])
    }
  }

  console.log('\n=== RÉSULTATS — Isolation multi-tenant (ClientsDAO, ProduitsDAO) ===')
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
