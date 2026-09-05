const pool = require('../db/pool')
const AuthService = require('../auth/AuthService')

const UtilisateursDAO = {
  async getAll(organisationId) {
    const { rows } = await pool.query(
      'SELECT id, nom, username, role, permissions_custom, created_at FROM utilisateurs WHERE organisation_id = $1 ORDER BY created_at',
      [organisationId]
    )
    return rows
  },

  // Pas de filtre organisation ici : c'est le login lui-même — l'organisation
  // n'est pas encore connue, c'est justement ce qu'on cherche à déterminer
  // (username reste l'identifiant de connexion unique, globalement).
  async findByUsername(username) {
    const { rows } = await pool.query(
      'SELECT * FROM utilisateurs WHERE username = $1',
      [username]
    )
    return rows[0] || null
  },

  // Chantier RGPD — re-confirmation par mot de passe avant une action
  // irreversible (demande de suppression d'organisation) : scope par
  // organisation par prudence, meme si id vient toujours du token verifie
  // (req.tenantContext.userId), jamais d'une valeur fournie par le client.
  async getByIdAvecPassword(id, organisationId) {
    const { rows } = await pool.query(
      'SELECT id, password FROM utilisateurs WHERE id = $1 AND organisation_id = $2',
      [id, organisationId]
    )
    return rows[0] || null
  },

  async create(user, organisationId) {
    const existant = await pool.query(
      'SELECT id FROM utilisateurs WHERE username = $1',
      [user.username]
    )
    if (existant.rows.length) return { erreur: 'Cet identifiant existe déjà !' }

    if (user.email) {
      const emailExistant = await pool.query('SELECT id FROM utilisateurs WHERE email = $1', [user.email])
      if (emailExistant.rows.length) return { erreur: 'Cet email est déjà utilisé par un autre compte !' }
    }

    const hashedPwd = await AuthService.hashPassword(user.password)
    const { rows } = await pool.query(
      'INSERT INTO utilisateurs (nom, username, password, role, organisation_id, email) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, nom, username, role, email',
      [user.nom, user.username, hashedPwd, user.role, organisationId, user.email || null]
    )
    return { succes: rows[0] }
  },

  async delete(id, organisationId) {
    await pool.query(
      "DELETE FROM utilisateurs WHERE id = $1 AND username != 'admin' AND organisation_id = $2",
      [id, organisationId]
    )
    return { succes: true }
  },

  async updatePassword(id, password, organisationId) {
    const hashedPwd = await AuthService.hashPassword(password)
    await pool.query('UPDATE utilisateurs SET password = $1 WHERE id = $2 AND organisation_id = $3', [hashedPwd, id, organisationId])
    return { succes: true }
  },

  async updateRole(id, role, organisationId) {
    const rolesValides = ['administrateur', 'gerant', 'comptable', 'caissier']
    if (!rolesValides.includes(role)) return { erreur: 'Rôle invalide' }
    await pool.query(
      "UPDATE utilisateurs SET role = $1 WHERE id = $2 AND username != 'admin' AND organisation_id = $3",
      [role, id, organisationId]
    )
    return { succes: true }
  },

  async updatePermissions(id, permissions, organisationId) {
    await pool.query(
      'UPDATE utilisateurs SET permissions_custom = $1 WHERE id = $2 AND organisation_id = $3',
      [JSON.stringify(permissions), id, organisationId]
    )
    return { succes: true }
  },

  // Chantier emails transactionnels — destinataires des notifications
  // d'organisation (relance essai, echec de paiement) : les administrateurs
  // qui ont renseigne un email (optionnel a l'inscription/creation de
  // compte). Generalement un seul, mais pas de suppositions sur le nombre.
  async getAdministrateursAvecEmail(organisationId) {
    const { rows } = await pool.query(
      "SELECT nom, email FROM utilisateurs WHERE organisation_id = $1 AND role = 'administrateur' AND email IS NOT NULL",
      [organisationId]
    )
    return rows
  }
}

module.exports = UtilisateursDAO
