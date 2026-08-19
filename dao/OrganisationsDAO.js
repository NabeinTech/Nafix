const pool = require('../db/pool')
const AuthService = require('../auth/AuthService')

const OrganisationsDAO = {
  async getById(id) {
    const { rows } = await pool.query(
      'SELECT id, nom, code, statut, created_at FROM organisations WHERE id = $1',
      [id]
    )
    return rows[0] || null
  },

  // "code" n'est jamais modifiable ici : db/migrate.js retrouve l'organisation
  // legacy via WHERE code = 'legacy' au démarrage — le changer romprait ce
  // lookup et créerait une organisation fantôme au redémarrage suivant.
  async update(id, { nom }) {
    const { rows } = await pool.query(
      'UPDATE organisations SET nom = $1 WHERE id = $2 RETURNING id, nom, code, statut, created_at',
      [nom, id]
    )
    return rows[0] || null
  },

  async setStatut(id, statut) {
    const statutsValides = ['active', 'inactive']
    if (!statutsValides.includes(statut)) return { erreur: 'Statut invalide' }
    const { rows } = await pool.query(
      'UPDATE organisations SET statut = $1 WHERE id = $2 RETURNING id, nom, code, statut, created_at',
      [statut, id]
    )
    return { succes: rows[0] }
  },

  // Disponible pour un futur flux d'onboarding SaaS — pas encore exposée
  // dans l'UI Desktop (une organisation créée ici serait orpheline : aucun
  // utilisateur, inaccessible depuis une installation mono-organisation).
  async create({ nom, code }) {
    const { rows } = await pool.query(
      "INSERT INTO organisations (nom, code, statut) VALUES ($1, $2, 'active') RETURNING id, nom, code, statut, created_at",
      [nom, code || null]
    )
    return rows[0]
  },

  // Onboarding self-service — appelé avant toute session (écran de connexion),
  // donc sans organisationId/RBAC à ce stade : la seule protection possible
  // est la validation des données. Transaction unique : si le username existe
  // déjà, tout est annulé — jamais d'organisation orpheline sans utilisateur.
  async creerAvecAdmin({ nom, adminNom, username, password }) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const existant = await client.query('SELECT id FROM utilisateurs WHERE username = $1', [username])
      if (existant.rows.length) {
        await client.query('ROLLBACK')
        return { erreur: 'Cet identifiant existe déjà !' }
      }

      const { rows: [organisation] } = await client.query(
        "INSERT INTO organisations (nom, code, statut) VALUES ($1, NULL, 'active') RETURNING id, nom, code, statut, created_at",
        [nom]
      )

      const hashedPwd = await AuthService.hashPassword(password)
      const { rows: [utilisateur] } = await client.query(
        `INSERT INTO utilisateurs (nom, username, password, role, organisation_id)
         VALUES ($1, $2, $3, 'administrateur', $4)
         RETURNING id, nom, username, role, organisation_id`,
        [adminNom, username, hashedPwd, organisation.id]
      )

      await client.query('COMMIT')
      return { succes: { organisation, utilisateur } }
    } catch (err) {
      await client.query('ROLLBACK')
      return { erreur: err.message }
    } finally {
      client.release()
    }
  }
}

module.exports = OrganisationsDAO
