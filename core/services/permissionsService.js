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
  'parametres:exporterSauvegarde': ['administrateur']
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
