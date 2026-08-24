// Sprint 15 — assemblage de l'app Express. Exporte creerApp() plutôt que de
// démarrer un serveur directement, pour rester testable (app.listen(0) dans
// les tests, port réel dans server.js).
// Sprint 16 — généralisation du pattern à l'ensemble des modules métier :
// chaque route ci-dessous est un adaptateur mince au-dessus du service
// existant correspondant (core/services/*), strictement inchangé.
const path = require('path')
const express = require('express')
const pool = require('../../db/pool')
const logger = require('./lib/logger')
const authRoutes = require('./routes/auth')
const platformRoutes = require('./routes/platform')
const webhooksRoutes = require('./routes/webhooks')
const utilisateursRoutes = require('./routes/utilisateurs')
const organisationsRoutes = require('./routes/organisations')
const abonnementRoutes = require('./routes/abonnement')
const clientsRoutes = require('./routes/clients')
const produitsRoutes = require('./routes/produits')
const fournisseursRoutes = require('./routes/fournisseurs')
const ventesRoutes = require('./routes/ventes')
const devisRoutes = require('./routes/devis')
const achatsRoutes = require('./routes/achats')
const commandesRoutes = require('./routes/commandes')
const retoursRoutes = require('./routes/retours')
const avoirsRoutes = require('./routes/avoirs')
const tresorerieRoutes = require('./routes/tresorerie')
const categoriesRoutes = require('./routes/categories')
const domaineRoutes = require('./routes/domaine')
const parametresRoutes = require('./routes/parametres')
const dashboardRoutes = require('./routes/dashboard')
const statistiquesRoutes = require('./routes/statistiques')

