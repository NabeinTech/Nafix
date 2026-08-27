// Sprint 15 — limiteur de tentatives par IP.
// Sprint 17 — transformé en fabrique pour donner à chaque route sensible son
// propre compteur indépendant (signup plus restrictif que login, par
// exemple) : un pic de tentatives sur l'une ne doit jamais consommer le
// budget de l'autre.
//
// Validation finale pre-production — jusqu'ici stocké dans une Map en
// mémoire du process : un redémarrage (redéploiement Railway) remettait tous
// les compteurs à zéro, et une future 2e instance derrière un load balancer
// aurait eu son propre budget indépendant (contournement trivial : alterner
// entre instances). Bascule vers PostgreSQL — déjà la seule dépendance
// d'infrastructure du projet ("infrastructure la plus simple capable de
// supporter le MVP", décision actée à l'audit Sprint 13) plutôt que
// d'ajouter Redis pour ce seul besoin. Un compteur par (limiteur, ip),
// incrémenté par un UPSERT atomique en un aller-retour — la fenêtre glissante
// se réinitialise dans la même requête SQL, sans lecture-puis-écriture
// séparée qui recréerait la race condition que l'atomicité vise à éviter.
const pool = require('../../../db/pool')

function creerLimiteur({ nom, fenetreMs = 15 * 60 * 1000, maxTentatives = 10 }) {
  if (!nom) throw new Error('creerLimiteur({ nom }) : nom requis — sert de clé de partition dans la table partagee limites_tentatives')

  // Balayage périodique — même rôle que l'ancien setInterval sur la Map,
  // purge les lignes dont la fenêtre est expirée pour ce limiteur précis.
  // .unref() : ne doit jamais empêcher le process de s'arrêter proprement
  // (SIGTERM, tests).
  const balayage = setInterval(() => {
    pool.query(
      "DELETE FROM limites_tentatives WHERE limiteur = $1 AND now() - depuis > ($2::int * interval '1 millisecond')",
      [nom, fenetreMs]
    ).catch((e) => console.error(`Purge rate limiter (${nom}) échouée :`, e.message))
  }, fenetreMs)
  balayage.unref()

  async function limiter(req, res, next) {
    const ip = req.ip
    try {
      // UPSERT atomique : incrémente si la fenêtre est toujours valide,
      // repart à 1 si elle a expiré — un seul aller-retour, verrouillage de
      // ligne géré par Postgres lui-même (pas de lecture puis écriture
      // séparées, qui laisserait passer 2 requêtes concurrentes sur le même
      // compte avant qu'aucune n'ait commité).
      const { rows: [ligne] } = await pool.query(
        `INSERT INTO limites_tentatives (limiteur, cle, compte, depuis)
         VALUES ($1, $2, 1, now())
         ON CONFLICT (limiteur, cle) DO UPDATE SET
           compte = CASE WHEN now() - limites_tentatives.depuis > ($3::int * interval '1 millisecond')
                         THEN 1 ELSE limites_tentatives.compte + 1 END,
           depuis = CASE WHEN now() - limites_tentatives.depuis > ($3::int * interval '1 millisecond')
                         THEN now() ELSE limites_tentatives.depuis END
         RETURNING compte`,
        [nom, ip, fenetreMs]
      )
      if (ligne.compte > maxTentatives) {
        return res.status(429).json({ erreur: 'Trop de tentatives, réessayez plus tard' })
      }
      next()
    } catch (e) {
      // Échec ouvert plutôt que fermé : une panne PostgreSQL momentanée
      // bloque de toute façon la quasi-totalité de l'application (même
      // pool que tout le reste) — ne pas transformer un défaut de
      // disponibilité de la base en un blocage supplémentaire de la
      // protection anti-bruteforce elle-même.
      console.error(`Rate limiter (${nom}) échoué, requête autorisée par défaut :`, e.message)
      next()
    }
  }

  // Introspection pour les tests uniquement (aucun effet sur le comportement
  // de limitation lui-même).
  limiter.tailleInterne = async () => {
    const { rows: [r] } = await pool.query('SELECT count(*)::int AS n FROM limites_tentatives WHERE limiteur = $1', [nom])
    return r.n
  }
  return limiter
}

module.exports = { creerLimiteur }
