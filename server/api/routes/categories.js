const express = require('express')
const categoriesService = require('../../../core/services/categoriesService')
const { authentifier } = require('../middleware/authentification')
const { verifierAbonnement } = require('../middleware/subscriptionGate')

const router = express.Router()
router.use(authentifier)
router.use(verifierAbonnement)

router.get('/', async (req, res) => {
  res.json(await categoriesService.getAll(req.tenantContext.organisationId))
})
router.post('/', async (req, res) => {
  res.status(201).json(await categoriesService.create(req.body || {}, req.tenantContext.organisationId))
})
router.put('/:id', async (req, res) => {
  res.json(await categoriesService.update({ ...req.body, id: req.params.id }, req.tenantContext.organisationId))
})
router.delete('/:id', async (req, res) => {
  res.json(await categoriesService.delete(req.params.id, req.tenantContext.organisationId))
})
router.post('/sous-categories', async (req, res) => {
  res.status(201).json(await categoriesService.createSousCategorie(req.body || {}, req.tenantContext.organisationId))
})
router.delete('/sous-categories/:id', async (req, res) => {
  res.json(await categoriesService.deleteSousCategorie(req.params.id, req.tenantContext.organisationId))
})

module.exports = router
