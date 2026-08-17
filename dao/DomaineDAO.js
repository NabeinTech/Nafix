const pool = require('../db/pool')

function getCategoriesByDomaine(type) {
  const domaines = {
    informatique: [
      { nom: 'Informatique', icone: '💻', couleur: 'blue',
        sous_categories: ['Ordinateurs portables', 'Ordinateurs de bureau', 'Imprimantes', 'Accessoires PC', 'Composants', 'Réseaux & WiFi'] },
      { nom: 'Téléphonie', icone: '📱', couleur: 'purple',
        sous_categories: ['Smartphones', 'Téléphones basiques', 'Accessoires téléphone', 'Chargeurs'] },
      { nom: 'Électroménager', icone: '🏠', couleur: 'green',
        sous_categories: ['Réfrigérateurs', 'Climatiseurs', 'Téléviseurs', 'Machines à laver', 'Ventilateurs', 'Fer à repasser'] },
      { nom: 'Consommables', icone: '🖨️', couleur: 'orange',
        sous_categories: ['Cartouches', 'Papier', 'Câbles', 'Batteries'] }
    ],
    alimentaire: [
      { nom: 'Céréales & Graines', icone: '🌾', couleur: 'gold',
        sous_categories: ['Riz', 'Mil', 'Maïs', 'Fonio', 'Blé', 'Arachides'] },
      { nom: 'Huiles & Graisses', icone: '🫙', couleur: 'orange',
        sous_categories: ["Huile d'arachide", 'Huile de palme', 'Beurre de karité', 'Margarine'] },
      { nom: 'Conserves & Boissons', icone: '🥤', couleur: 'blue',
        sous_categories: ['Tomate concentrée', 'Boissons sucrées', 'Eau minérale', 'Jus de fruits', 'Lait en poudre'] },
      { nom: 'Épices & Condiments', icone: '🌶️', couleur: 'red',
        sous_categories: ['Sel', 'Sucre', 'Cube Maggi', 'Poivre', 'Piment', 'Ail'] },
      { nom: 'Produits Frais', icone: '🥬', couleur: 'green',
        sous_categories: ['Légumes', 'Fruits', 'Viande', 'Poisson'] },
      { nom: 'Produits Laitiers', icone: '🥛', couleur: 'cyan',
        sous_categories: ['Lait', 'Yaourt', 'Fromage', 'Crème'] }
    ],
    quincaillerie: [
      { nom: 'Outils & Matériel', icone: '🔧', couleur: 'gray',
        sous_categories: ['Marteaux', 'Tournevis', 'Clés', 'Perceuses', 'Scies', 'Niveaux'] },
      { nom: 'Visserie & Boulonnerie', icone: '🔩', couleur: 'blue',
        sous_categories: ['Vis', 'Boulons', 'Écrous', 'Chevilles', 'Clous'] },
      { nom: 'Électricité', icone: '⚡', couleur: 'yellow',
        sous_categories: ['Câbles', 'Prises', 'Interrupteurs', 'Ampoules', 'Disjoncteurs'] },
      { nom: 'Plomberie', icone: '🚿', couleur: 'cyan',
        sous_categories: ['Tuyaux', 'Robinets', 'Raccords', 'Joints', 'Coudes'] },
      { nom: 'Peinture & Revêtement', icone: '🎨', couleur: 'purple',
        sous_categories: ['Peinture', 'Enduit', 'Vernis', 'Pinceaux', 'Rouleaux'] },
      { nom: 'Matériaux BTP', icone: '🏗️', couleur: 'orange',
        sous_categories: ['Ciment', 'Sable', 'Carrelage', 'Parpaings', 'Fer à béton'] }
    ],
    textile: [
      { nom: 'Vêtements Homme', icone: '👔', couleur: 'blue',
        sous_categories: ['Chemises', 'Pantalons', 'Costumes', 'T-shirts', 'Boubous'] },
      { nom: 'Vêtements Femme', icone: '👗', couleur: 'pink',
        sous_categories: ['Robes', 'Jupes', 'Pagnes', 'Blouses', 'Voiles'] },
      { nom: 'Vêtements Enfant', icone: '👶', couleur: 'green',
        sous_categories: ['Bébé 0-2 ans', 'Enfant 3-12 ans', 'Adolescent'] },
      { nom: 'Tissus & Pagnes', icone: '🧵', couleur: 'purple',
        sous_categories: ['Wax', 'Bazin', 'Soie', 'Coton', 'Laine', 'Broderie'] },
      { nom: 'Chaussures', icone: '👟', couleur: 'orange',
        sous_categories: ['Homme', 'Femme', 'Enfant', 'Sport', 'Sandales'] },
      { nom: 'Accessoires Mode', icone: '👜', couleur: 'gold',
        sous_categories: ['Sacs', 'Ceintures', 'Bijoux', 'Montres', 'Lunettes'] }
    ],
    general: [
      { nom: 'Produits Divers', icone: '📦', couleur: 'blue', sous_categories: ['Général'] },
      { nom: 'Services', icone: '🛠️', couleur: 'green', sous_categories: ['Prestation'] }
    ]
  }
  return domaines[type] || domaines['general']
}

const DomaineDAO = {
  async get() {
    const { rows } = await pool.query('SELECT * FROM domaine WHERE id = 1')
    return rows[0] || { type: 'general', nom: 'Commerce Général' }
  },

  async save(domaine) {
    const { rows: existing } = await pool.query('SELECT id FROM domaine WHERE id = 1')
    if (existing.length) {
      await pool.query('UPDATE domaine SET type=$1, nom=$2 WHERE id=1', [domaine.type, domaine.nom])
    } else {
      await pool.query('INSERT INTO domaine (id, type, nom) VALUES (1,$1,$2)', [domaine.type, domaine.nom])
    }

    const categories = getCategoriesByDomaine(domaine.type)
    for (const cat of categories) {
      const existant = await pool.query('SELECT id FROM categories WHERE nom = $1', [cat.nom])
      if (!existant.rows.length) {
        const { rows } = await pool.query(
          'INSERT INTO categories (nom, icone, couleur, domaine) VALUES ($1,$2,$3,$4) RETURNING id',
          [cat.nom, cat.icone, cat.couleur, domaine.type]
        )
        const catId = rows[0].id
        for (const sc of (cat.sous_categories || [])) {
          await pool.query(
            'INSERT INTO sous_categories (categorie_id, nom) VALUES ($1,$2)',
            [catId, sc]
          )
        }
      }
    }
    return true
  }
}

module.exports = DomaineDAO
module.exports.getCategoriesByDomaine = getCategoriesByDomaine
