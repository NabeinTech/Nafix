// Sprint 16 — RBAC HTTP, réutilisant EXACTEMENT les mêmes règles que
// core/services/permissionsService.js (CANAUX_RESTREINTS), sans dupliquer la
// liste : source unique de vérité, seul le point d'application change
// (middleware Express au lieu de verifierPermission() en tête de handler IPC).
const { CANAUX_RESTREINTS } = require('../../../core/services/permissionsService')

// Audit securite — un canal absent de CANAUX_RESTREINTS faisait passer next()
// sans aucune verification de role (fail-open). Sans danger tant que chaque
// appel de exigerRole() correspond a une vraie entree (verifie : les 11
// appels HTTP actuels correspondent tous a une cle reelle), mais une faute de
// frappe future dans le nom du canal aurait cree une route qui SEMBLE
// protegee (exigerRole est bien present dans le code) mais ne l'est pas
// reellement, silencieusement. Echoue desormais au chargement du module
// (des que la route s'enregistre), pas seulement a la requete — meme logique
// que validerSecretDemarrage() pour JWT_SECRET : une erreur de configuration
// doit etre bruyante et immediate, jamais decouverte en production par un
// acces non autorise.
function exigerRole(canalEquivalent) {
  const rolesAutorises = CANAUX_RESTREINTS[canalEquivalent]
  if (!rolesAutorises) {
    throw new Error(`exigerRole('${canalEquivalent}') : canal inconnu de CANAUX_RESTREINTS — faute de frappe ou entree manquante dans core/services/permissionsService.js`)
  }
  return (req, res, next) => {
    if (!req.tenantContext) return res.status(401).json({ erreur: 'Authentification requise' })
    if (!rolesAutorises.includes(req.tenantContext.role)) {
      return res.status(403).json({ erreur: 'Action non autorisée pour votre rôle.' })
    }
    next()
  }
}

module.exports = { exigerRole }
