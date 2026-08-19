const express = require('express')
const devisService = require('../../../core/services/devisService')
const { authentifier } = require('../middleware/authentification')
const { verifierAbonnement } = require('../middleware/subscriptionGate')

const router = express.Router()
router.use(authentifier)
router.use(verifierAbonnement)

router.get('/', async (req, res) => {
  res.json(await devisService.getAll(req.tenantContext.organisationId))
})
router.post('/', async (req, res) => {
  try {
    res.status(201).json(await devisService.create(req.body || {}, req.tenantContext.organisationId))
  } catch (e) {
    res.status(400).json({ erreur: e.message })
  }
})
router.put('/:id/statut', async (req, res) => {
  res.json(await devisService.updateStatut(req.params.id, req.body?.statut, req.tenantContext.organisationId))
})
router.post('/convertir', async (req, res) => {
  try {
    res.status(201).json(await devisService.convertir(req.body || {}, req.tenantContext.organisationId))
  } catch (e) {
    res.status(400).json({ erreur: e.message })
  }
})

module.exports = router
