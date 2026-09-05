// Chantier invitations d'equipe — DAO pur, meme pattern que les autres DAO
// metier (organisationId explicite a chaque appel). Le token clair n'est
// jamais stocke ni manipule ici (voir invitationsService.js) : ce DAO ne
// connait que son hash.
const pool = require('../db/pool')

const InvitationsDAO = {
  async create({ organisationId, email, role, tokenHash, inviteParId, expireLe }) {
    // Remplace toute invitation en attente deja existante pour ce couple
    // email/organisation plutot que d'en accumuler plusieurs (ex. un admin
    // qui ré-invite parce que l'email precedent n'est jamais arrive) — la
    // derniere invitation envoyee est la seule valable.
    await pool.query(
      "DELETE FROM invitations_utilisateur WHERE organisation_id = $1 AND lower(email) = lower($2) AND utilise = 0",
      [organisationId, email]
    )
    const { rows: [invitation] } = await pool.query(
      `INSERT INTO invitations_utilisateur (organisation_id, email, role, token_hash, invite_par_id, expire_le)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [organisationId, email, role, tokenHash, inviteParId || null, expireLe]
    )
    return invitation
  },

  // Invitations en attente (ni utilisees ni expirees) d'une organisation,
  // avec le nom de l'invitant pour affichage.
  async getEnAttente(organisationId) {
    const { rows } = await pool.query(
      `SELECT i.id, i.email, i.role, i.expire_le, i.created_at, u.nom AS invite_par_nom
       FROM invitations_utilisateur i
       LEFT JOIN utilisateurs u ON u.id = i.invite_par_id
       WHERE i.organisation_id = $1 AND i.utilise = 0 AND i.expire_le > now()
       ORDER BY i.created_at DESC`,
      [organisationId]
    )
    return rows
  },

  // Utilise par le flux d'acceptation (public, sans organisationId connu à
  // l'avance) — l'appelant doit verrouiller/valider la ligne lui-meme s'il a
  // besoin d'une garantie transactionnelle (voir invitationsService.accepter,
  // meme motif que reinitialisations_mot_de_passe.reinitialiser : usage
  // unique, verrou FOR UPDATE dans la transaction appelante).
  async getByTokenHash(tokenHash, client = pool) {
    const { rows: [invitation] } = await client.query(
      'SELECT * FROM invitations_utilisateur WHERE token_hash = $1 FOR UPDATE',
      [tokenHash]
    )
    return invitation || null
  },

  async marquerUtilisee(id, client = pool) {
    await client.query('UPDATE invitations_utilisateur SET utilise = 1 WHERE id = $1', [id])
  },

  async annuler(id, organisationId) {
    await pool.query(
      'DELETE FROM invitations_utilisateur WHERE id = $1 AND organisation_id = $2',
      [id, organisationId]
    )
  }
}

module.exports = InvitationsDAO
