// Sprint 19 — vérifie un token Platform Admin (type: 'platform'), attache
// req.platformAdmin. Structurellement distinct de authentification.js (org) :
// verifierAccessToken() de platformTokenService.js rejette tout token qui
// n'a pas type==='platform' — un token org, même valide, échoue ici. Et
// réciproquement, authentifier() (org) rejette tout token type!=='access' —
// un token plateforme échoue sur les routes métier. Aucun chevauchement.
const { verifierAccessToken } = require('../auth/platformTokenService')

function authentifierPlateforme(req, res, next) {
  const entete = req.headers.authorization || ''
  const [type, token] = entete.split(' ')
  if (type !== 'Bearer' || !token) {
    return res.status(401).json({ erreur: 'Authentification plateforme requise' })
  }
  try {
    const payload = verifierAccessToken(token)
    req.platformAdmin = { id: payload.sub }
    next()
  } catch (e) {
    return res.status(401).json({ erreur: 'Token invalide ou expiré' })
  }
}

module.exports = { authentifierPlateforme }
