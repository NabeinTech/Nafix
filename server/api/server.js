// Sprint 15 — point d'entrée du process API SaaS, hors Electron. Démarré
// séparément du Desktop (npm run api), jamais par main.js.
// Sprint 20 — même discipline que main.js côté Desktop ("aucune exception ne
// doit plus disparaître silencieusement") : aucun des deux gestionnaires
// ci-dessous n'existait avant ce sprint pour le process API. Volontairement
// ici (server.js), pas dans app.js — les tests instancient creerApp()
// plusieurs fois par processus ; y poser des process.on(...) accumulerait
// des listeners et déclencherait des avertissements Node à chaque rejeu.
const { creerApp } = require('./app')
const pool = require('../../db/pool')
const logger = require('./lib/logger')

// Audit de clôture — logguer sans quitter laissait le process continuer à
// servir des requêtes dans un état non garanti (pool PG potentiellement
// incohérent), exactement le risque documenté par Node lui-même. On quitte
// immédiatement (pas de tentative d'arrêt propre : après une exception non
// interceptée, serveur.close()/pool.end() pourraient eux-mêmes ne jamais
// aboutir) — un superviseur de process (systemd/Docker) doit redémarrer.
process.on('uncaughtException', (err) => {
  logger.erreur('uncaughtException', { message: err.message, stack: err.stack })
  // setImmediate plutôt qu'un exit direct : sur POSIX, l'écriture stderr vers
  // un pipe (cas Docker/systemd) est asynchrone — sortir immédiatement après
  // logger.erreur() risquerait de tronquer ce dernier message, celui qui
  // explique justement pourquoi le process s'arrête.
  process.exitCode = 1
  setImmediate(() => process.exit(1))
})
process.on('unhandledRejection', (raison) => {
  const err = raison instanceof Error ? raison : new Error(String(raison))
  logger.erreur('unhandledRejection', { message: err.message, stack: err.stack })
})

const PORT = process.env.PORT || 3001
const app = creerApp()

const serveur = app.listen(PORT, () => {
  logger.info('api_demarree', { port: PORT })
})

// Arrêt propre — libère le pool PostgreSQL avant de quitter plutôt que de
// laisser des connexions traînantes lors d'un redéploiement/redémarrage.
function arreterProprement(signal) {
  logger.info('api_arret_demande', { signal })
  serveur.close(async () => {
    await pool.end()
    process.exit(0)
  })
}
process.on('SIGTERM', () => arreterProprement('SIGTERM'))
process.on('SIGINT', () => arreterProprement('SIGINT'))
