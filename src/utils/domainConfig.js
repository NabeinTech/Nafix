// ============================================================
// 🏪 NAFIX — Configuration des Domaines de Commerce
// ============================================================

export const DOMAINES = {
  informatique: {
    type: 'informatique',
    nom: 'Informatique & Électroménager',
    icone: '💻',
    description: 'PC, téléphones, climatiseurs, TV, accessoires...',
    formatFacture: 'standard'
  },
  alimentaire: {
    type: 'alimentaire',
    nom: 'Alimentaire & Épicerie',
    icone: '🛒',
    description: 'Riz, huile, conserves, épices, produits frais...',
    formatFacture: 'ticket'
  },
  restauration: {
    type: 'restauration',
    nom: 'Restauration & Café',
    icone: '🍽️',
    description: 'Restaurant, café, boulangerie, fast-food, snack...',
    formatFacture: 'ticket'
  },
  quincaillerie: {
    type: 'quincaillerie',
    nom: 'Quincaillerie & Matériaux',
    icone: '🔧',
    description: 'Outils, visserie, électricité, plomberie, peinture...',
    formatFacture: 'btp'
  },
  btp: {
    type: 'btp',
    nom: 'BTP & Construction',
    icone: '🏗️',
    description: 'Bâtiment, travaux publics, génie civil, rénovation...',
    formatFacture: 'btp'
  },
  textile: {
    type: 'textile',
    nom: 'Textile & Prêt-à-porter',
    icone: '👕',
    description: 'Vêtements, tissus, pagnes, chaussures, accessoires...',
    formatFacture: 'standard'
  },
  general: {
    type: 'general',
    nom: 'Commerce Général',
    icone: '📦',
    description: 'Tous types de produits et services...',
    formatFacture: 'standard'
  }
}

