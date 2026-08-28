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
const runMigrations = require('../../db/migrate')

// Audit de clôture — jusqu'ici, JWT_SECRET absent/vide n'était détecté qu'au
// premier login (tokenService.getSecret() lève, capturé par le handler
// d'erreur générique -> 500 muet côté client). Sur un vrai déploiement, une
// variable d'environnement oubliée doit bloquer le démarrage, pas se
// découvrir en production au premier utilisateur qui essaie de se connecter.
// Longueur minimale de 16 caractères : pas une contrainte cryptographique
// stricte, juste de quoi rejeter une valeur manifestement invalide/placeholder
// ("secret", "1234"...) sans être plus restrictif que ce que le projet a
// jamais documenté ou testé.
function validerSecretDemarrage() {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.trim().length < 16) {
    logger.erreur('demarrage_refuse', { raison: 'JWT_SECRET manquant, vide ou trop court (minimum 16 caractères)' })
    console.error('❌ JWT_SECRET manquant, vide ou trop court (minimum 16 caractères) — l\'API refuse de démarrer.')
    process.exit(1)
  }
}
validerSecretDemarrage()

// Audit de clôture — logguer sans quitter laissait le process continuer à
// servir des requêtes dans un état non garanti (pool PG potentiellement
// incohérent), exactement le risque documenté par Node lui-même. On quitte
// immédiatement (pas de tentative d'arrêt propre : après une exception non
// interceptée, serveur.close()/pool.end() pourraient eux-mêmes ne jamais
// aboutir) — un superviseur de process (systemd/Docker) doit redémarrer.
// Post-MVP — même traitement pour unhandledRejection : une promesse rejetée
// jamais interceptée signale un bug tout aussi grave (une opération a
// échoué silencieusement), pas une catégorie à part qu'on tolérerait.
function arreterSurErreurFatale(type, err) {
  logger.erreur(type, { message: err.message, stack: err.stack })
  // setImmediate plutôt qu'un exit direct : sur POSIX, l'écriture stderr vers
  // un pipe (cas Docker/systemd) est asynchrone — sortir immédiatement après
  // logger.erreur() risquerait de tronquer ce dernier message, celui qui
  // explique justement pourquoi le process s'arrête.
  process.exitCode = 1
  setImmediate(() => process.exit(1))
}
process.on('uncaughtException', (err) => arreterSurErreurFatale('uncaughtException', err))
process.on('unhandledRejection', (raison) => {
  arreterSurErreurFatale('unhandledRejection', raison instanceof Error ? raison : new Error(String(raison)))
})

const PORT = process.env.PORT || 3001

// Audit de clôture — jusqu'ici, seul main.js (Desktop) exécutait les
// migrations au démarrage ; le process API démarrait directement contre une
// base supposée déjà migrée. Un déploiement SaaS pur (API seule contre un
// PostgreSQL cloud neuf, sans jamais lancer Electron dessus) n'obtenait donc
// jamais son schéma. runMigrations() est le même script idempotent que
// main.js utilise déjà (rejouable sans effet de bord sur une base à jour) —
// voir db/migrate.js pour la garde process.versions.electron qui évite d'y
// créer un compte admin par défaut dans ce contexte API.
//
// Volontairement NON bloquant pour app.listen() : si la base est injoignable
// au démarrage (ex. redémarrage réseau, PostgreSQL pas encore prêt), le
// serveur HTTP doit quand même démarrer et laisser GET /health rapporter un
// 503 propre (comportement Sprint 20, déjà testé) plutôt que de faire
// planter tout le process — un superviseur externe verrait alors un
// crash-loop plutôt qu'un état "démarré mais dégradé" diagnostiquable.
runMigrations()
  .then(() => {
    logger.info('migrations_ok')
    // Synchronise abonnements.statut pour les essais dont la date est
    // depassee (voir core/services/expirationEssaiJob.js — l'acces est deja
    // bloque a la volee sans ce job, purement cosmetique pour Platform
    // Admin). Demarre seulement apres confirmation que la table existe
    // (migrations appliquees), un premier cycle immediat puis toutes les
    // heures.
    require('../../core/services/expirationEssaiJob').demarrer()
    // Chantier emails transactionnels — relance les administrateurs dont
    // l'essai approche de sa fin (voir core/services/relanceEssaiJob.js).
    require('../../core/services/relanceEssaiJob').demarrer()
  })
  .catch(err => logger.erreur('migrations_echouees', { message: err.message, stack: err.stack }))

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
