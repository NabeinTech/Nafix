// Chantier web-shim — équivalent HTTP de organisations:getMine/update
// (main.js:1006-1020). Fichier séparé de auth.js à dessein : auth.js n'a
// délibérément aucun authentifier global (toutes ses routes sont pré-session),
// alors que getMine/update sont des opérations d'un utilisateur déjà connecté.
// organisations:creerAvecAdmin n'a besoin d'aucune route ici : elle mappe
// directement sur POST /auth/signup, déjà en place.
const express = require('express')
const organisationsService = require('../../../core/services/organisationsService')
const { authentifier } = require('../middleware/authentification')
const { verifierAbonnement } = require('../middleware/subscriptionGate')
const { exigerRole } = require('../middleware/rbac')
const { validerEntree, messageErreurSur } = require('../../../core/validation')

const router = express.Router()
router.use(authentifier)
// Pas de verifierAbonnement global : GET /mine doit rester consultable même
// abonnement bloqué, même exception que getOrganisationIdActive({ignorerAbonnement:true})
// côté desktop — sinon un utilisateur bloqué ne peut plus voir le nom de sa
// propre organisation dans Paramètres pour comprendre sa situation.

router.get('/mine', async (req, res) => {
  res.json(await organisationsService.getById(req.tenantContext.organisationId))
})

router.put('/', verifierAbonnement, exigerRole('organisations:update'), async (req, res) => {
  try {
    validerEntree(req.body, { nom: { required: true, type: 'string', maxLen: 200 } })
    res.json(await organisationsService.update(req.tenantContext.organisationId, { nom: req.body.nom }))
  } catch (e) {
    res.status(400).json({ erreur: messageErreurSur(e) })
  }
})

module.exports = router
