const pool = require('../db/pool')

const FournisseursDAO = {
  async getAll(organisationId) {
    const { rows: fournisseurs } = await pool.query('SELECT * FROM fournisseurs WHERE organisation_id = $1 ORDER BY nom ASC', [organisationId])
    const { rows: achats } = await pool.query(
      `SELECT fournisseur_id,
        SUM(montant_du)    AS total_du,
        SUM(montant_paye)  AS total_paye,
        SUM(montant_total) AS total_achats,
        COUNT(*)           AS nb_achats,
        MAX(date_achat)    AS derniere_commande
       FROM achats WHERE organisation_id = $1 GROUP BY fournisseur_id`,
      [organisationId]
    )
    const map = {}
    achats.forEach(a => { map[a.fournisseur_id] = a })
    return fournisseurs.map(f => ({
      ...f,
      total_du:          parseFloat(map[f.id]?.total_du)     || 0,
      total_paye:        parseFloat(map[f.id]?.total_paye)   || 0,
      total_achats:      parseFloat(map[f.id]?.total_achats) || 0,
      nb_achats:         parseInt(map[f.id]?.nb_achats)      || 0,
      derniere_commande: map[f.id]?.derniere_commande        || null
    }))
  },

  async create(f, organisationId) {
    const { rows } = await pool.query(
      `INSERT INTO fournisseurs
        (nom, telephone, email, adresse, contact_nom, type, notes,
         conditions_paiement, delai_livraison_jours, ninea, registre_commerce, site_web, organisation_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [
        f.nom, f.telephone, f.email, f.adresse, f.contact_nom, f.type || 'grossiste', f.notes,
        f.conditions_paiement || 'Comptant', f.delai_livraison_jours || 7,
        f.ninea, f.registre_commerce, f.site_web, organisationId
      ]
    )
    return rows[0]
  },

  async update(f, organisationId) {
    await pool.query(
      `UPDATE fournisseurs SET
        nom=$1, telephone=$2, email=$3, adresse=$4, contact_nom=$5, type=$6, notes=$7,
        conditions_paiement=$8, delai_livraison_jours=$9, ninea=$10, registre_commerce=$11, site_web=$12
       WHERE id=$13 AND organisation_id=$14`,
      [
        f.nom, f.telephone, f.email, f.adresse, f.contact_nom, f.type, f.notes,
        f.conditions_paiement, f.delai_livraison_jours,
        f.ninea, f.registre_commerce, f.site_web, f.id, organisationId
      ]
    )
    return { succes: true }
  },

  async delete(id, organisationId) {
    await pool.query('DELETE FROM fournisseurs WHERE id = $1 AND organisation_id = $2', [id, organisationId])
    return { succes: true }
  }
}

module.exports = FournisseursDAO
