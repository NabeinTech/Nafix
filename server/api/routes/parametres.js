const express = require('express')
const parametresService = require('../../../core/services/parametresService')
const { authentifier } = require('../middleware/authentification')
const { exigerRole } = require('../middleware/rbac')
const { verifierAbonnement } = require('../middleware/subscriptionGate')

const router = express.Router()
router.use(authentifier)
router.use(verifierAbonnement)

router.get('/', async (req, res) => {
  res.json(await parametresService.get(req.tenantContext.organisationId))
})
router.post('/', exigerRole('parametres:save'), async (req, res) => {
  res.json(await parametresService.save(req.body || {}, req.tenantContext.organisationId))
})
router.post('/reinitialiser', exigerRole('db:reinitialiser'), async (req, res) => {
  res.json(await parametresService.reinitialiser(req.body || {}, req.tenantContext.organisationId))
})

module.exports = router
