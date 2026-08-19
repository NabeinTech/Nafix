const express = require('express')
const dashboardService = require('../../../core/services/dashboardService')
const { authentifier } = require('../middleware/authentification')
const { verifierAbonnement } = require('../middleware/subscriptionGate')

const router = express.Router()
router.use(authentifier)
router.use(verifierAbonnement)

router.get('/', async (req, res) => {
  res.json(await dashboardService.getAll(req.tenantContext.organisationId))
})

module.exports = router
