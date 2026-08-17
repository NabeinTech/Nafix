const pool = require('../db/pool')

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
  }
}

module.exports = OrganisationsDAO
