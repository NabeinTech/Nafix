// Définition des permissions par rôle
export const PERMISSIONS = {

  // ── ADMINISTRATEUR : accès total ────────────────────────────
  administrateur: {
    modules: ['/', '/ventes', '/devis', '/factures', '/clients', '/ai', '/ai-assistant', '/voice',
              '/produits', '/comptabilite', '/statistiques', '/parametres',
              '/categories', '/fournisseurs', '/commandes', '/comptes-prepayes'],
    peutAjouter: true,
    peutModifier: true,
    peutSupprimer: true,
    ventes:   { ajouter: true,  modifier: true,  supprimer: true,  voir_tout: true  },
    devis:    { ajouter: true,  modifier: true,  supprimer: true,  voir_tout: true  },
    factures: { ajouter: true,  modifier: true,  supprimer: true,  voir_tout: true  }
  },

  // ── GÉRANT : accès complet sauf paramètres système ──────────
  gerant: {
    modules: ['/', '/ventes', '/devis', '/factures', '/clients', '/ai', '/ai-assistant', '/voice',
              '/produits', '/comptabilite', '/statistiques',
              '/categories', '/fournisseurs', '/commandes', '/comptes-prepayes'],
    peutAjouter: true,
    peutModifier: true,
    peutSupprimer: true,
    ventes:   { ajouter: true,  modifier: true,  supprimer: true,  voir_tout: true  },
    devis:    { ajouter: true,  modifier: true,  supprimer: true,  voir_tout: true  },
    factures: { ajouter: true,  modifier: true,  supprimer: true,  voir_tout: true  }
  },

  // ── COMPTABLE : lecture seule ventes/factures/clients — mais peut
  // gérer les opérations de trésorerie et les clôtures (voir peutGerer
  // dans Comptabilite.js, qui autorise ce rôle spécifiquement) ────
  comptable: {
    modules: ['/', '/factures', '/clients', '/comptabilite', '/statistiques'],
    peutAjouter: false,
    peutModifier: false,
    peutSupprimer: false,
    ventes:   { ajouter: false, modifier: false, supprimer: false, voir_tout: true,  lecture_seule: true },
    devis:    { ajouter: false, modifier: false, supprimer: false, voir_tout: false },
    factures: { ajouter: false, modifier: false, supprimer: false, voir_tout: true,  lecture_seule: true }
  },

  // ── CAISSIER : ventes uniquement, tableau de bord du jour ───
  caissier: {
    modules: ['/', '/ventes', '/devis', '/clients', '/commandes', '/comptes-prepayes', '/voice'],
    peutAjouter: true,
    peutModifier: false,
    peutSupprimer: false,
    ventes:   { ajouter: true,  modifier: false, supprimer: false, voir_tout: false },
    devis:    { ajouter: true,  modifier: false, supprimer: false, voir_tout: false },
    factures: { ajouter: false, modifier: false, supprimer: false, voir_tout: false }
  }
}

//  Vérifie si un rôle a accès à un module
export const peutAcceder = (role, module) => {
  const perms = PERMISSIONS[role] || PERMISSIONS['caissier']
  return perms.modules.includes(module)
}

//  Vérifie si un rôle peut ajouter
export const peutAjouter = (role) => {
  const perms = PERMISSIONS[role] || PERMISSIONS['caissier']
  return perms.peutAjouter
}

//  Vérifie si un rôle peut modifier
export const peutModifier = (role) => {
  const perms = PERMISSIONS[role] || PERMISSIONS['caissier']
  return perms.peutModifier
}

//  Vérifie si un rôle peut supprimer
export const peutSupprimer = (role) => {
  const perms = PERMISSIONS[role] || PERMISSIONS['caissier']
  return perms.peutSupprimer
}

// 🔐 PERMISSIONS SPÉCIFIQUES PAR MODULE
// ============================================

// Vérifie les droits VENTES
export const peutFaireSurVente = (role, action) => {
  const perms = PERMISSIONS[role]?.ventes || { ajouter: false, modifier: false, supprimer: false, voir_tout: false }
  return perms[action] || false
}

// Vérifie les droits DEVIS
export const peutFaireSurDevis = (role, action) => {
  const perms = PERMISSIONS[role]?.devis || { ajouter: false, modifier: false, supprimer: false, voir_tout: false }
  return perms[action] || false
}

// Vérifie les droits FACTURES
export const peutFaireSurFacture = (role, action) => {
  const perms = PERMISSIONS[role]?.factures || { ajouter: false, modifier: false, supprimer: false, voir_tout: false }
  return perms[action] || false
}

