// Sous-ensemble minimal de règles de rôles, dédié au RBAC IPC (Sprint 0).
// Reprend exactement les règles déjà appliquées côté UI dans
// src/utils/permissions.js (ex. seul administrateur a accès à /parametres).
// Ce fichier est volontairement séparé de permissions.js (ES modules,
// non requérable depuis main.js en CommonJS) — à réconcilier plus tard
// quand une API centralisera les permissions (Mission 2 du plan Nafix Platform).

const CANAUX_RESTREINTS = {
  'db:reinitialiser': ['administrateur'],
  'utilisateurs:create': ['administrateur'],
  'utilisateurs:delete': ['administrateur'],
  'utilisateurs:updatePassword': ['administrateur'],
  'utilisateurs:updateRole': ['administrateur'],
  'utilisateurs:updatePermissions': ['administrateur'],
  'parametres:save': ['administrateur'],
  'parametres:exporterSauvegarde': ['administrateur'],
  'organisations:update': ['administrateur'],
  'organisations:setStatut': ['administrateur'],
  // Sprint 6, Partie A — les 3 canaux suivants n'avaient aucune vérification
  // RBAC côté IPC alors que leur seul appelant légitime (l'onglet Paramètres)
  // est déjà réservé à l'administrateur côté UI. Défense en profondeur :
  // un appel IPC direct depuis un autre rôle était jusqu'ici possible.
  'domaine:save': ['administrateur'],
  'utilisateurs:getAll': ['administrateur'],
  'db:getStats': ['administrateur'],
  // Sprint 9 — même protection que l'export qu'il remplace en partie.
  'parametres:importerSauvegarde': ['administrateur'],
  // Sprint 12 — création d'une organisation supplémentaire par un admin déjà
  // connecté (scénario franchise/multi-boutique) ; à distinguer du canal
  // organisations:creerAvecAdmin (Sprint 11), volontairement sans RBAC car
  // appelé avant toute session, depuis l'écran de connexion.
  'organisations:creerOrganisation': ['administrateur']
}

function verifierPermission(canal, utilisateurConnecte) {
  const rolesAutorises = CANAUX_RESTREINTS[canal]
  if (!rolesAutorises) return

  if (!utilisateurConnecte) {
    throw new Error('Action non autorisée : aucune session active.')
  }
  if (!rolesAutorises.includes(utilisateurConnecte.role)) {
    throw new Error('Action non autorisée pour votre rôle.')
  }
}

module.exports = { verifierPermission, CANAUX_RESTREINTS }