function creerApp() {
  const app = express()
  // Audit du 22/08/2026 — corrigé de `false` à `1` : le process tourne
  // derrière le proxy d'edge de Railway (un seul saut entre l'internet public
  // et ce container). Avec `false`, req.ip valait l'adresse interne du proxy
  // pour TOUTES les requêtes — le limiteur de tentatives (rateLimiter.js,
  // indexé sur req.ip) se retrouvait donc à partager un unique compteur entre
  // tous les utilisateurs au lieu d'un compteur par IP réelle, sur /auth/*
  // notamment. `1` fait confiance au premier X-Forwarded-For (celui posé par
  // Railway) et rejette toute valeur au-delà — un client ne peut pas usurper
  // son IP en falsifiant l'en-tête lui-même.
  app.set('trust proxy', 1)
  app.use(express.json())
  // Chantier PayDunya — le webhook IPN reel envoie un corps
  // application/x-www-form-urlencoded (confirme en test live, cf.
  // server/api/routes/webhooks.js), jamais du JSON malgre ce que suggeraient
  // les recherches web initiales. express.json() seul laissait req.body vide
  // pour ces requetes precises.
  app.use(express.urlencoded({ extended: true }))

  // Audit du 22/08/2026 — en-têtes de sécurité de base, absents jusqu'ici.
  // Pas de dépendance (helmet) pour quatre en-têtes statiques — même
  // philosophie que emailService.js/paydunyaService.js (fetch natif plutôt
  // qu'un SDK pour un besoin simple). Pas de Content-Security-Policy ici :
  // le build React (app.js sert ../../build en statique) n'a pas été audité
  // pour une CSP stricte (scripts inline générés par webpack) — l'ajouter à
  // l'aveugle casserait l'app plutôt que de la protéger.
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains')
    next()
  })

  // Sprint 20 — une ligne structurée par requête (méthode, chemin, statut,
  // durée, tenant si authentifié) — traçabilité minimale sans dépendance
  // externe. req.tenantContext/req.platformAdmin ne sont posés qu'après les
  // middlewares d'authentification de chaque routeur ; on les lit ici après
  // coup (res.on('finish')), au moment où ils sont déjà disponibles.
  app.use((req, res, next) => {
    const debut = Date.now()
    res.on('finish', () => {
      logger.info('requete_http', {
        methode: req.method,
        chemin: req.originalUrl,
        statut: res.statusCode,
        dureeMs: Date.now() - debut,
        organisationId: req.tenantContext?.organisationId || null,
        platformAdminId: req.platformAdmin?.id || null
      })
    })
    next()
  })

  // Health check réel — vérifie que PostgreSQL répond, pas seulement que le
  // process Node est vivant (un "ok" qui ne veut rien dire n'aide personne
  // en astreinte). Échoue proprement (503) plutôt que de laisser un
  // health-check externe attendre un timeout.
  app.get('/health', async (req, res) => {
    try {
      await pool.query('SELECT 1')
      res.json({ ok: true, base: 'connectee' })
    } catch (err) {
      logger.erreur('health_check_echec', { message: err.message })
      res.status(503).json({ ok: false, base: 'injoignable' })
    }
  })

  // Sprint 17 — page publique d'inscription (statique, aucune dépendance
  // externe, servie directement par Express). Appelle POST /auth/signup
  // ci-dessous en relatif, donc fonctionne sans configuration supplémentaire
  // quel que soit le domaine/port réel de déploiement.
  app.use(express.static(path.join(__dirname, 'public')))

  // Chantier web-shim — build React (npm run build:web), servi tel quel.
  // src/App.js utilise HashRouter (toutes les "pages" sont "/" + "#/...") :
  // aucune route catch-all n'est nécessaire, express.static suffit.
  app.use(express.static(path.join(__dirname, '../../build')))

  app.use('/auth', authRoutes)
  // Chantier PayDunya — appele par PayDunya lui-meme (serveur-a-serveur),
  // jamais par un utilisateur : aucun middleware d'authentification.
  app.use('/webhooks', webhooksRoutes)
  app.use('/utilisateurs', utilisateursRoutes)
  app.use('/organisations', organisationsRoutes)
  // Sprint 19 — namespace entièrement séparé, sa propre authentification
  // (authentifierPlateforme, jamais authentifier), jamais soumis au gate
  // d'abonnement (un Platform Admin n'appartient à aucune organisation).
  app.use('/platform', platformRoutes)
  // Sprint 18 — volontairement AVANT le gate d'abonnement (ci-dessous, dans
  // chaque routeur métier) : un utilisateur bloqué doit pouvoir consulter
  // son statut pour savoir quoi faire, pas recevoir un 402 sur cette route
  // aussi.
  app.use('/abonnement', abonnementRoutes)
  app.use('/clients', clientsRoutes)
  app.use('/produits', produitsRoutes)
  app.use('/fournisseurs', fournisseursRoutes)
  app.use('/ventes', ventesRoutes)
  app.use('/devis', devisRoutes)
  app.use('/achats', achatsRoutes)
  app.use('/commandes', commandesRoutes)
  app.use('/retours', retoursRoutes)
  app.use('/avoirs', avoirsRoutes)
  app.use('/tresorerie', tresorerieRoutes)
  app.use('/categories', categoriesRoutes)
  app.use('/domaine', domaineRoutes)
  app.use('/parametres', parametresRoutes)
  app.use('/dashboard', dashboardRoutes)
  app.use('/statistiques', statistiquesRoutes)

  app.use((req, res) => {
    res.status(404).json({ erreur: 'Route inconnue' })
  })

  // Gestion d'erreur centralisée — ne jamais renvoyer une stack trace ou un
  // message d'erreur brut au client (cf. audit Sprint 13 §L, point "erreurs
  // API trop bavardes").
  // Audit onboarding — un corps JSON malformé (ex. depuis un client public
  // comme /auth/signup) était jusqu'ici classé en 500 "Erreur interne" alors
  // que c'est une erreur du client, pas du serveur. body-parser marque ce
  // genre d'erreur avec .status (4xx) et .expose=true — la même convention
  // que le gestionnaire d'erreur par défaut d'Express utilise pour décider
  // si le message est sûr à renvoyer tel quel. Tout le reste (5xx, ou sans
  // .expose) garde le comportement générique déjà en place.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    logger.erreur('erreur_non_geree', {
      message: err.message, stack: err.stack,
      methode: req.method, chemin: req.originalUrl,
      organisationId: req.tenantContext?.organisationId || null
    })
    const statut = err.status || err.statusCode
    if (err.expose && statut >= 400 && statut < 500) {
      return res.status(statut).json({ erreur: err.message })
    }
    res.status(500).json({ erreur: 'Erreur interne' })
  })

  return app
}

module.exports = { creerApp }