// Permissions effectives en tenant compte des overrides custom de l'utilisateur
export const getPermissionsEffectives = (utilisateur) => {
  const role = utilisateur?.role || 'caissier'
  const base = PERMISSIONS[role] || PERMISSIONS.caissier
  const custom = utilisateur?.permissions_custom
  if (!custom) return base

  // Construire la liste des modules autorisés depuis les custom perms
  const routesModules = {
    ventes: '/ventes', devis: '/devis', factures: '/factures',
    clients: '/clients', produits: '/produits', categories: '/categories',
    fournisseurs: '/fournisseurs', commandes: '/commandes',
    comptabilite: '/comptabilite', statistiques: '/statistiques',
    parametres: '/parametres', ai: '/ai', voice: '/voice',
    comptes_prepayes: '/comptes-prepayes'
  }
  const modulesBase = ['/', '/ai-assistant']
  const modulesCustom = Object.entries(routesModules)
    .filter(([key]) => custom[key]?.voir)
    .map(([, route]) => route)

  return {
    ...base,
    modules: [...new Set([...modulesBase, ...modulesCustom])],
    peutAjouter: Object.values(custom).some(m => m.ajouter),
    peutModifier: Object.values(custom).some(m => m.modifier),
    peutSupprimer: Object.values(custom).some(m => m.supprimer),
    ventes:   { ...base.ventes,   ...(custom.ventes   || {}) },
    devis:    { ...base.devis,    ...(custom.devis     || {}) },
    factures: { ...base.factures, ...(custom.factures  || {}) },
    _custom: custom
  }
}

// Vérifie si un utilisateur (avec ses custom perms) peut accéder à un module
export const utilisateurPeutAcceder = (utilisateur, module) => {
  const perms = getPermissionsEffectives(utilisateur)
  return perms.modules.includes(module)
}

// Permissions par défaut par rôle (pour initialiser l'éditeur)
export const PERMISSIONS_DEFAUT_PAR_ROLE = {
  administrateur: {
    ventes:       { voir: true,  ajouter: true,  modifier: true,  supprimer: true  },
    devis:        { voir: true,  ajouter: true,  modifier: true,  supprimer: true  },
    factures:     { voir: true,  ajouter: true,  modifier: true,  supprimer: true  },
    clients:      { voir: true,  ajouter: true,  modifier: true,  supprimer: true  },
    produits:     { voir: true,  ajouter: true,  modifier: true,  supprimer: true  },
    fournisseurs: { voir: true,  ajouter: true,  modifier: true,  supprimer: true  },
    commandes:    { voir: true,  ajouter: true  },
    categories:   { voir: true,  ajouter: true,  supprimer: true  },
    comptabilite: { voir: true  },
    statistiques: { voir: true  },
    ai:           { voir: true  },
    voice:        { voir: true  }
  },
  gerant: {
    ventes:       { voir: true,  ajouter: true,  modifier: true,  supprimer: true  },
    devis:        { voir: true,  ajouter: true,  modifier: true,  supprimer: true  },
    factures:     { voir: true,  ajouter: true,  modifier: true,  supprimer: true  },
    clients:      { voir: true,  ajouter: true,  modifier: true,  supprimer: true  },
    produits:     { voir: true,  ajouter: true,  modifier: true,  supprimer: true  },
    fournisseurs: { voir: true,  ajouter: true,  modifier: true,  supprimer: true  },
    commandes:    { voir: true,  ajouter: true  },
    categories:   { voir: true,  ajouter: true,  supprimer: true  },
    comptabilite: { voir: true  },
    statistiques: { voir: true  },
    ai:           { voir: true  },
    voice:        { voir: true  }
  },
  comptable: {
    ventes:       { voir: false, ajouter: false, modifier: false, supprimer: false },
    devis:        { voir: false, ajouter: false, modifier: false, supprimer: false },
    factures:     { voir: true,  ajouter: false, modifier: false, supprimer: false },
    clients:      { voir: true,  ajouter: false, modifier: false, supprimer: false },
    produits:     { voir: false, ajouter: false, modifier: false, supprimer: false },
    fournisseurs: { voir: false, ajouter: false, modifier: false, supprimer: false },
    commandes:    { voir: false, ajouter: false },
    categories:   { voir: false, ajouter: false, supprimer: false },
    comptabilite: { voir: true  },
    statistiques: { voir: true  },
    ai:           { voir: false },
    voice:        { voir: false }
  },
  caissier: {
    ventes:       { voir: true,  ajouter: true,  modifier: false, supprimer: false },
    devis:        { voir: true,  ajouter: true,  modifier: false, supprimer: false },
    factures:     { voir: false, ajouter: false, modifier: false, supprimer: false },
    clients:      { voir: true,  ajouter: true,  modifier: false, supprimer: false },
    produits:     { voir: false, ajouter: false, modifier: false, supprimer: false },
    fournisseurs: { voir: false, ajouter: false, modifier: false, supprimer: false },
    commandes:    { voir: true,  ajouter: true  },
    categories:   { voir: false, ajouter: false, supprimer: false },
    comptabilite: { voir: false },
    statistiques: { voir: false },
    ai:           { voir: false },
    voice:        { voir: true  }
  }
}
