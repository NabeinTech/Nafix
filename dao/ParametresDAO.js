const pool = require('../db/pool')

const ParametresDAO = {
  async get(organisationId) {
    const { rows } = await pool.query('SELECT * FROM parametres WHERE organisation_id = $1', [organisationId])
    return rows[0] || {}
  },

  async reinitialiser(options = {}, organisationId) {
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
        await client.query('DELETE FROM transactions_avoir WHERE organisation_id = $1', [organisationId])
      }

      // lignes_facture → facture_id(factures), produit_id(produits)
      // Table morte (jamais peuplée, pas de organisation_id) — hors périmètre du scoping.
      if (eff.clients || eff.produits) {
        await client.query('DELETE FROM lignes_facture')
      }

      // retours → vente_id(ventes RESTRICT)
      if (eff.retours) {
        await client.query('DELETE FROM retours WHERE organisation_id = $1', [organisationId])
      }

      // commandes_clients → client_id(clients SET NULL), vente_id(ventes SET NULL)
      if (eff.commandes || eff.clients || eff.ventes) {
        await client.query('DELETE FROM commandes_clients WHERE organisation_id = $1', [organisationId])
      }

      // ─── Niveau 2 : tables intermédiaires ────────────────────────────────────────
      if (eff.clients) {
        // factures : table morte (jamais peuplée, pas de organisation_id) — hors périmètre du scoping.
        await client.query('DELETE FROM factures')
        await client.query('DELETE FROM avoirs_clients WHERE organisation_id = $1', [organisationId])
      }

      if (eff.ventes || eff.clients) {
        await client.query('DELETE FROM devis WHERE organisation_id = $1', [organisationId])
      }

      if (eff.fournisseurs) {
        await client.query('DELETE FROM achats WHERE organisation_id = $1', [organisationId])
      }

      // ─── Niveau 3 : tables racines ───────────────────────────────────────────────
      if (eff.ventes) {
        await client.query('DELETE FROM ventes WHERE organisation_id = $1', [organisationId])
      }

      if (eff.tresorerie) {
        // clotures_journalieres d'abord (tresorerie.cloture_id ON DELETE SET NULL)
        await client.query('DELETE FROM clotures_journalieres WHERE organisation_id = $1', [organisationId])
        await client.query('DELETE FROM tresorerie WHERE organisation_id = $1', [organisationId])
      }

      if (eff.clients) {
        await client.query('DELETE FROM clients WHERE organisation_id = $1', [organisationId])
      }

      if (eff.produits) {
        await client.query('DELETE FROM produits WHERE organisation_id = $1', [organisationId])
      }

      if (eff.fournisseurs) {
        await client.query('DELETE FROM fournisseurs WHERE organisation_id = $1', [organisationId])
      }

      // ─── Ajuster les séquences (jamais de RESTART WITH 1 global — dangereux dès
      // qu'une autre organisation possède encore des lignes dans la même table
      // partagée). On recale chaque séquence sur le MAX(id) réel de la table
      // entière : si l'organisation qui réinitialise était la seule à y avoir des
      // données, la table est vide et la séquence repart naturellement à 1,
      // exactement comme avant ; sinon, elle continue juste après les id restants
      // d'une autre organisation, sans jamais pouvoir entrer en collision. ───────
      const seqMap = {
        ventes:      ['ventes_id_seq', 'devis_id_seq'],
        tresorerie:  ['tresorerie_id_seq', 'clotures_journalieres_id_seq'],
        clients:     ['clients_id_seq', 'factures_id_seq', 'avoirs_clients_id_seq'],
        produits:    ['produits_id_seq'],
        fournisseurs:['fournisseurs_id_seq', 'achats_id_seq'],
        retours:     ['retours_id_seq'],
        commandes:   ['commandes_clients_id_seq'],
      }
      const seqTableMap = {
        ventes_id_seq: 'ventes',
        devis_id_seq: 'devis',
        tresorerie_id_seq: 'tresorerie',
        clotures_journalieres_id_seq: 'clotures_journalieres',
        clients_id_seq: 'clients',
        factures_id_seq: 'factures',
        avoirs_clients_id_seq: 'avoirs_clients',
        produits_id_seq: 'produits',
        fournisseurs_id_seq: 'fournisseurs',
        achats_id_seq: 'achats',
        retours_id_seq: 'retours',
        commandes_clients_id_seq: 'commandes_clients'
      }
      for (const [key, seqs] of Object.entries(seqMap)) {
        if (eff[key]) {
          for (const seq of seqs) {
            const table = seqTableMap[seq]
            await client.query(
              `SELECT setval('${seq}', COALESCE((SELECT MAX(id) FROM ${table}), 0) + 1, false)`
            )
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

  async save(params, organisationId) {
    await pool.query(
      `INSERT INTO parametres (organisation_id, nom_entreprise, slogan, telephone, telephone_secondaire,
        email, adresse, registre_commerce, ninea, tva_taux, mention_facture, logo_base64, format_facture)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (organisation_id) DO UPDATE SET
         nom_entreprise=$2, slogan=$3, telephone=$4, telephone_secondaire=$5,
         email=$6, adresse=$7, registre_commerce=$8, ninea=$9,
         tva_taux=$10, mention_facture=$11, logo_base64=$12, format_facture=$13`,
      [organisationId, params.nom_entreprise, params.slogan, params.telephone, params.telephone_secondaire,
       params.email, params.adresse, params.registre_commerce, params.ninea,
       params.tva_taux, params.mention_facture, params.logo_base64, params.format_facture || 'auto']
    )
    return true
  }
}

module.exports = ParametresDAO
