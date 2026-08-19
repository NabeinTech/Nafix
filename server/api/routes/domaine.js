const express = require('express')
const domaineService = require('../../../core/services/domaineService')
const { authentifier } = require('../middleware/authentification')
const { exigerRole } = require('../middleware/rbac')
const { verifierAbonnement } = require('../middleware/subscriptionGate')

const router = express.Router()
router.use(authentifier)
router.use(verifierAbonnement)

router.get('/', async (req, res) => {
  res.json(await domaineService.get(req.tenantContext.organisationId))
})
router.post('/', exigerRole('domaine:save'), async (req, res) => {
  res.json(await domaineService.save(req.body || {}, req.tenantContext.organisationId))
})

module.exports = router
