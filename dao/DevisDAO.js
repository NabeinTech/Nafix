const pool = require('../db/pool')

const DevisDAO = {
  async getAll(organisationId) {
    const { rows } = await pool.query(`
      SELECT d.*, c.nom as client_nom
      FROM devis d
      LEFT JOIN clients c ON d.client_id = c.id AND c.organisation_id = $1
      WHERE d.organisation_id = $1
      ORDER BY d.created_at DESC
    `, [organisationId])
    return rows
  },

  async create(devis, organisationId) {
    // Sprint 10 — le client_id fourni doit appartenir à cette organisation
    // (sinon DevisDAO.getAll ferait fuiter son nom via le LEFT JOIN clients).
    if (devis.client_id) {
      const { rows: [clientOk] } = await pool.query(
        'SELECT id FROM clients WHERE id = $1 AND organisation_id = $2',
        [devis.client_id, organisationId]
      )
      if (!clientOk) throw new Error('Client introuvable')
    }
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

  // Un devis deja converti a genere une vente reelle (stock deja deduit) —
  // modifier son contenu apres coup laisserait le devis et la vente
  // incoherents entre eux, sans aucun moyen de les reconcilier. La
  // suppression n'a pas cette contrainte (CommandesDAO.delete/ClientsDAO.delete
  // n'en ont pas non plus) : elle ne fait que retirer le document, la vente
  // deja enregistree n'est pas affectee.
  async update(devis, organisationId) {
    const { rows: [devisExistant] } = await pool.query(
      'SELECT converti FROM devis WHERE id = $1 AND organisation_id = $2',
      [devis.id, organisationId]
    )
    if (!devisExistant) return { erreur: 'Devis introuvable' }
    if (devisExistant.converti === 1) return { erreur: 'Devis déjà converti en facture, non modifiable' }

    if (devis.client_id) {
      const { rows: [clientOk] } = await pool.query(
        'SELECT id FROM clients WHERE id = $1 AND organisation_id = $2',
        [devis.client_id, organisationId]
      )
      if (!clientOk) return { erreur: 'Client introuvable' }
    }

    const { rows: [misAJour] } = await pool.query(
      `UPDATE devis SET client_id = $1, validite = $2, notes = $3, montant_total = $4, panier = $5
       WHERE id = $6 AND organisation_id = $7 RETURNING *`,
      [devis.client_id || null, devis.validite, devis.notes, devis.montant_total, devis.panier, devis.id, organisationId]
    )
    return { succes: misAJour }
  },

  async delete(id, organisationId) {
    await pool.query('DELETE FROM devis WHERE id = $1 AND organisation_id = $2', [id, organisationId])
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

      // Sprint 10 — même vérification que DevisDAO.create : le client_id
      // fourni à la conversion doit appartenir à cette organisation.
      if (facture.client_id) {
        const { rows: [clientOk] } = await client.query(
          'SELECT id FROM clients WHERE id = $1 AND organisation_id = $2',
          [facture.client_id, organisationId]
        )
        if (!clientOk) throw new Error('Client introuvable')
      }

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
