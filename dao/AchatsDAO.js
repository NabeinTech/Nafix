const pool = require('../db/pool')

const AchatsDAO = {
  async getAll(organisationId) {
    const { rows } = await pool.query(`
      SELECT a.*, f.nom AS fournisseur_nom
      FROM achats a
      LEFT JOIN fournisseurs f ON a.fournisseur_id = f.id AND f.organisation_id = $1
      WHERE a.organisation_id = $1
      ORDER BY a.created_at DESC
    `, [organisationId])
    return rows
  },

  async create(achat, organisationId) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Sprint 10 — le fournisseur_id fourni doit appartenir à cette
      // organisation (sinon AchatsDAO.getAll ferait fuiter son nom via le
      // LEFT JOIN fournisseurs).
      if (achat.fournisseur_id) {
        const { rows: [fournisseurOk] } = await client.query(
          'SELECT id FROM fournisseurs WHERE id = $1 AND organisation_id = $2',
          [achat.fournisseur_id, organisationId]
        )
        if (!fournisseurOk) throw new Error('Fournisseur introuvable')
      }

      const { rows } = await client.query(
        `INSERT INTO achats
          (fournisseur_id, reference, montant_total, montant_paye, montant_du,
           mode_paiement, statut, notes, panier, date_achat,
           etape, priorite, date_livraison_prevue, organisation_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
        [
          achat.fournisseur_id, achat.reference,
          achat.montant_total, achat.montant_paye, achat.montant_du,
          achat.mode_paiement, achat.statut, achat.notes, achat.panier, achat.date_achat,
          achat.etape || 'commandé',
          achat.priorite || 'normale',
          achat.date_livraison_prevue || null,
          organisationId
        ]
      )
      const panier = JSON.parse(achat.panier || '[]')
      // Audit securite — meme classe de bug que VentesDAO.create (quantite
      // negative non validee) mais en sens inverse : ici, une quantite
      // negative DIMINUE le stock au lieu de l'augmenter sur un achat.
      for (const item of panier) {
        if (!isFinite(item.quantite) || item.quantite <= 0) {
          throw new Error(`Quantité invalide pour le produit ${item.produit_id} : ${item.quantite}`)
        }
      }
      for (const item of panier) {
        await client.query(
          'UPDATE produits SET stock_actuel = stock_actuel + $1 WHERE id = $2 AND organisation_id = $3',
          [item.quantite, item.produit_id, organisationId]
        )
      }
      await client.query('COMMIT')
      return rows[0]
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  },

  async update(achat, organisationId) {
    await pool.query(
      'UPDATE achats SET montant_paye=$1, montant_du=$2, statut=$3 WHERE id=$4 AND organisation_id=$5',
      [achat.montant_paye, achat.montant_du, achat.statut, achat.id, organisationId]
    )
    return { succes: true }
  },

  async changerEtape(id, etape, organisationId) {
    const ETAPES_VALIDES = ['brouillon', 'commandé', 'en_livraison', 'reçu', 'vérifié']
    if (!ETAPES_VALIDES.includes(etape)) return { erreur: 'Étape invalide' }
    const extra = etape === 'reçu'
      ? ', date_livraison_reelle = CURRENT_DATE'
      : ''
    await pool.query(
      `UPDATE achats SET etape = $1${extra} WHERE id = $2 AND organisation_id = $3`,
      [etape, id, organisationId]
    )
    return { succes: true, etape }
  },

  async delete(id, organisationId) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const { rows } = await client.query('SELECT panier FROM achats WHERE id = $1 AND organisation_id = $2', [id, organisationId])
      if (rows.length) {
        const panier = JSON.parse(rows[0].panier || '[]')
        for (const item of panier) {
          await client.query(
            'UPDATE produits SET stock_actuel = GREATEST(0, stock_actuel - $1) WHERE id = $2 AND organisation_id = $3',
            [item.quantite, item.produit_id, organisationId]
          )
        }
      }
      await client.query('DELETE FROM achats WHERE id = $1 AND organisation_id = $2', [id, organisationId])
      await client.query('COMMIT')
      return { succes: true }
    } catch (err) {
      await client.query('ROLLBACK')
      return { erreur: err.message }
    } finally {
      client.release()
    }
  }
}

module.exports = AchatsDAO
