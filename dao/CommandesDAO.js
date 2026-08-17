const pool = require('../db/pool')

const CommandesDAO = {
  async getAll(organisationId) {
    const { rows } = await pool.query(`
      SELECT cc.*, c.telephone AS client_tel_ref
      FROM commandes_clients cc
      LEFT JOIN clients c ON cc.client_id = c.id
      WHERE cc.organisation_id = $1
      ORDER BY
        CASE cc.statut
          WHEN 'nouvelle'       THEN 1
          WHEN 'en_preparation' THEN 2
          WHEN 'prete'          THEN 3
          WHEN 'livree'         THEN 4
          WHEN 'annulee'        THEN 5
          ELSE 6
        END,
        CASE cc.priorite
          WHEN 'urgente' THEN 1
          WHEN 'haute'   THEN 2
          WHEN 'normale' THEN 3
          WHEN 'basse'   THEN 4
          ELSE 5
        END,
        cc.date_livraison_prevue ASC NULLS LAST,
        cc.created_at DESC
    `, [organisationId])
    return rows
  },

  async create(commande, organisationId) {
    const {
      client_id, client_nom, client_telephone,
      date_livraison_prevue, priorite, mode_paiement,
      panier, total, acompte, notes, vendeur
    } = commande

    const { rows: [{ count }] } = await pool.query(
      'SELECT COUNT(*) FROM commandes_clients WHERE organisation_id = $1', [organisationId]
    )
    const numero = `CMD-${new Date().getFullYear()}-${String(parseInt(count, 10) + 1).padStart(4, '0')}`

    const { rows } = await pool.query(
      `INSERT INTO commandes_clients
        (numero, client_id, client_nom, client_telephone,
         date_livraison_prevue, priorite, mode_paiement,
         panier, total, acompte, notes, vendeur, organisation_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        numero,
        client_id        || null,
        client_nom,
        client_telephone || null,
        date_livraison_prevue || null,
        priorite         || 'normale',
        mode_paiement    || 'especes',
        JSON.stringify(panier || []),
        total            || 0,
        acompte          || 0,
        notes            || null,
        vendeur          || null,
        organisationId
      ]
    )
    return rows[0]
  },

  async changerStatut(id, statut, organisationId) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Lire la commande complète
      const { rows: [cmd] } = await client.query(
        'SELECT * FROM commandes_clients WHERE id = $1 AND organisation_id = $2', [id, organisationId]
      )
      if (!cmd) throw new Error('Commande introuvable')

      // ── Livraison : déduire stock + créer vente ────────────
      if (statut === 'livree' && cmd.statut !== 'livree') {
        let panier = []
        try {
          panier = typeof cmd.panier === 'string'
            ? JSON.parse(cmd.panier || '[]')
            : (cmd.panier || [])
        } catch {}

        // 1. Déduire le stock pour chaque article lié à un produit
        for (const item of panier) {
          if (item.produit_id && Number(item.quantite) > 0) {
            await client.query(
              'UPDATE produits SET stock_actuel = GREATEST(0, stock_actuel - $1) WHERE id = $2 AND organisation_id = $3',
              [Number(item.quantite), item.produit_id, organisationId]
            )
          }
        }

        // 2. Créer la vente correspondante (sans redéduire le stock)
        const montantPaye = Number(cmd.acompte) || 0
        const montantDu   = Math.max(0, Number(cmd.total) - montantPaye)
        const estPret     = montantDu > 0 ? 1 : 0
        const estPartiel  = montantPaye > 0 && montantDu > 0 ? 1 : 0

        const { rows: [vente] } = await client.query(
          `INSERT INTO ventes (
            client_id, mode_paiement,
            montant_total_original, escompte_montant, escompte_type, escompte_pourcentage,
            montant_total, montant_paye, montant_du,
            est_pret, est_partiel,
            panier, vendeur, notes, organisation_id
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
          RETURNING id`,
          [
            cmd.client_id || null,
            cmd.mode_paiement || 'especes',
            cmd.total, 0, 'pourcentage', 0,
            cmd.total, montantPaye, montantDu,
            estPret, estPartiel,
            cmd.panier,
            cmd.vendeur || null,
            `Commande ${cmd.numero}${cmd.notes ? ' — ' + cmd.notes : ''}`,
            organisationId
          ]
        )

        // 3. Lier la vente à la commande
        await client.query(
          'UPDATE commandes_clients SET vente_id = $1 WHERE id = $2 AND organisation_id = $3',
          [vente.id, id, organisationId]
        )
      }

      // Mettre à jour le statut
      const { rows } = await client.query(
        `UPDATE commandes_clients
         SET statut = $1,
             date_livraison_reelle = CASE WHEN $1 = 'livree' THEN CURRENT_DATE ELSE date_livraison_reelle END
         WHERE id = $2 AND organisation_id = $3
         RETURNING *`,
        [statut, id, organisationId]
      )

      await client.query('COMMIT')
      return rows[0]
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  },

  async setPriorite(id, priorite, organisationId) {
    const { rows } = await pool.query(
      'UPDATE commandes_clients SET priorite = $1 WHERE id = $2 AND organisation_id = $3 RETURNING id',
      [priorite, id, organisationId]
    )
    return rows[0]
  },

  async setDateLivraison(id, date, organisationId) {
    const { rows } = await pool.query(
      'UPDATE commandes_clients SET date_livraison_prevue = $1 WHERE id = $2 AND organisation_id = $3 RETURNING id',
      [date, id, organisationId]
    )
    return rows[0]
  },

  async delete(id, organisationId) {
    await pool.query('DELETE FROM commandes_clients WHERE id = $1 AND organisation_id = $2', [id, organisationId])
    return { ok: true }
  },

  async getAlertes(organisationId) {
    const today = new Date().toISOString().split('T')[0]

    const { rows: enRetard } = await pool.query(`
      SELECT id, numero, client_nom, client_telephone, total, priorite, statut, date_livraison_prevue
      FROM commandes_clients
      WHERE statut NOT IN ('livree','annulee')
        AND date_livraison_prevue < $1
        AND organisation_id = $2
      ORDER BY date_livraison_prevue ASC
    `, [today, organisationId])

    const { rows: aujourdhui } = await pool.query(`
      SELECT id, numero, client_nom, client_telephone, total, priorite, statut, date_livraison_prevue
      FROM commandes_clients
      WHERE statut NOT IN ('livree','annulee')
        AND date_livraison_prevue = $1
        AND organisation_id = $2
    `, [today, organisationId])

    const { rows: pretes } = await pool.query(`
      SELECT id, numero, client_nom, client_telephone, total, priorite, date_livraison_prevue
      FROM commandes_clients
      WHERE statut = 'prete' AND organisation_id = $1
      ORDER BY date_livraison_prevue ASC NULLS LAST
    `, [organisationId])

    return { enRetard, aujourdhui, pretes }
  },

  async getCalendrier(annee, mois, organisationId) {
    const debut      = `${annee}-${String(mois).padStart(2, '0')}-01`
    const dernierJour = new Date(annee, mois, 0).getDate()
    const fin        = `${annee}-${String(mois).padStart(2, '0')}-${String(dernierJour).padStart(2, '0')}`

    const { rows } = await pool.query(`
      SELECT id, numero, client_nom, client_telephone, total, priorite, statut, date_livraison_prevue
      FROM commandes_clients
      WHERE date_livraison_prevue BETWEEN $1 AND $2
        AND statut != 'annulee'
        AND organisation_id = $3
      ORDER BY date_livraison_prevue ASC, priorite
    `, [debut, fin, organisationId])
    return rows
  }
}

module.exports = CommandesDAO
