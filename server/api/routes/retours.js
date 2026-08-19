const express = require('express')
const retoursService = require('../../../core/services/retoursService')
const { authentifier } = require('../middleware/authentification')
const { verifierAbonnement } = require('../middleware/subscriptionGate')

const router = express.Router()
router.use(authentifier)
router.use(verifierAbonnement)

router.get('/', async (req, res) => {
  res.json(await retoursService.getAll(req.tenantContext.organisationId))
})
router.get('/pendants', async (req, res) => {
  res.json(await retoursService.getPendants(req.tenantContext.organisationId))
})
router.post('/', async (req, res) => {
  try {
    res.status(201).json(await retoursService.create(req.body || {}, req.tenantContext.organisationId))
  } catch (e) {
    res.status(400).json({ erreur: e.message })
  }
})
router.put('/:id/approuver', async (req, res) => {
  res.json(await retoursService.approuver(req.params.id, req.body?.approuvePar, req.tenantContext.organisationId))
})
router.put('/:id/rejeter', async (req, res) => {
  res.json(await retoursService.rejeter(req.params.id, req.body?.approuvePar, req.tenantContext.organisationId))
})

module.exports = router
