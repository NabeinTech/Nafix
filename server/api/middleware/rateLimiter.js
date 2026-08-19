// Sprint 15 — limiteur de tentatives minimal, en mémoire, par IP. Suffisant
// pour un MVP à faible volume (pas de Redis — choix déjà tranché à l'audit
// Sprint 13 : "infrastructure la plus simple capable de supporter le MVP").
// À remplacer par une solution partagée entre process si l'API tourne un
// jour derrière plusieurs instances.
//
// Sprint 17 — transformé en fabrique pour donner à chaque route sensible son
// propre compteur indépendant (signup plus restrictif que login, par
// exemple) : un pic de tentatives sur l'une ne doit jamais consommer le
// budget de l'autre.
function creerLimiteur({ fenetreMs = 15 * 60 * 1000, maxTentatives = 10 } = {}) {
  const tentatives = new Map()
  return function limiter(req, res, next) {
    const ip = req.ip
    const maintenant = Date.now()
    const entree = tentatives.get(ip) || { compte: 0, depuis: maintenant }
    if (maintenant - entree.depuis > fenetreMs) {
      entree.compte = 0
      entree.depuis = maintenant
    }
    entree.compte++
    tentatives.set(ip, entree)
    if (entree.compte > maxTentatives) {
      return res.status(429).json({ erreur: 'Trop de tentatives, réessayez plus tard' })
    }
    next()
  }
}

module.exports = { creerLimiteur }