// ⚠️ SYNCHRONISATION MANUELLE REQUISE : dupliquee cote serveur dans
// dao/DomaineDAO.js (getCategoriesByDomaine), qui est le code reellement
// execute a l'activation d'un domaine (seed des categories en base). Ce
// fichier-ci ne pilote que l'affichage/selection cote client. Toute
// modification ici doit etre reportee manuellement dans DomaineDAO.js.
export const CATEGORIES_PAR_DOMAINE = {
  informatique: [
    {
      nom: 'Informatique', icone: '💻', couleur: 'blue',
      sousCategories: ['Ordinateurs portables', 'Ordinateurs de bureau', 'Imprimantes', 'Accessoires PC', 'Composants', 'Réseaux & WiFi']
    },
    {
      nom: 'Téléphonie', icone: '📱', couleur: 'purple',
      sousCategories: ['Smartphones', 'Téléphones basiques', 'Accessoires téléphone', 'Chargeurs', 'Coques & Protection']
    },
    {
      nom: 'Électroménager', icone: '🏠', couleur: 'green',
      sousCategories: ['Réfrigérateurs', 'Climatiseurs', 'Téléviseurs', 'Machines à laver', 'Ventilateurs', 'Fer à repasser']
    },
    {
      nom: 'Consommables', icone: '🖨️', couleur: 'orange',
      sousCategories: ['Cartouches', 'Papier', 'Câbles', 'Batteries', 'Clés USB']
    }
  ],
  alimentaire: [
    {
      nom: 'Céréales & Graines', icone: '🌾', couleur: 'gold',
      sousCategories: ['Riz', 'Mil', 'Maïs', 'Fonio', 'Blé', 'Arachides', 'Haricots']
    },
    {
      nom: 'Huiles & Graisses', icone: '🫙', couleur: 'orange',
      sousCategories: ["Huile d'arachide", 'Huile de palme', 'Beurre de karité', 'Margarine']
    },
    {
      nom: 'Conserves & Boissons', icone: '🥤', couleur: 'blue',
      sousCategories: ['Tomate concentrée', 'Boissons sucrées', 'Eau minérale', 'Jus de fruits', 'Lait en poudre']
    },
    {
      nom: 'Épices & Condiments', icone: '🌶️', couleur: 'red',
      sousCategories: ['Sel', 'Sucre', 'Cube Maggi', 'Poivre', 'Piment', 'Ail', 'Oignon sec']
    },
    {
      nom: 'Produits Frais', icone: '🥬', couleur: 'green',
      sousCategories: ['Légumes', 'Fruits', 'Viande', 'Poisson', 'Oeufs']
    },
    {
      nom: 'Produits Laitiers', icone: '🥛', couleur: 'cyan',
      sousCategories: ['Lait frais', 'Yaourt', 'Fromage', 'Crème fraîche']
    }
  ],
  quincaillerie: [
    {
      nom: 'Outils & Matériel', icone: '🔧', couleur: 'gray',
      sousCategories: ['Marteaux', 'Tournevis', 'Clés', 'Perceuses', 'Scies', 'Niveaux', 'Pinces']
    },
    {
      nom: 'Visserie & Boulonnerie', icone: '🔩', couleur: 'blue',
      sousCategories: ['Vis', 'Boulons', 'Écrous', 'Chevilles', 'Clous', 'Rondelles']
    },
    {
      nom: 'Électricité', icone: '⚡', couleur: 'gold',
      sousCategories: ['Câbles', 'Prises', 'Interrupteurs', 'Ampoules', 'Disjoncteurs', 'Rallonges']
    },
    {
      nom: 'Plomberie', icone: '🚿', couleur: 'cyan',
      sousCategories: ['Tuyaux PVC', 'Robinets', 'Raccords', 'Joints', 'Coudes', 'Pompes']
    },
    {
      nom: 'Peinture & Revêtement', icone: '🎨', couleur: 'purple',
      sousCategories: ['Peinture', 'Enduit', 'Vernis', 'Pinceaux', 'Rouleaux', 'Décapant']
    },
    {
      nom: 'Matériaux BTP', icone: '🏗️', couleur: 'orange',
      sousCategories: ['Ciment', 'Sable', 'Carrelage', 'Parpaings', 'Fer à béton', 'Gravier']
    }
  ],
  textile: [
    {
      nom: 'Vêtements Homme', icone: '👔', couleur: 'blue',
      sousCategories: ['Chemises', 'Pantalons', 'Costumes', 'T-shirts', 'Boubous', 'Jeans']
    },
    {
      nom: 'Vêtements Femme', icone: '👗', couleur: 'magenta',
      sousCategories: ['Robes', 'Jupes', 'Pagnes', 'Blouses', 'Voiles', 'Tailleurs']
    },
    {
      nom: 'Vêtements Enfant', icone: '👶', couleur: 'green',
      sousCategories: ['Bébé 0-2 ans', 'Enfant 3-7 ans', 'Enfant 8-12 ans', 'Adolescent']
    },
    {
      nom: 'Tissus & Pagnes', icone: '🧵', couleur: 'purple',
      sousCategories: ['Wax', 'Bazin', 'Soie', 'Coton', 'Laine', 'Broderie', 'Dentelle']
    },
    {
      nom: 'Chaussures', icone: '👟', couleur: 'orange',
      sousCategories: ['Homme', 'Femme', 'Enfant', 'Sport', 'Sandales', 'Mocassins']
    },
    {
      nom: 'Accessoires Mode', icone: '👜', couleur: 'gold',
      sousCategories: ['Sacs', 'Ceintures', 'Bijoux', 'Montres', 'Lunettes', 'Foulards']
    }
  ],
  restauration: [
    {
      nom: 'Plats & Menus', icone: '🍽️', couleur: 'red',
      sousCategories: ['Plat du jour', 'Entrées', 'Plats principaux', 'Desserts', 'Menu complet']
    },
    {
      nom: 'Boissons', icone: '🥤', couleur: 'blue',
      sousCategories: ['Eau', 'Jus naturels', 'Sodas', 'Café & Thé', 'Bières', 'Bissap', 'Ginger']
    },
    {
      nom: 'Boulangerie & Pâtisserie', icone: '🥐', couleur: 'gold',
      sousCategories: ['Pain', 'Viennoiseries', 'Gâteaux', 'Sandwichs', 'Pâtisseries']
    },
    {
      nom: 'Fast-food & Snack', icone: '🍟', couleur: 'orange',
      sousCategories: ['Brochettes', 'Poulet', 'Thiéboudienne', 'Sandwichs', 'Frites']
    }
  ],
  btp: [
    {
      nom: 'Gros Œuvre', icone: '🏗️', couleur: 'gray',
      sousCategories: ['Fondations', 'Maçonnerie', 'Béton armé', 'Charpente', 'Toiture']
    },
    {
      nom: 'Second Œuvre', icone: '🚪', couleur: 'blue',
      sousCategories: ['Menuiserie', 'Plâtrerie', 'Carrelage', 'Peinture', 'Isolation']
    },
    {
      nom: 'Électricité & Plomberie', icone: '⚡', couleur: 'gold',
      sousCategories: ['Installation électrique', 'Plomberie sanitaire', 'Climatisation', 'Chauffage']
    },
    {
      nom: 'Matériaux', icone: '🧱', couleur: 'orange',
      sousCategories: ['Ciment', 'Fer à béton', 'Briques', 'Carrelage', 'Sable', 'Gravier']
    },
    {
      nom: 'Main d\'Œuvre', icone: '👷', couleur: 'purple',
      sousCategories: ['Maçon', 'Électricien', 'Plombier', 'Peintre', 'Carreleur', 'Chef chantier']
    }
  ],
  general: [
    {
      nom: 'Produits Divers', icone: '📦', couleur: 'blue',
      sousCategories: ['Général', 'Autres']
    },
    {
      nom: 'Services', icone: '🛠️', couleur: 'green',
      sousCategories: ['Prestation de service', 'Réparation', 'Installation']
    }
  ]
}

// ✅ Obtenir les infos d'un domaine
export const getDomaine = (type) => {
  return DOMAINES[type] || DOMAINES['general']
}

// ✅ Liste de tous les domaines
export const getTousDomaines = () => Object.values(DOMAINES)

