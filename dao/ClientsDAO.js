const pool = require('../db/pool')

const ClientsDAO = {
  async getAll(organisationId) {
    const { rows } = await pool.query('SELECT * FROM clients WHERE organisation_id = $1 ORDER BY nom', [organisationId])
    return rows
  },

  async create(client, organisationId) {
    if (client.telephone) {
      const existant = await pool.query(
        'SELECT id FROM clients WHERE telephone = $1 AND organisation_id = $2',
        [client.telephone, organisationId]
      )
      if (existant.rows.length) {
        return { erreur: 'Un client avec ce numéro de téléphone existe déjà !' }
      }
    }
    const { rows } = await pool.query(
      'INSERT INTO clients (nom, type, telephone, email, adresse, organisation_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [client.nom, client.type, client.telephone, client.email, client.adresse, organisationId]
    )
    return { succes: rows[0] }
  },

  async update(client, organisationId) {
    await pool.query(
      'UPDATE clients SET nom=$1, type=$2, telephone=$3, email=$4, adresse=$5 WHERE id=$6 AND organisation_id=$7',
      [client.nom, client.type, client.telephone, client.email, client.adresse, client.id, organisationId]
    )
    return { succes: true }
  },

  async delete(id, organisationId) {
    await pool.query('DELETE FROM clients WHERE id = $1 AND organisation_id = $2', [id, organisationId])
    return { succes: true }
  }
}

module.exports = ClientsDAO
