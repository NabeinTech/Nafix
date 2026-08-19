const pool = require('../db/pool')

const VentesDAO = {
  async getAll(organisationId) {
    const { rows } = await pool.query(`
      SELECT
        v.id, v.client_id, v.mode_paiement,
        v.montant_total_original, v.escompte_montant, v.escompte_type, v.escompte_pourcentage,
        v.montant_total, v.montant_paye, v.montant_du,
        v.est_pret, v.est_partiel, v.date_pret, v.panier, v.vendeur, v.notes, v.created_at,
        c.nom as client_nom
      FROM ventes v
      LEFT JOIN clients c ON v.client_id = c.id AND c.organisation_id = $1
      WHERE v.organisation_id = $1
      ORDER BY v.created_at DESC
    `, [organisationId])
    return rows
  },

  async create(vente, organisationId) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const panier = JSON.parse(vente.panier || '[]')

      // Sprint 10 — le client_id fourni doit appartenir à cette organisation
      // (sinon VentesDAO.getAll ferait fuiter son nom via le LEFT JOIN clients).
      if (vente.client_id) {
        const { rows: [clientOk] } = await client.query(
          'SELECT id FROM clients WHERE id = $1 AND organisation_id = $2',
          [vente.client_id, organisationId]
        )
        if (!clientOk) throw new Error('Client introuvable')
      }

      // Vérification stock avant toute écriture (verrou FOR UPDATE évite les races)
      // Un même produit peut apparaître sur plusieurs lignes (niveaux d'unité différents :
      // tonne + sac + kg) — on doit cumuler les quantités par produit avant de comparer au stock.
      const quantitesParProduit = new Map()
      for (const item of panier) {
        quantitesParProduit.set(item.produit_id, (quantitesParProduit.get(item.produit_id) || 0) + item.quantite)
      }
      for (const [produit_id, quantiteTotale] of quantitesParProduit) {
        const { rows: [prod] } = await client.query(
          'SELECT nom, stock_actuel FROM produits WHERE id = $1 AND organisation_id = $2 FOR UPDATE',
          [produit_id, organisationId]
        )
        if (!prod) throw new Error(`Produit introuvable (id ${produit_id})`)
        if (prod.stock_actuel < quantiteTotale) {
          throw new Error(
            `Stock insuffisant pour "${prod.nom}" : ${prod.stock_actuel} disponible(s), ${quantiteTotale} demandée(s)`
          )
        }
      }

      const { rows } = await client.query(
        `INSERT INTO ventes (
          client_id, mode_paiement, montant_total_original, escompte_montant,
          escompte_type, escompte_pourcentage, montant_total, montant_paye,
          montant_recu, montant_du, est_pret, est_partiel, date_pret, panier, vendeur, notes, organisation_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
        [
          vente.client_id, vente.mode_paiement, vente.montant_total_original, vente.escompte_montant,
          vente.escompte_type, vente.escompte_pourcentage, vente.montant_total, vente.montant_paye,
          vente.montant_recu || 0, vente.montant_du, vente.est_pret, vente.est_partiel,
          vente.date_pret, vente.panier, vente.vendeur || null, vente.notes || null, organisationId
        ]
      )
      for (const item of panier) {
        await client.query(
          'UPDATE produits SET stock_actuel = stock_actuel - $1 WHERE id = $2 AND organisation_id = $3',
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

  async update(vente, organisationId) {
    const estPret = vente.est_pret !== undefined ? vente.est_pret : (vente.montant_du > 0 ? 1 : 0)
    await pool.query(
      'UPDATE ventes SET montant_paye=$1, montant_du=$2, est_pret=$3 WHERE id=$4 AND organisation_id=$5',
      [vente.montant_paye, vente.montant_du, estPret, vente.id, organisationId]
    )
    return { succes: true }
  },

  async fullUpdate(vente, organisationId) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Récupérer l'ancienne vente (verrou) pour restaurer les stocks
      const { rows: [ancienne] } = await client.query(
        'SELECT panier FROM ventes WHERE id = $1 AND organisation_id = $2 FOR UPDATE', [vente.id, organisationId]
      )
      if (!ancienne) throw new Error('Vente introuvable')

      // Sprint 10 — même vérification qu'à la création : client_id doit
      // appartenir à cette organisation avant d'être réécrit sur la vente.
      if (vente.client_id) {
        const { rows: [clientOk] } = await client.query(
          'SELECT id FROM clients WHERE id = $1 AND organisation_id = $2',
          [vente.client_id, organisationId]
        )
        if (!clientOk) throw new Error('Client introuvable')
      }

      // Remettre le stock des anciens articles
      const ancienPanier = JSON.parse(ancienne.panier || '[]')
      for (const item of ancienPanier) {
        await client.query(
          'UPDATE produits SET stock_actuel = stock_actuel + $1 WHERE id = $2 AND organisation_id = $3',
          [item.quantite, item.produit_id, organisationId]
        )
      }

      // Vérifier le stock des nouveaux articles (verrou FOR UPDATE)
      const nouveauPanier = JSON.parse(vente.panier || '[]')
      for (const item of nouveauPanier) {
        const { rows: [prod] } = await client.query(
          'SELECT nom, stock_actuel FROM produits WHERE id = $1 AND organisation_id = $2 FOR UPDATE',
          [item.produit_id, organisationId]
        )
        if (!prod) throw new Error(`Produit introuvable (id ${item.produit_id})`)
        if (prod.stock_actuel < item.quantite) {
          throw new Error(
            `Stock insuffisant pour "${prod.nom}" : ${prod.stock_actuel} disponible(s), ${item.quantite} demandée(s)`
          )
        }
      }

      // Mettre à jour la vente
      await client.query(
        `UPDATE ventes SET
          client_id=$1, mode_paiement=$2, montant_total_original=$3, escompte_montant=$4,
          escompte_type=$5, escompte_pourcentage=$6, montant_total=$7, montant_paye=$8,
          montant_recu=$9, montant_du=$10, est_pret=$11, est_partiel=$12, date_pret=$13,
          panier=$14, vendeur=$15, notes=$16
         WHERE id=$17 AND organisation_id=$18`,
        [
          vente.client_id, vente.mode_paiement, vente.montant_total_original, vente.escompte_montant,
          vente.escompte_type, vente.escompte_pourcentage, vente.montant_total, vente.montant_paye,
          vente.montant_recu || 0, vente.montant_du, vente.est_pret, vente.est_partiel,
          vente.date_pret, vente.panier, vente.vendeur || null, vente.notes || null,
          vente.id, organisationId
        ]
      )

      // Déduire les nouveaux stocks
      for (const item of nouveauPanier) {
        await client.query(
          'UPDATE produits SET stock_actuel = stock_actuel - $1 WHERE id = $2 AND organisation_id = $3',
          [item.quantite, item.produit_id, organisationId]
        )
      }

      await client.query('COMMIT')
      return { succes: true }
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  },

  async delete(id, organisationId) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const { rows } = await client.query('SELECT panier FROM ventes WHERE id = $1 AND organisation_id = $2', [id, organisationId])
      if (!rows.length) { await client.query('ROLLBACK'); return { erreur: 'Vente non trouvée' } }

      const panier = JSON.parse(rows[0].panier || '[]')
      for (const item of panier) {
        await client.query(
          'UPDATE produits SET stock_actuel = stock_actuel + $1 WHERE id = $2 AND organisation_id = $3',
          [item.quantite, item.produit_id, organisationId]
        )
      }
      await client.query('DELETE FROM ventes WHERE id = $1 AND organisation_id = $2', [id, organisationId])
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

module.exports = VentesDAO