// ✅ Thèmes visuels par domaine (couleurs, textes adaptés)
export const DOMAIN_THEMES = {
  informatique: {
    gradient: 'linear-gradient(135deg, #1890ff 0%, #722ed1 100%)',
    primaryColor: '#1890ff',
    lightBg: '#e6f7ff',
    borderColor: '#91d5ff',
    description: 'Informatique · Téléphonie · Électroménager · Consommables',
    marqueLabel: 'Marque / Modèle',
    marquePlaceholder: 'Ex: HP, Samsung, Dell, Lenovo...',
    produitLabel: 'Appareil / Produit',
    defaultUnite: 'pièce',
    unitesDisponibles: ['pièce', 'lot', 'boîte', 'unité']
  },
  alimentaire: {
    gradient: 'linear-gradient(135deg, #389e0d 0%, #08979c 100%)',
    primaryColor: '#52c41a',
    lightBg: '#f6ffed',
    borderColor: '#b7eb8f',
    description: 'Céréales · Huiles · Conserves · Épices · Produits frais',
    marqueLabel: 'Origine / Marque',
    marquePlaceholder: "Ex: Sundia, Maggi, produit local...",
    produitLabel: 'Aliment / Denrée',
    defaultUnite: 'kg',
    unitesDisponibles: ['kg', 'g', 'tonne', 'L', 'mL', 'cl', 'pièce', 'sac', 'boîte', 'cagette']
  },
  quincaillerie: {
    gradient: 'linear-gradient(135deg, #d46b08 0%, #cf1322 100%)',
    primaryColor: '#fa8c16',
    lightBg: '#fff7e6',
    borderColor: '#ffd591',
    description: 'Outils · Visserie · Électricité · Plomberie · Matériaux BTP',
    marqueLabel: 'Marque / Fabricant',
    marquePlaceholder: 'Ex: Stanley, Bosch, 3M...',
    produitLabel: 'Article / Matériau',
    defaultUnite: 'pièce',
    unitesDisponibles: ['pièce', 'm', 'cm', 'm²', 'm³', 'kg', 'sac', 'rouleau', 'lot', 'L', 'bidon']
  },
  textile: {
    gradient: 'linear-gradient(135deg, #c41d7f 0%, #531dab 100%)',
    primaryColor: '#eb2f96',
    lightBg: '#fff0f6',
    borderColor: '#ffadd2',
    description: 'Vêtements · Tissus · Pagnes · Chaussures · Accessoires',
    marqueLabel: 'Marque / Styliste',
    marquePlaceholder: 'Ex: Adidas, Nike, marque locale...',
    produitLabel: 'Article / Vêtement',
    defaultUnite: 'm',
    unitesDisponibles: ['m', 'cm', 'yard', 'pièce', 'rouleau', 'lot', 'paire']
  },
  restauration: {
    gradient: 'linear-gradient(135deg, #cf1322 0%, #fa8c16 100%)',
    primaryColor: '#cf1322',
    lightBg: '#fff1f0',
    borderColor: '#ffa39e',
    description: 'Plats · Boissons · Menus · Boulangerie · Fast-food',
    marqueLabel: 'Catégorie / Type',
    marquePlaceholder: 'Ex: Plat chaud, Boisson, Dessert...',
    produitLabel: 'Plat / Boisson / Article',
    defaultUnite: 'portion',
    unitesDisponibles: ['portion', 'pièce', 'verre', 'bouteille', 'assiette', 'lot', 'kg', 'L']
  },
  btp: {
    gradient: 'linear-gradient(135deg, #434343 0%, #2c3e50 100%)',
    primaryColor: '#2c3e50',
    lightBg: '#f5f5f5',
    borderColor: '#d9d9d9',
    description: 'Gros œuvre · Second œuvre · Matériaux · Main d\'œuvre',
    marqueLabel: 'Fournisseur / Marque',
    marquePlaceholder: 'Ex: Cimaf, Dangote, local...',
    produitLabel: 'Matériau / Prestation',
    defaultUnite: 'm²',
    unitesDisponibles: ['m²', 'm³', 'm', 'ml', 'kg', 'tonne', 'sac', 'pièce', 'lot', 'forfait', 'jour', 'heure']
  },
  general: {
    gradient: 'linear-gradient(135deg, #1890ff 0%, #722ed1 100%)',
    primaryColor: '#1890ff',
    lightBg: '#e6f7ff',
    borderColor: '#91d5ff',
    description: 'Tous types de produits et services',
    marqueLabel: 'Marque / Fournisseur',
    marquePlaceholder: 'Ex: Nom de la marque...',
    produitLabel: 'Produit / Service',
    defaultUnite: 'pièce',
    unitesDisponibles: ['pièce', 'kg', 'g', 'm', 'L', 'lot', 'boîte', 'sac', 'unité']
  }
}

export const getDomainTheme = (type) => DOMAIN_THEMES[type] || DOMAIN_THEMES['general']

// ✅ Unités qui acceptent des quantités décimales (ex: 3.5 m, 2.75 kg)
export const UNITES_DECIMALES = ['kg', 'g', 'tonne', 'm', 'cm', 'yard', 'm²', 'm³', 'L', 'mL', 'cl']