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
const UtilisateursDAO = require('../../dao/UtilisateursDAO')
const emailService = require('./emailService')

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
  // Audit securite — traiterWebhook() echoue deja proprement si
  // PAYDUNYA_MASTER_KEY est absente ; creerFacture() n'avait aucun garde
  // equivalent et enverrait silencieusement des en-tetes "undefined" a
  // l'API reelle de PayDunya. Echoue tot avec un message clair plutot que
  // de laisser PayDunya renvoyer une erreur opaque.
  if (!process.env.PAYDUNYA_MASTER_KEY || !process.env.PAYDUNYA_PRIVATE_KEY || !process.env.PAYDUNYA_TOKEN) {
    return { erreur: 'Configuration du prestataire de paiement incomplète.' }
  }

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
  // Audit securite — sans PAYDUNYA_MASTER_KEY configuree, hashAttendu
  // degradait silencieusement vers sha512('') : une constante publique et
  // precalculable, que n'importe qui peut envoyer pour passer la
  // verification. Echec ferme explicite plutot que de laisser la
  // verification devenir un controle vide de sens.
  if (!process.env.PAYDUNYA_MASTER_KEY) return { ignore: true, raison: 'PAYDUNYA_MASTER_KEY non configuree' }

  // Forme confirmee par un paiement reel en sandbox (22/08/2026) : PayDunya
  // poste en application/x-www-form-urlencoded (jamais JSON), champs
  // imbriques sous "data" (data[hash], data[invoice][token]...). Necessite
  // express.urlencoded({extended:true}) monte cote app.js pour que req.body
  // soit correctement peuple.
  const hashRecu = body?.data?.hash
  const hashAttendu = crypto.createHash('sha512').update(process.env.PAYDUNYA_MASTER_KEY).digest('hex')
  // Audit securite — comparaison a temps constant (crypto.timingSafeEqual)
  // plutot que !==, pour eviter un canal auxiliaire temporel sur un secret
  // partage. Longueur verifiee avant (timingSafeEqual leve si les tampons
  // n'ont pas la meme taille ; une longueur differente n'est pas secrete —
  // un hash SHA-512 hex fait toujours 128 caracteres).
  const hashRecuValide = typeof hashRecu === 'string' &&
    hashRecu.length === hashAttendu.length &&
    crypto.timingSafeEqual(Buffer.from(hashRecu), Buffer.from(hashAttendu))
  if (!hashRecuValide) return { ignore: true, raison: 'hash invalide' }

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
    // Chantier emails transactionnels — fire-and-forget, n'affecte jamais la
    // reponse au webhook (toujours 200 vers PayDunya, meme si l'envoi echoue
    // ou si aucun administrateur n'a d'email renseigne).
    UtilisateursDAO.getAdministrateursAvecEmail(paiement.organisation_id).then((administrateurs) => {
      for (const admin of administrateurs) {
        emailService.envoyerEmail({
          to: admin.email,
          subject: 'Échec de votre paiement Nafix',
          html: `<p>Bonjour ${emailService.echapperHtml(admin.nom)},</p>
                 <p>Votre paiement d'abonnement n'a pas pu être confirmé. Merci de réessayer depuis l'onglet Paramètres.</p>`
        }).catch((e) => console.error('Échec envoi email de paiement échoué :', e.message))
      }
    }).catch((e) => console.error('Recherche des administrateurs (email paiement echoue) echouee :', e.message))
    return { traite: true, statut: 'echoue' }
  }

  // Audit securite — les 2 ecritures + le log d'audit tournaient sur des
  // pool.query() independants : un crash entre les deux UPDATE laissait
  // paiements.statut="complete" sans jamais activer l'abonnement, et le
  // garde-fou d'idempotence (ligne ci-dessus) empechait tout rejeu du
  // webhook de reparer cet etat — seule une intervention manuelle Platform
  // Admin le pouvait. Meme pattern BEGIN/COMMIT que OrganisationsDAO/
  // RetoursDAO/TresorerieDAO (deja etabli ailleurs dans le depot).
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query("UPDATE paiements SET statut = 'complete', complete_le = CURRENT_TIMESTAMP WHERE id = $1", [paiement.id])
    await client.query(
      `UPDATE abonnements SET statut = 'actif', plan_id = $1, prochain_paiement_le = $2, updated_at = CURRENT_TIMESTAMP
       WHERE organisation_id = $3`,
      [paiement.plan_id, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), paiement.organisation_id]
    )
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }

  // Le log d'audit reste hors transaction (table separee, pas de contrainte
  // d'integrite avec paiements/abonnements) — un echec ici ne doit pas faire
  // annuler l'activation deja committee.
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
