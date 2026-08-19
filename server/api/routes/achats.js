const express = require('express')
const achatsService = require('../../../core/services/achatsService')
const { authentifier } = require('../middleware/authentification')
const { verifierAbonnement } = require('../middleware/subscriptionGate')

const router = express.Router()
router.use(authentifier)
router.use(verifierAbonnement)

router.get('/', async (req, res) => {
  res.json(await achatsService.getAll(req.tenantContext.organisationId))
})
router.post('/', async (req, res) => {
  try {
    res.status(201).json(await achatsService.create(req.body || {}, req.tenantContext.organisationId))
  } catch (e) {
    res.status(400).json({ erreur: e.message })
  }
})
router.put('/:id', async (req, res) => {
  res.json(await achatsService.update({ ...req.body, id: req.params.id }, req.tenantContext.organisationId))
})
router.put('/:id/etape', async (req, res) => {
  res.json(await achatsService.changerEtape(req.params.id, req.body?.etape, req.tenantContext.organisationId))
})
router.delete('/:id', async (req, res) => {
  res.json(await achatsService.delete(req.params.id, req.tenantContext.organisationId))
})

module.exports = router
