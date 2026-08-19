const express = require('express')
const statistiquesService = require('../../../core/services/statistiquesService')
const { authentifier } = require('../middleware/authentification')
const { verifierAbonnement } = require('../middleware/subscriptionGate')

const router = express.Router()
router.use(authentifier)
router.use(verifierAbonnement)

router.get('/', async (req, res) => {
  res.json(await statistiquesService.getAll(req.tenantContext.organisationId))
})

module.exports = router
