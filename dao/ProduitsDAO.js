const pool = require('../db/pool')

const ProduitsDAO = {
  async getAll(organisationId) {
    const { rows } = await pool.query(`
      SELECT p.*,
        COALESCE((
          SELECT SUM((item->>'quantite')::numeric)
          FROM commandes_clients cc,
               json_array_elements(
                 CASE WHEN cc.panier IS NOT NULL
                           AND cc.panier != ''
                           AND cc.panier != '[]'
                      THEN cc.panier::json
                      ELSE '[]'::json
                 END
               ) AS item
          WHERE cc.statut NOT IN ('livree', 'annulee')
            AND (item->>'produit_id') IS NOT NULL
            AND (item->>'produit_id') != ''
            AND (item->>'produit_id')::integer = p.id
        ), 0) AS en_commande
      FROM produits p
      WHERE p.organisation_id = $1
      ORDER BY LOWER(p.nom) ASC
    `, [organisationId])
    // NUMERIC(10,3) est retourné en string par pg — on le parse en nombre
    return rows.map(r => ({
      ...r,
      stock_actuel:     parseFloat(r.stock_actuel)     || 0,
      stock_minimum:    parseFloat(r.stock_minimum)    || 0,
      en_commande:      parseFloat(r.en_commande)      || 0,
      conditionnement:    r.conditionnement    != null ? parseFloat(r.conditionnement)    : null,
      facteur_conversion: r.facteur_conversion != null ? parseFloat(r.facteur_conversion) : null,
      unites_multiples:   (() => { try { return JSON.parse(r.unites_multiples || 'null') } catch { return null } })(),
    }))
  },

  async create(produit, organisationId) {
    if (produit.reference) {
      const ref = await pool.query(
        'SELECT id FROM produits WHERE LOWER(reference) = LOWER($1) AND organisation_id = $2',
        [produit.reference, organisationId]
      )
      if (ref.rows.length) return { erreur: 'Cette référence existe déjà !' }
    }

    const nom = await pool.query(
      'SELECT id FROM produits WHERE LOWER(nom) = LOWER($1) AND prix_vente = $2 AND organisation_id = $3',
      [produit.nom, produit.prix_vente, organisationId]
    )
    if (nom.rows.length) return { erreur: 'Un produit avec ce nom et ce prix existe déjà !' }

    const { rows } = await pool.query(
      `INSERT INTO produits (reference, nom, categorie, sous_categorie, marque, prix_achat, prix_vente, stock_actuel, stock_minimum, unite, attributs, conditionnement, unite_conditionnement, unite_achat, facteur_conversion, unites_multiples, organisation_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
      [produit.reference || null, produit.nom, produit.categorie, produit.sous_categorie || null,
       produit.marque || null, produit.prix_achat, produit.prix_vente, produit.stock_actuel,
       produit.stock_minimum, produit.unite, produit.attributs || null,
       produit.conditionnement || null, produit.unite_conditionnement || null,
       produit.unite_achat || null, produit.facteur_conversion || null,
       produit.unites_multiples ? JSON.stringify(produit.unites_multiples) : null,
       organisationId]
    )
    return { succes: rows[0] }
  },

  async update(produit, organisationId) {
    await pool.query(
      `UPDATE produits SET reference=$1, nom=$2, categorie=$3, sous_categorie=$4, marque=$5,
       prix_achat=$6, prix_vente=$7, stock_actuel=$8, stock_minimum=$9, unite=$10, attributs=$11,
       conditionnement=$12, unite_conditionnement=$13, unite_achat=$14, facteur_conversion=$15,
       unites_multiples=$16
       WHERE id=$17 AND organisation_id=$18`,
      [produit.reference || null, produit.nom, produit.categorie, produit.sous_categorie || null,
       produit.marque || null, produit.prix_achat, produit.prix_vente, produit.stock_actuel,
       produit.stock_minimum, produit.unite, produit.attributs || null,
       produit.conditionnement || null, produit.unite_conditionnement || null,
       produit.unite_achat || null, produit.facteur_conversion || null,
       produit.unites_multiples ? JSON.stringify(produit.unites_multiples) : null,
       produit.id, organisationId]
    )
    return { succes: true }
  },

  async delete(id, organisationId) {
    await pool.query('DELETE FROM produits WHERE id = $1 AND organisation_id = $2', [id, organisationId])
    return { succes: true }
  }
}

module.exports = ProduitsDAO
