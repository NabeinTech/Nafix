const pool = require('../db/pool')

const ParametresDAO = {
  async get() {
    const { rows } = await pool.query('SELECT * FROM parametres WHERE id = 1')
    return rows[0] || {}
  },

  async reinitialiser(options = {}) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Propager les dépendances FK obligatoires :
      // - supprimer clients impose supprimer ventes (ventes.client_id RESTRICT)
      // - supprimer ventes impose supprimer retours (retours.vente_id RESTRICT)
      const eff = { ...options }
      if (eff.clients)            eff.ventes     = true
      if (eff.ventes || eff.clients) eff.retours = true

      // ─── Niveau 1 : feuilles (aucune référence sortante vers les tables ci-dessous) ───
      // transactions_avoir → avoir_id(avoirs_clients), vente_id(ventes SET NULL), client_id(clients SET NULL)
      if (eff.ventes || eff.clients) {
        await client.query('DELETE FROM transactions_avoir')
      }

      // lignes_facture → facture_id(factures), produit_id(produits)
      if (eff.clients || eff.produits) {
        await client.query('DELETE FROM lignes_facture')
      }

      // retours → vente_id(ventes RESTRICT)
      if (eff.retours) {
        await client.query('DELETE FROM retours')
      }

      // commandes_clients → client_id(clients SET NULL), vente_id(ventes SET NULL)
      if (eff.commandes || eff.clients || eff.ventes) {
        await client.query('DELETE FROM commandes_clients')
      }

      // ─── Niveau 2 : tables intermédiaires ────────────────────────────────────────
      if (eff.clients) {
        await client.query('DELETE FROM factures')
        await client.query('DELETE FROM avoirs_clients')
      }

      if (eff.ventes || eff.clients) {
        await client.query('DELETE FROM devis')
      }

      if (eff.fournisseurs) {
        await client.query('DELETE FROM achats')
      }

      // ─── Niveau 3 : tables racines ───────────────────────────────────────────────
      if (eff.ventes) {
        await client.query('DELETE FROM ventes')
      }

      if (eff.tresorerie) {
        // clotures_journalieres d'abord (tresorerie.cloture_id ON DELETE SET NULL)
        await client.query('DELETE FROM clotures_journalieres')
        await client.query('DELETE FROM tresorerie')
      }

      if (eff.clients) {
        await client.query('DELETE FROM clients')
      }

      if (eff.produits) {
        await client.query('DELETE FROM produits')
      }

      if (eff.fournisseurs) {
        await client.query('DELETE FROM fournisseurs')
      }

      // ─── Réinitialiser les séquences (IDs repartent à 1) ─────────────────────────
      const seqMap = {
        ventes:      ['ventes_id_seq', 'devis_id_seq'],
        tresorerie:  ['tresorerie_id_seq', 'clotures_journalieres_id_seq'],
        clients:     ['clients_id_seq', 'factures_id_seq', 'avoirs_clients_id_seq'],
        produits:    ['produits_id_seq'],
        fournisseurs:['fournisseurs_id_seq', 'achats_id_seq'],
        retours:     ['retours_id_seq'],
        commandes:   ['commandes_clients_id_seq'],
      }
      for (const [key, seqs] of Object.entries(seqMap)) {
        if (eff[key]) {
          for (const seq of seqs) {
            await client.query(`ALTER SEQUENCE IF EXISTS ${seq} RESTART WITH 1`)
          }
        }
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

  async save(params) {
    const { rows: existing } = await pool.query('SELECT id FROM parametres WHERE id = 1')
    if (existing.length) {
      await pool.query(
        `UPDATE parametres SET
          nom_entreprise=$1, slogan=$2, telephone=$3, telephone_secondaire=$4,
          email=$5, adresse=$6, registre_commerce=$7, ninea=$8,
          tva_taux=$9, mention_facture=$10, logo_base64=$11, format_facture=$12
         WHERE id=1`,
        [params.nom_entreprise, params.slogan, params.telephone, params.telephone_secondaire,
         params.email, params.adresse, params.registre_commerce, params.ninea,
         params.tva_taux, params.mention_facture, params.logo_base64, params.format_facture || 'auto']
      )
    } else {
      await pool.query(
        `INSERT INTO parametres (id, nom_entreprise, slogan, telephone, telephone_secondaire,
          email, adresse, registre_commerce, ninea, tva_taux, mention_facture, logo_base64, format_facture)
         VALUES (1,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [params.nom_entreprise, params.slogan, params.telephone, params.telephone_secondaire,
         params.email, params.adresse, params.registre_commerce, params.ninea,
         params.tva_taux, params.mention_facture, params.logo_base64, params.format_facture || 'auto']
      )
    }
    return true
  }
}

module.exports = ParametresDAO
