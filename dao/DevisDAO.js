const pool = require('../db/pool')

const DevisDAO = {
  async getAll(organisationId) {
    const { rows } = await pool.query(`
      SELECT d.*, c.nom as client_nom
      FROM devis d
      LEFT JOIN clients c ON d.client_id = c.id
      WHERE d.organisation_id = $1
      ORDER BY d.created_at DESC
    `, [organisationId])
    return rows
  },

  async create(devis, organisationId) {
    const { rows } = await pool.query(
      `INSERT INTO devis (client_id, validite, notes, montant_total, panier, statut, organisation_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [devis.client_id, devis.validite, devis.notes, devis.montant_total, devis.panier, devis.statut, organisationId]
    )
    return rows[0]
  },

  async updateStatut(id, statut, organisationId) {
    await pool.query('UPDATE devis SET statut = $1 WHERE id = $2 AND organisation_id = $3', [statut, id, organisationId])
    return { succes: true }
  },

  async convertir(facture, organisationId) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Le devis converti doit appartenir à la même organisation — sinon
      // aucune ligne trouvée et la conversion échoue proprement.
      const { rows: [devisExistant] } = await client.query(
        'SELECT id FROM devis WHERE id = $1 AND organisation_id = $2 FOR UPDATE',
        [facture.devis_id, organisationId]
      )
      if (!devisExistant) throw new Error('Devis introuvable')

      const montant = facture.montant_total || 0
      const { rows } = await client.query(
        `INSERT INTO ventes
          (client_id, mode_paiement, montant_total_original, montant_total, montant_paye, montant_du, panier, organisation_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [facture.client_id, facture.mode_paiement, montant, montant, montant, 0, facture.panier, organisationId]
      )
      const panier = JSON.parse(facture.panier || '[]')
      for (const item of panier) {
        await client.query(
          'UPDATE produits SET stock_actuel = GREATEST(0, stock_actuel - $1) WHERE id = $2 AND organisation_id = $3',
          [item.quantite, item.produit_id, organisationId]
        )
      }
      await client.query('UPDATE devis SET converti = 1 WHERE id = $1 AND organisation_id = $2', [facture.devis_id, organisationId])
      await client.query('COMMIT')
      return rows[0]
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }
}

module.exports = DevisDAO
