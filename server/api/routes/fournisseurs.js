const express = require('express')
const fournisseursService = require('../../../core/services/fournisseursService')
const { authentifier } = require('../middleware/authentification')
const { verifierAbonnement } = require('../middleware/subscriptionGate')

const router = express.Router()
router.use(authentifier)
router.use(verifierAbonnement)

router.get('/', async (req, res) => {
  res.json(await fournisseursService.getAll(req.tenantContext.organisationId))
})
router.post('/', async (req, res) => {
  res.status(201).json(await fournisseursService.create(req.body || {}, req.tenantContext.organisationId))
})
router.put('/:id', async (req, res) => {
  res.json(await fournisseursService.update({ ...req.body, id: req.params.id }, req.tenantContext.organisationId))
})
router.delete('/:id', async (req, res) => {
  res.json(await fournisseursService.delete(req.params.id, req.tenantContext.organisationId))
})

module.exports = router
