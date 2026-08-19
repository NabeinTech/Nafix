// Sprint 15 — assemblage de l'app Express. Exporte creerApp() plutôt que de
// démarrer un serveur directement, pour rester testable (app.listen(0) dans
// les tests, port réel dans server.js).
// Sprint 16 — généralisation du pattern à l'ensemble des modules métier :
// chaque route ci-dessous est un adaptateur mince au-dessus du service
// existant correspondant (core/services/*), strictement inchangé.
const path = require('path')
const express = require('express')
const authRoutes = require('./routes/auth')
const platformRoutes = require('./routes/platform')
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
  app.set('trust proxy', false)
  app.use(express.json())

  app.get('/health', (req, res) => res.json({ ok: true }))

  // Sprint 17 — page publique d'inscription (statique, aucune dépendance
  // externe, servie directement par Express). Appelle POST /auth/signup
  // ci-dessous en relatif, donc fonctionne sans configuration supplémentaire
  // quel que soit le domaine/port réel de déploiement.
  app.use(express.static(path.join(__dirname, 'public')))

  app.use('/auth', authRoutes)
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
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error('Erreur API:', err.message)
    res.status(500).json({ erreur: 'Erreur interne' })
  })

  return app
}

module.exports = { creerApp }
