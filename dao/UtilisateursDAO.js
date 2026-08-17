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

  async create(user, organisationId) {
    const existant = await pool.query(
      'SELECT id FROM utilisateurs WHERE username = $1',
      [user.username]
    )
    if (existant.rows.length) return { erreur: 'Cet identifiant existe déjà !' }

    const hashedPwd = await AuthService.hashPassword(user.password)
    const { rows } = await pool.query(
      'INSERT INTO utilisateurs (nom, username, password, role, organisation_id) VALUES ($1,$2,$3,$4,$5) RETURNING id, nom, username, role',
      [user.nom, user.username, hashedPwd, user.role, organisationId]
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
  }
}

module.exports = UtilisateursDAO
