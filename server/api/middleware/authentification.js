// Sprint 15 — middleware Express : vérifie l'access token (Authorization:
// Bearer <token>), attache req.tenantContext. Réutilise tokenService.js et
// tenantContext.js (Sprint 14) tels quels, sans aucune modification.
const { verifierAccessToken } = require('../auth/tokenService')
const { extraireTenantContext } = require('./tenantContext')

function authentifier(req, res, next) {
  const entete = req.headers.authorization || ''
  const [type, token] = entete.split(' ')
  if (type !== 'Bearer' || !token) {
    return res.status(401).json({ erreur: 'Authentification requise' })
  }
  try {
    const payload = verifierAccessToken(token)
    req.tenantContext = extraireTenantContext(payload)
    next()
  } catch (e) {
    return res.status(401).json({ erreur: 'Token invalide ou expiré' })
  }
}

module.exports = { authentifier }
