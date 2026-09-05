// Chantier invitations d'equipe — inviter un collaborateur par email plutot
// que de lui communiquer un mot de passe choisi par l'administrateur. Meme
// conventions crypto que passwordResetService.js (token opaque aleatoire,
// seul son hash SHA-256 est stocke), organisation_id/role figes des
// l'invitation cote emetteur — l'invite ne choisit que son nom, son
// identifiant et son mot de passe en acceptant.
//
// Web (SaaS) uniquement : le lien d'invitation pointe vers NAFIX_BASE_URL
// (le domaine public), ce qui suppose une base de donnees partagee et
// atteignable depuis ce lien — vrai pour le SaaS, faux pour une instance
// Desktop sur un reseau local. Aucun canal IPC Electron n'expose ce service.
const crypto = require('crypto')
const pool = require('../../db/pool')
const AuthService = require('../../auth/AuthService')
const InvitationsDAO = require('../../dao/InvitationsDAO')
const emailService = require('./emailService')

const DUREE_TOKEN_MS = 7 * 24 * 60 * 60 * 1000 // 7 jours — plus long qu'un reset de mot de passe (1h), une invitation attend souvent une disponibilite
const ROLES_VALIDES = ['administrateur', 'gerant', 'comptable', 'caissier']

async function inviter({ organisationId, email, role, inviteParId }) {
  if (!ROLES_VALIDES.includes(role)) return { erreur: 'Rôle invalide' }

  const { rows: [inviteur] } = await pool.query('SELECT nom FROM utilisateurs WHERE id = $1', [inviteParId])
  const { rows: [organisation] } = await pool.query('SELECT nom FROM organisations WHERE id = $1', [organisationId])
  const inviteParNom = inviteur?.nom || 'Un administrateur'
  const organisationNom = organisation?.nom || 'votre organisation'

  const { rows: [dejaMembre] } = await pool.query(
    'SELECT id FROM utilisateurs WHERE organisation_id = $1 AND email = $2',
    [organisationId, email]
  )
  if (dejaMembre) return { erreur: 'Cette personne fait déjà partie de votre équipe.' }

  const tokenClair = crypto.randomBytes(32).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(tokenClair).digest('hex')
  await InvitationsDAO.create({
    organisationId, email, role, tokenHash, inviteParId,
    expireLe: new Date(Date.now() + DUREE_TOKEN_MS)
  })

  const lien = `${process.env.NAFIX_BASE_URL || 'https://nafix.digital'}/accepter-invitation.html?token=${tokenClair}`
  // Fire-and-forget, meme convention que le reste des emails
  // transactionnels : un Resend en panne ne doit jamais faire echouer
  // l'invitation elle-meme (la ligne existe deja en base, l'admin peut
  // toujours partager le lien autrement en cas de souci d'envoi).
  emailService.envoyerEmail({
    to: email,
    subject: `${inviteParNom} vous invite à rejoindre ${organisationNom} sur Nafix`,
    html: `<p>Bonjour,</p>
           <p><strong>${emailService.echapperHtml(inviteParNom)}</strong> vous invite à rejoindre
           <strong>${emailService.echapperHtml(organisationNom)}</strong> sur Nafix, en tant que <strong>${role}</strong>.</p>
           <p>Cliquez sur ce lien pour créer votre compte (valable 7 jours) :</p>
           <p><a href="${lien}">${lien}</a></p>`
  }).catch((e) => console.error('Échec envoi email d\'invitation :', e.message))

  return { succes: true }
}

function getEnAttente(organisationId) {
  return InvitationsDAO.getEnAttente(organisationId)
}

function annuler(id, organisationId) {
  return InvitationsDAO.annuler(id, organisationId)
}

// Apercu public (page d'acceptation) — jamais marque comme utilise, aucune
// donnee sensible renvoyee (ni organisationId, ni role brut au-dela de ce
// qui est deja visible dans l'email recu).
async function getApercu(tokenClair) {
  const tokenHash = crypto.createHash('sha256').update(tokenClair || '').digest('hex')
  const { rows: [invitation] } = await pool.query(
    `SELECT i.email, i.role, i.expire_le, i.utilise, o.nom AS organisation_nom
     FROM invitations_utilisateur i
     JOIN organisations o ON o.id = i.organisation_id
     WHERE i.token_hash = $1`,
    [tokenHash]
  )
  if (!invitation || invitation.utilise || new Date(invitation.expire_le) < new Date()) {
    return { erreur: 'Invitation invalide ou expirée' }
  }
  return { succes: { email: invitation.email, role: invitation.role, organisationNom: invitation.organisation_nom } }
}

async function accepter(tokenClair, { nom, username, password }) {
  const tokenHash = crypto.createHash('sha256').update(tokenClair || '').digest('hex')
  const hash = await AuthService.hashPassword(password)

  // Meme garde transactionnel que passwordResetService.reinitialiser :
  // FOR UPDATE verrouille la ligne, empeche deux requetes concurrentes de
  // rejouer le meme token et de creer deux comptes pour une invitation
  // censee etre a usage unique.
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const invitation = await InvitationsDAO.getByTokenHash(tokenHash, client)
    if (!invitation || invitation.utilise || new Date(invitation.expire_le) < new Date()) {
      await client.query('ROLLBACK')
      return { erreur: 'Invitation invalide ou expirée' }
    }

    const existant = await client.query('SELECT id FROM utilisateurs WHERE username = $1', [username])
    if (existant.rows.length) {
      await client.query('ROLLBACK')
      return { erreur: 'Cet identifiant existe déjà !' }
    }

    const { rows: [utilisateur] } = await client.query(
      `INSERT INTO utilisateurs (nom, username, password, role, organisation_id, email)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, nom, username, role, email, organisation_id`,
      [nom, username, hash, invitation.role, invitation.organisation_id, invitation.email]
    )
    await InvitationsDAO.marquerUtilisee(invitation.id, client)
    await client.query('COMMIT')
    return { succes: utilisateur }
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}

module.exports = { inviter, getEnAttente, annuler, getApercu, accepter }
