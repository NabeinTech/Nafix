const pool = require('../db/pool')

const CategoriesDAO = {
  async getAll(organisationId) {
    const { rows: cats } = await pool.query('SELECT * FROM categories WHERE organisation_id = $1 ORDER BY nom', [organisationId])
    const { rows: sous } = await pool.query('SELECT * FROM sous_categories WHERE organisation_id = $1 ORDER BY nom', [organisationId])
    return cats.map(cat => ({
      ...cat,
      sous_categories: sous.filter(sc => sc.categorie_id === cat.id)
    }))
  },

  async create(cat, organisationId) {
    const existant = await pool.query(
      'SELECT id FROM categories WHERE LOWER(nom) = LOWER($1) AND organisation_id = $2',
      [cat.nom, organisationId]
    )
    if (existant.rows.length) return { erreur: 'Cette catégorie existe déjà !' }
    const { rows } = await pool.query(
      'INSERT INTO categories (nom, icone, couleur, domaine, organisation_id) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [cat.nom, cat.icone, cat.couleur, cat.domaine || 'general', organisationId]
    )
    return { succes: rows[0] }
  },

  async update(cat, organisationId) {
    await pool.query(
      'UPDATE categories SET nom=$1, icone=$2, couleur=$3 WHERE id=$4 AND organisation_id=$5',
      [cat.nom, cat.icone, cat.couleur, cat.id, organisationId]
    )
    return { succes: true }
  },

  async delete(id, organisationId) {
    await pool.query('DELETE FROM sous_categories WHERE categorie_id = $1 AND organisation_id = $2', [id, organisationId])
    await pool.query('DELETE FROM categories WHERE id = $1 AND organisation_id = $2', [id, organisationId])
    return { succes: true }
  },

  async createSousCategorie(scat, organisationId) {
    const existant = await pool.query(
      'SELECT id FROM sous_categories WHERE LOWER(nom) = LOWER($1) AND categorie_id = $2 AND organisation_id = $3',
      [scat.nom, scat.categorie_id, organisationId]
    )
    if (existant.rows.length) return { erreur: 'Cette sous-catégorie existe déjà !' }
    const { rows } = await pool.query(
      'INSERT INTO sous_categories (categorie_id, nom, organisation_id) VALUES ($1,$2,$3) RETURNING *',
      [scat.categorie_id, scat.nom, organisationId]
    )
    return { succes: rows[0] }
  },

  async deleteSousCategorie(id, organisationId) {
    await pool.query('DELETE FROM sous_categories WHERE id = $1 AND organisation_id = $2', [id, organisationId])
    return { succes: true }
  }
}

module.exports = CategoriesDAO
