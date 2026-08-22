// Chantier PayDunya — intègre un vrai prestataire de paiement à la place du
// billing 100% manuel existant (Platform Admin changeait statut/plan à la
// main). Config via variables d'environnement, même convention que
// JWT_SECRET (server/api/server.js) : PAYDUNYA_MASTER_KEY, PAYDUNYA_PRIVATE_KEY,
// PAYDUNYA_TOKEN, PAYDUNYA_MODE (test|live).
//
// Validé de bout en bout en production le 22/08/2026 : facture créée,
// paiement réel via un client fictif PayDunya, webhook reçu et traité,
// abonnement passé à "actif". Le webhook arrive en
// application/x-www-form-urlencoded (voir express.urlencoded dans app.js),
// champs imbriqués sous "data" — confirmé, plus une hypothèse.
const crypto = require('crypto')
const pool = require('../../db/pool')
const auditLogPlateformeService = require('./auditLogPlateformeService')

const BASE_URL = process.env.PAYDUNYA_MODE === 'live'
  ? 'https://app.paydunya.com/api/v1'
  : 'https://app.paydunya.com/sandbox-api/v1'

function enTetes() {
  return {
    'Content-Type': 'application/json',
    'PAYDUNYA-MASTER-KEY': process.env.PAYDUNYA_MASTER_KEY,
    'PAYDUNYA-PRIVATE-KEY': process.env.PAYDUNYA_PRIVATE_KEY,
    'PAYDUNYA-TOKEN': process.env.PAYDUNYA_TOKEN
  }
}

// Cree une facture PayDunya pour l'abonnement d'une organisation et renvoie
// l'URL de paiement hebergee vers laquelle rediriger l'utilisateur. N'ecrit
// JAMAIS abonnements.statut — seul traiterWebhook() le fait (contrainte de
// securite deja actee dans server/api/routes/abonnement.js : un administrateur
// d'organisation ne doit jamais pouvoir s'auto-octroyer l'acces).
async function creerFacture(organisationId, codePlan) {
  const { rows: [plan] } = await pool.query('SELECT * FROM plans WHERE code = $1 AND actif = 1', [codePlan])
  if (!plan) return { erreur: 'Plan introuvable' }

  const urlBase = process.env.NAFIX_BASE_URL || 'https://nafix.digital'
  let data
  try {
    const reponse = await fetch(`${BASE_URL}/checkout-invoice/create`, {
      method: 'POST',
      headers: enTetes(),
      body: JSON.stringify({
        invoice: {
          total_amount: plan.prix_mensuel,
          description: `Abonnement Nafix — ${plan.nom}`
        },
        store: { name: 'Nafix' },
        actions: {
          callback_url: `${urlBase}/webhooks/paydunya`,
          return_url: urlBase
        },
        custom_data: { organisationId, codePlan }
      })
    })
    data = await reponse.json()
  } catch (e) {
    return { erreur: 'Impossible de contacter le prestataire de paiement.' }
  }

  if (data.response_code !== '00' || !data.token) {
    return { erreur: data.response_text || 'Erreur du prestataire de paiement.' }
  }

  await pool.query(
    'INSERT INTO paiements (organisation_id, plan_id, montant, invoice_token) VALUES ($1,$2,$3,$4)',
    [organisationId, plan.id, plan.prix_mensuel, data.token]
  )

  return { succes: { url: data.response_text, token: data.token } }
}

// Traite la notification (IPN) envoyee par PayDunya apres un paiement.
// Ne fait jamais confiance au corps du webhook seul pour le statut final :
// reconfirme via un appel serveur-a-serveur avant toute ecriture. Idempotent
// (un invoice_token deja "complete" n'est jamais retraite).
async function traiterWebhook(body) {
  // Forme confirmee par un paiement reel en sandbox (22/08/2026) : PayDunya
  // poste en application/x-www-form-urlencoded (jamais JSON), champs
  // imbriques sous "data" (data[hash], data[invoice][token]...). Necessite
  // express.urlencoded({extended:true}) monte cote app.js pour que req.body
  // soit correctement peuple.
  const hashRecu = body?.data?.hash
  const hashAttendu = crypto.createHash('sha512').update(process.env.PAYDUNYA_MASTER_KEY || '').digest('hex')
  if (!hashRecu || hashRecu !== hashAttendu) return { ignore: true, raison: 'hash invalide' }

  const token = body.data?.invoice?.token
  if (!token) return { ignore: true, raison: 'token absent' }

  const { rows: [paiement] } = await pool.query('SELECT * FROM paiements WHERE invoice_token = $1', [token])
  if (!paiement || paiement.statut === 'complete') return { ignore: true, raison: 'inconnu ou deja traite' }

  let confirmation
  try {
    const reponse = await fetch(`${BASE_URL}/checkout-invoice/confirm/${token}`, { headers: enTetes() })
    confirmation = await reponse.json()
  } catch (e) {
    return { ignore: true, raison: 'confirmation injoignable' }
  }

  if (confirmation.status !== 'completed') {
    await pool.query("UPDATE paiements SET statut = 'echoue' WHERE id = $1", [paiement.id])
    return { traite: true, statut: 'echoue' }
  }

  await pool.query("UPDATE paiements SET statut = 'complete', complete_le = CURRENT_TIMESTAMP WHERE id = $1", [paiement.id])
  await pool.query(
    `UPDATE abonnements SET statut = 'actif', plan_id = $1, prochain_paiement_le = $2, updated_at = CURRENT_TIMESTAMP
     WHERE organisation_id = $3`,
    [paiement.plan_id, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), paiement.organisation_id]
  )
  await auditLogPlateformeService.journaliser({
    adminPlateformeId: null, // declenche par PayDunya, pas par un humain — colonne nullable
    action: 'abonnement:paiementConfirme',
    organisationId: paiement.organisation_id,
    details: { invoice_token: token, montant: paiement.montant }
  })

  return { traite: true, statut: 'complete' }
}

// Historique de facturation d'une organisation (Platform Admin uniquement,
// meme reserve que OrganisationsDAO.getAllPourPlateforme).
async function getParOrganisation(organisationId) {
  const { rows } = await pool.query(
    `SELECT p.id, p.montant, p.statut, p.invoice_token, p.created_at, p.complete_le, pl.nom AS plan_nom
     FROM paiements p
     JOIN plans pl ON p.plan_id = pl.id
     WHERE p.organisation_id = $1
     ORDER BY p.created_at DESC`,
    [organisationId]
  )
  return rows
}

module.exports = { creerFacture, traiterWebhook, getParOrganisation }
