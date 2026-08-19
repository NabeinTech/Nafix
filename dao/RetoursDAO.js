const pool = require('../db/pool')

const modeLabel = {
  especes: 'Espèces', wave: 'Wave',
  orange_money: 'Orange Money', avoir: 'Avoir/Bon', cheque: 'Chèque'
}

const RetoursDAO = {
  async getAll(organisationId) {
    const { rows } = await pool.query(`
      SELECT r.*, v.montant_total AS vente_montant, c.nom AS client_nom
      FROM retours r
      LEFT JOIN ventes v ON r.vente_id = v.id AND v.organisation_id = $1
      LEFT JOIN clients c ON v.client_id = c.id AND c.organisation_id = $1
      WHERE r.organisation_id = $1
      ORDER BY r.created_at DESC
    `, [organisationId])
    return rows
  },

  async getPendants(organisationId) {
    const { rows } = await pool.query(`
      SELECT r.*, v.montant_total AS vente_montant, c.nom AS client_nom
      FROM retours r
      LEFT JOIN ventes v ON r.vente_id = v.id AND v.organisation_id = $1
      LEFT JOIN clients c ON v.client_id = c.id AND c.organisation_id = $1
      WHERE r.statut = 'en_attente' AND r.organisation_id = $1
      ORDER BY r.created_at ASC
    `, [organisationId])
    return rows
  },

  // Crée un retour en attente d'approbation — aucun effet immédiat sur stock/CA/trésorerie
  async create(retour, organisationId) {
    // Sprint 10 — si une vente_id est fournie (elle est nullable — un retour
    // générique sans vente précise est un usage légitime déjà existant),
    // elle doit appartenir à cette organisation (sinon RetoursDAO.getAll/
    // getPendants ferait fuiter vente_montant et client_nom via les LEFT JOIN
    // ventes/clients).
    if (retour.vente_id) {
      const { rows: [venteOk] } = await pool.query(
        'SELECT id FROM ventes WHERE id = $1 AND organisation_id = $2',
        [retour.vente_id, organisationId]
      )
      if (!venteOk) throw new Error('Vente introuvable')
    }

    const montant = parseFloat(retour.montant_retour) || 0
    const { rows } = await pool.query(
      `INSERT INTO retours (vente_id, panier_retour, montant_retour, raison, mode_remboursement, statut, organisation_id)
       VALUES ($1, $2, $3, $4, $5, 'en_attente', $6) RETURNING *`,
      [retour.vente_id, retour.panier_retour, montant, retour.raison, retour.mode_remboursement, organisationId]
    )
    return rows[0]
  },

  // Approuve le retour → applique stock + trésorerie + vente dans une transaction
  async approuver(id, approuvePar, organisationId) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Récupérer le retour
      const { rows: [retour] } = await client.query(
        "SELECT * FROM retours WHERE id = $1 AND statut = 'en_attente' AND organisation_id = $2 FOR UPDATE",
        [id, organisationId]
      )
      if (!retour) throw new Error('Retour introuvable ou déjà traité')

      const montant = parseFloat(retour.montant_retour) || 0

      // Récupérer la vente avec verrou
      const { rows: [vente] } = await client.query(
        'SELECT * FROM ventes WHERE id = $1 AND organisation_id = $2 FOR UPDATE',
        [retour.vente_id, organisationId]
      )
      if (!vente) throw new Error('Vente introuvable')

      // Restaurer le stock
      const panierRetour = JSON.parse(retour.panier_retour || '[]')
      for (const item of panierRetour) {
        await client.query(
          'UPDATE produits SET stock_actuel = stock_actuel + $1 WHERE id = $2 AND organisation_id = $3',
          [item.quantite, item.produit_id, organisationId]
        )
      }

      // Mettre à jour la vente
      const nouveauRetourne = parseFloat(vente.montant_retourne || 0) + montant
      const nouveauPaye     = Math.max(0, parseFloat(vente.montant_paye || 0) - montant)
      const nouveauTotal    = parseFloat(vente.montant_total || 0)
      const nouveauDu       = Math.max(0, nouveauTotal - nouveauRetourne - nouveauPaye)
      const estSolde        = nouveauDu <= 0 ? 0 : vente.est_pret

      await client.query(
        `UPDATE ventes
         SET montant_retourne = $1, montant_paye = $2, montant_du = $3, est_pret = $4
         WHERE id = $5 AND organisation_id = $6`,
        [nouveauRetourne, nouveauPaye, nouveauDu, estSolde, retour.vente_id, organisationId]
      )

      // Enregistrer en trésorerie
      await client.query(
        `INSERT INTO tresorerie (type, categorie, montant, description, date_operation, organisation_id)
         VALUES ('depense', 'retour', $1, $2, CURRENT_DATE, $3)`,
        [
          montant,
          `Remboursement retour F-${String(retour.vente_id).padStart(4,'0')} — ${modeLabel[retour.mode_remboursement] || retour.mode_remboursement} — ${retour.raison || 'Sans raison'}`,
          organisationId
        ]
      )

      // Marquer le retour comme approuvé
      const { rows: [updated] } = await client.query(
        `UPDATE retours SET statut = 'approuve', approuve_par = $1, approuve_le = NOW()
         WHERE id = $2 AND organisation_id = $3 RETURNING *`,
        [approuvePar, id, organisationId]
      )

      await client.query('COMMIT')
      return { succes: true, retour: updated }
    } catch (err) {
      await client.query('ROLLBACK')
      return { erreur: err.message }
    } finally {
      client.release()
    }
  },

  // Rejette le retour — aucun effet sur stock/CA/trésorerie
  async rejeter(id, approuvePar, organisationId) {
    const { rows: [updated] } = await pool.query(
      `UPDATE retours SET statut = 'rejete', approuve_par = $1, approuve_le = NOW()
       WHERE id = $2 AND statut = 'en_attente' AND organisation_id = $3 RETURNING *`,
      [approuvePar, id, organisationId]
    )
    if (!updated) return { erreur: 'Retour introuvable ou déjà traité' }
    return { succes: true, retour: updated }
  }
}

module.exports = RetoursDAO
