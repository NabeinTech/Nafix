// Sprint 16 — RBAC HTTP, réutilisant EXACTEMENT les mêmes règles que
// core/services/permissionsService.js (CANAUX_RESTREINTS), sans dupliquer la
// liste : source unique de vérité, seul le point d'application change
// (middleware Express au lieu de verifierPermission() en tête de handler IPC).
const { CANAUX_RESTREINTS } = require('../../../core/services/permissionsService')

function exigerRole(canalEquivalent) {
  const rolesAutorises = CANAUX_RESTREINTS[canalEquivalent]
  return (req, res, next) => {
    if (!rolesAutorises) return next()
    if (!req.tenantContext) return res.status(401).json({ erreur: 'Authentification requise' })
    if (!rolesAutorises.includes(req.tenantContext.role)) {
      return res.status(403).json({ erreur: 'Action non autorisée pour votre rôle.' })
    }
    next()
  }
}

module.exports = { exigerRole }
