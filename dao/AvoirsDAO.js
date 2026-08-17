const pool = require('../db/pool')

const AvoirsDAO = {

  async getAll(organisationId) {
    const { rows } = await pool.query(`
      SELECT
        a.*,
        c.nom           AS client_nom,
        c.telephone     AS client_telephone,
        c.email         AS client_email,
        c.adresse       AS client_adresse,
        (SELECT COUNT(*) FROM transactions_avoir t WHERE t.avoir_id = a.id AND t.type = 'achat') AS nb_achats,
        (SELECT COUNT(*) FROM transactions_avoir t WHERE t.avoir_id = a.id)                       AS nb_transactions
      FROM avoirs_clients a
      LEFT JOIN clients c ON a.client_id = c.id
      WHERE a.organisation_id = $1
      ORDER BY a.created_at DESC
    `, [organisationId])
    return rows.map(r => ({
      ...r,
      nb_achats:      parseInt(r.nb_achats) || 0,
      nb_transactions: parseInt(r.nb_transactions) || 0,
      en_alerte: r.seuil_alerte > 0 && r.solde_restant <= r.seuil_alerte
    }))
  },

  async getByClient(clientId, organisationId) {
    const { rows } = await pool.query(
      `SELECT * FROM avoirs_clients WHERE client_id = $1 AND actif = 1 AND organisation_id = $2 ORDER BY created_at DESC`,
      [clientId, organisationId]
    )
    return rows
  },

  async getTransactions(avoirId, organisationId) {
    const { rows } = await pool.query(`
      SELECT t.*, c.nom AS client_nom
      FROM transactions_avoir t
      LEFT JOIN clients c ON t.client_id = c.id
      WHERE t.avoir_id = $1 AND t.organisation_id = $2
      ORDER BY t.created_at DESC
    `, [avoirId, organisationId])
    return rows
  },

  async getAllTransactions(organisationId) {
    const { rows } = await pool.query(`
      SELECT t.*,
             c.nom  AS client_nom,
             a.reference AS avoir_reference,
             a.montant_initial AS avoir_montant_initial
      FROM transactions_avoir t
      LEFT JOIN clients c ON t.client_id = c.id
      LEFT JOIN avoirs_clients a ON t.avoir_id = a.id
      WHERE t.organisation_id = $1
      ORDER BY t.created_at DESC
      LIMIT 500
    `, [organisationId])
    return rows
  },

  async creerCompte({ client_id, montant_initial, description, seuil_alerte }, organisationId) {
    const dbClient = await pool.connect()
    try {
      await dbClient.query('BEGIN')

      const reference = `CPRE-${Date.now().toString().slice(-8)}`

      const { rows: [avoir] } = await dbClient.query(
        `INSERT INTO avoirs_clients
          (client_id, reference, montant_initial, solde_restant, description, seuil_alerte, organisation_id)
         VALUES ($1, $2, $3, $3, $4, $5, $6) RETURNING *`,
        [client_id, reference, montant_initial, description || '', seuil_alerte || 0, organisationId]
      )

      // Transaction initiale : dépôt
      await dbClient.query(
        `INSERT INTO transactions_avoir
          (avoir_id, client_id, type, montant, libelle, panier, solde_avant, solde_apres, organisation_id)
         VALUES ($1, $2, 'depot', $3, $4, '[]', 0, $3, $5)`,
        [avoir.id, client_id, montant_initial, `Dépôt initial — ${description || 'Ouverture compte prépayé'}`, organisationId]
      )

      // Enregistrer le dépôt dans la trésorerie
      await dbClient.query(
        `INSERT INTO tresorerie (type, categorie, description, montant, date_operation, organisation_id)
         VALUES ('entree', 'avoir', $1, $2, CURRENT_DATE, $3)`,
        [`Dépôt initial compte prépayé ${avoir.reference} — ${description || ''}`, montant_initial, organisationId]
      )

      await dbClient.query('COMMIT')
      return avoir
    } catch (err) {
      await dbClient.query('ROLLBACK')
      throw err
    } finally {
      dbClient.release()
    }
  },

  async recharger({ avoir_id, montant, description }, organisationId) {
    const dbClient = await pool.connect()
    try {
      await dbClient.query('BEGIN')

      const { rows: [avoir] } = await dbClient.query(
        'SELECT * FROM avoirs_clients WHERE id = $1 AND organisation_id = $2 FOR UPDATE',
        [avoir_id, organisationId]
      )
      if (!avoir) throw new Error('Compte introuvable')

      const soldeApres = avoir.solde_restant + montant

      await dbClient.query(
        'UPDATE avoirs_clients SET solde_restant = $1 WHERE id = $2',
        [soldeApres, avoir_id]
      )

      const { rows: [tx] } = await dbClient.query(
        `INSERT INTO transactions_avoir
          (avoir_id, client_id, type, montant, libelle, panier, solde_avant, solde_apres, organisation_id)
         VALUES ($1, $2, 'depot', $3, $4, '[]', $5, $6, $7) RETURNING *`,
        [avoir_id, avoir.client_id, montant, description || 'Rechargement compte', avoir.solde_restant, soldeApres, organisationId]
      )

      // Enregistrer le rechargement dans la trésorerie
      await dbClient.query(
        `INSERT INTO tresorerie (type, categorie, description, montant, date_operation, organisation_id)
         VALUES ('entree', 'avoir', $1, $2, CURRENT_DATE, $3)`,
        [`Rechargement compte prépayé ${avoir.reference} — ${description || ''}`, montant, organisationId]
      )

      await dbClient.query('COMMIT')
      return tx
    } catch (err) {
      await dbClient.query('ROLLBACK')
      throw err
    } finally {
      dbClient.release()
    }
  },

  async enregistrerAchat({ avoir_id, libelle, montant, panier }, organisationId) {
    const dbClient = await pool.connect()
    try {
      await dbClient.query('BEGIN')

      // 1. Verrouiller le compte et valider le solde
      const { rows: [avoir] } = await dbClient.query(
        'SELECT * FROM avoirs_clients WHERE id = $1 AND organisation_id = $2 FOR UPDATE',
        [avoir_id, organisationId]
      )
      if (!avoir) throw new Error('Compte prépayé introuvable')
      if (!avoir.actif) throw new Error('Ce compte prépayé est clôturé')
      if (avoir.solde_restant < montant) {
        throw new Error(
          `Solde insuffisant. Disponible: ${Math.floor(avoir.solde_restant).toLocaleString()} FCFA, Demandé: ${Math.floor(montant).toLocaleString()} FCFA`
        )
      }

      const soldeAvant = avoir.solde_restant
      const soldeApres = soldeAvant - montant
      const panierParse = (() => { try { return JSON.parse(panier || '[]') } catch { return [] } })()

      // 2. Créer la vente (visible dans Ventes + Factures)
      const { rows: [vente] } = await dbClient.query(
        `INSERT INTO ventes (
           client_id, mode_paiement,
           montant_total_original, escompte_montant, escompte_type, escompte_pourcentage,
           montant_total, montant_paye, montant_du,
           est_pret, est_partiel, panier, notes, organisation_id
         ) VALUES ($1, 'avoir', $2, 0, 'pourcentage', 0, $2, $2, 0, 0, 0, $3, $4, $5)
         RETURNING *`,
        [
          avoir.client_id,
          montant,
          panier || '[]',
          `Compte prépayé ${avoir.reference} — ${libelle || 'Achat'}`,
          organisationId
        ]
      )

      // 3. Décrémenter le stock pour les articles du catalogue (avec vérification)
      for (const item of panierParse) {
        if (item.produit_id) {
          const { rows: [prod] } = await dbClient.query(
            'SELECT nom, stock_actuel FROM produits WHERE id = $1 AND organisation_id = $2 FOR UPDATE',
            [item.produit_id, organisationId]
          )
          if (!prod) throw new Error(`Produit introuvable (id ${item.produit_id})`)
          const qte = item.quantite || 1
          if (prod.stock_actuel < qte) {
            throw new Error(
              `Stock insuffisant pour "${prod.nom}" : ${prod.stock_actuel} disponible(s), ${qte} demandée(s)`
            )
          }
          await dbClient.query(
            'UPDATE produits SET stock_actuel = stock_actuel - $1 WHERE id = $2 AND organisation_id = $3',
            [qte, item.produit_id, organisationId]
          )
        }
      }

      // 4. Enregistrer la transaction avoir liée à la vente
      const { rows: [tx] } = await dbClient.query(
        `INSERT INTO transactions_avoir
          (avoir_id, client_id, type, montant, libelle, panier, vente_id, solde_avant, solde_apres, organisation_id)
         VALUES ($1, $2, 'achat', $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [avoir_id, avoir.client_id, montant, libelle || 'Achat sur compte', panier || '[]', vente.id, soldeAvant, soldeApres, organisationId]
      )

      // 5. Mettre à jour le solde du compte
      await dbClient.query(
        'UPDATE avoirs_clients SET solde_restant = $1 WHERE id = $2',
        [soldeApres, avoir_id]
      )

      await dbClient.query('COMMIT')
      return {
        ...tx,
        avoir_reference: avoir.reference,
        vente_id: vente.id,
        en_alerte: avoir.seuil_alerte > 0 && soldeApres <= avoir.seuil_alerte
      }
    } catch (err) {
      await dbClient.query('ROLLBACK')
      throw err
    } finally {
      dbClient.release()
    }
  },

  async cloturerCompte(id, organisationId) {
    await pool.query('UPDATE avoirs_clients SET actif = 0 WHERE id = $1 AND organisation_id = $2', [id, organisationId])
    return { succes: true }
  },

  async delete(id, organisationId) {
    await pool.query('DELETE FROM avoirs_clients WHERE id = $1 AND organisation_id = $2', [id, organisationId])
    return { succes: true }
  }
}

module.exports = AvoirsDAO
