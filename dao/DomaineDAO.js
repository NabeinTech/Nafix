const pool = require('../db/pool')

// ⚠️ SYNCHRONISATION MANUELLE REQUISE : cette liste duplique
// CATEGORIES_PAR_DOMAINE dans src/utils/domainConfig.js (frontend, ESM) —
// ce fichier tourne en CommonJS pur cote serveur (node direct, sans etape de
// build) et ne peut donc pas importer ce module frontend sans changement
// d'architecture plus large. Tout ajout/edit de categorie fait cote front
// doit etre reporte ici manuellement, et vice-versa. Un ecart existe deja
// (audit du 2026-09-17) sur les 5 domaines partages : quelques
// sous-categories et 2 couleurs (quincaillerie.Electricite,
// textile.Vetements Femme) different legerement entre les deux fichiers.
// Ces ecarts pre-existants n'ont PAS ete corriges ici (hors perimetre de
// cette passe, qui ajoute seulement restauration/btp) — a traiter separement
// si une reconciliation est demandee.
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
    chaussures: [
      { nom: 'Chaussures Homme', icone: '👞', couleur: 'blue',
        sous_categories: ['Baskets', 'Sandales', 'Mocassins', 'Bottes', 'Ville'] },
      { nom: 'Chaussures Femme', icone: '👠', couleur: 'magenta',
        sous_categories: ['Talons', 'Sandales', 'Baskets', 'Ballerines', 'Bottes'] },
      { nom: 'Chaussures Enfant', icone: '👟', couleur: 'green',
        sous_categories: ['Baskets', 'Sandales', 'Scolaire'] },
      { nom: 'Sacs & Maroquinerie', icone: '👜', couleur: 'gold',
        sous_categories: ['Sacs à main', 'Sacs à dos', 'Portefeuilles', 'Ceintures'] },
      { nom: 'Bijoux & Accessoires', icone: '💍', couleur: 'purple',
        sous_categories: ['Bijoux', 'Montres', 'Lunettes', 'Foulards'] }
    ],
    // Ajoutes pour corriger l'ecart avec src/utils/domainConfig.js (DOMAINES) :
    // ces deux domaines existaient deja cote frontend/selection utilisateur
    // mais tombaient sur les categories "general" ici, faute d'entree dediee.
    restauration: [
      { nom: 'Plats & Menus', icone: '🍽️', couleur: 'red',
        sous_categories: ['Plat du jour', 'Entrées', 'Plats principaux', 'Desserts', 'Menu complet'] },
      { nom: 'Boissons', icone: '🥤', couleur: 'blue',
        sous_categories: ['Eau', 'Jus naturels', 'Sodas', 'Café & Thé', 'Bières', 'Bissap', 'Ginger'] },
      { nom: 'Boulangerie & Pâtisserie', icone: '🥐', couleur: 'gold',
        sous_categories: ['Pain', 'Viennoiseries', 'Gâteaux', 'Sandwichs', 'Pâtisseries'] },
      { nom: 'Fast-food & Snack', icone: '🍟', couleur: 'orange',
        sous_categories: ['Brochettes', 'Poulet', 'Thiéboudienne', 'Sandwichs', 'Frites'] }
    ],
    btp: [
      { nom: 'Gros Œuvre', icone: '🏗️', couleur: 'gray',
        sous_categories: ['Fondations', 'Maçonnerie', 'Béton armé', 'Charpente', 'Toiture'] },
      { nom: 'Second Œuvre', icone: '🚪', couleur: 'blue',
        sous_categories: ['Menuiserie', 'Plâtrerie', 'Carrelage', 'Peinture', 'Isolation'] },
      { nom: 'Électricité & Plomberie', icone: '⚡', couleur: 'gold',
        sous_categories: ['Installation électrique', 'Plomberie sanitaire', 'Climatisation', 'Chauffage'] },
      { nom: 'Matériaux', icone: '🧱', couleur: 'orange',
        sous_categories: ['Ciment', 'Fer à béton', 'Briques', 'Carrelage', 'Sable', 'Gravier'] },
      { nom: 'Main d\'Œuvre', icone: '👷', couleur: 'purple',
        sous_categories: ['Maçon', 'Électricien', 'Plombier', 'Peintre', 'Carreleur', 'Chef chantier'] }
    ],
    general: [
      { nom: 'Produits Divers', icone: '📦', couleur: 'blue', sous_categories: ['Général'] },
      { nom: 'Services', icone: '🛠️', couleur: 'green', sous_categories: ['Prestation'] }
    ]
  }
  return domaines[type] || domaines['general']
}

const DomaineDAO = {
  async get(organisationId) {
    const { rows } = await pool.query('SELECT * FROM domaine WHERE organisation_id = $1', [organisationId])
    return rows[0] || { type: 'general', nom: 'Commerce Général' }
  },

  async save(domaine, organisationId) {
    await pool.query(
      `INSERT INTO domaine (organisation_id, type, nom) VALUES ($1,$2,$3)
       ON CONFLICT (organisation_id) DO UPDATE SET type=$2, nom=$3`,
      [organisationId, domaine.type, domaine.nom]
    )

    const categories = getCategoriesByDomaine(domaine.type)
    for (const cat of categories) {
      const existant = await pool.query('SELECT id FROM categories WHERE nom = $1 AND organisation_id = $2', [cat.nom, organisationId])
      if (!existant.rows.length) {
        const { rows } = await pool.query(
          'INSERT INTO categories (nom, icone, couleur, domaine, organisation_id) VALUES ($1,$2,$3,$4,$5) RETURNING id',
          [cat.nom, cat.icone, cat.couleur, domaine.type, organisationId]
        )
        const catId = rows[0].id
        for (const sc of (cat.sous_categories || [])) {
          await pool.query(
            'INSERT INTO sous_categories (categorie_id, nom, organisation_id) VALUES ($1,$2,$3)',
            [catId, sc, organisationId]
          )
        }
      }
    }
    return true
  }
}

module.exports = DomaineDAO
module.exports.getCategoriesByDomaine = getCategoriesByDomaine
