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

  // Audit onboarding — les entrées n'étaient jamais retirées de la Map,
  // seulement réinitialisées en place à leur prochain accès : sur une route
  // publique comme /auth/signup (bien plus d'IP uniques au fil du temps que
  // /auth/login), la mémoire croît sans borne pour la durée de vie du
  // process. Balayage périodique des entrées dont la fenêtre est expirée et
  // qui n'ont pas été retouchées depuis — .unref() pour ne jamais empêcher
  // le process de s'arrêter proprement (SIGTERM, tests).
  const balayage = setInterval(() => {
    const maintenant = Date.now()
    for (const [ip, entree] of tentatives) {
      if (maintenant - entree.depuis > fenetreMs) tentatives.delete(ip)
    }
  }, fenetreMs)
  balayage.unref()

  function limiter(req, res, next) {
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
  // Introspection pour les tests uniquement (aucun effet sur le comportement
  // de limitation lui-même) — vérifier que la Map ne croît pas indéfiniment
  // nécessite de voir sa taille réelle, pas seulement le comportement du
  // compteur par IP (déjà correct avant ce correctif).
  limiter.tailleInterne = () => tentatives.size
  return limiter
}

module.exports = { creerLimiteur }
