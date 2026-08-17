const pool = require('../db/pool')

const CategoriesDAO = {
  async getAll() {
    const { rows: cats } = await pool.query('SELECT * FROM categories ORDER BY nom')
    const { rows: sous } = await pool.query('SELECT * FROM sous_categories ORDER BY nom')
    return cats.map(cat => ({
      ...cat,
      sous_categories: sous.filter(sc => sc.categorie_id === cat.id)
    }))
  },

  async create(cat) {
    const existant = await pool.query(
      'SELECT id FROM categories WHERE LOWER(nom) = LOWER($1)',
      [cat.nom]
    )
    if (existant.rows.length) return { erreur: 'Cette catégorie existe déjà !' }
    const { rows } = await pool.query(
      'INSERT INTO categories (nom, icone, couleur, domaine) VALUES ($1,$2,$3,$4) RETURNING *',
      [cat.nom, cat.icone, cat.couleur, cat.domaine || 'general']
    )
    return { succes: rows[0] }
  },

  async update(cat) {
    await pool.query(
      'UPDATE categories SET nom=$1, icone=$2, couleur=$3 WHERE id=$4',
      [cat.nom, cat.icone, cat.couleur, cat.id]
    )
    return { succes: true }
  },

  async delete(id) {
    await pool.query('DELETE FROM sous_categories WHERE categorie_id = $1', [id])
    await pool.query('DELETE FROM categories WHERE id = $1', [id])
    return { succes: true }
  },

  async createSousCategorie(scat) {
    const existant = await pool.query(
      'SELECT id FROM sous_categories WHERE LOWER(nom) = LOWER($1) AND categorie_id = $2',
      [scat.nom, scat.categorie_id]
    )
    if (existant.rows.length) return { erreur: 'Cette sous-catégorie existe déjà !' }
    const { rows } = await pool.query(
      'INSERT INTO sous_categories (categorie_id, nom) VALUES ($1,$2) RETURNING *',
      [scat.categorie_id, scat.nom]
    )
    return { succes: rows[0] }
  },

  async deleteSousCategorie(id) {
    await pool.query('DELETE FROM sous_categories WHERE id = $1', [id])
    return { succes: true }
  }
}

module.exports = CategoriesDAO
