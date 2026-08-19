const express = require('express')
const produitsService = require('../../../core/services/produitsService')
const { authentifier } = require('../middleware/authentification')
const { verifierAbonnement } = require('../middleware/subscriptionGate')

const router = express.Router()
router.use(authentifier)
router.use(verifierAbonnement)

router.get('/', async (req, res) => {
  res.json(await produitsService.getAll(req.tenantContext.organisationId))
})
router.post('/', async (req, res) => {
  const resultat = await produitsService.create(req.body || {}, req.tenantContext.organisationId)
  if (resultat?.erreur) return res.status(400).json(resultat)
  res.status(201).json(resultat)
})
router.put('/:id', async (req, res) => {
  res.json(await produitsService.update({ ...req.body, id: req.params.id }, req.tenantContext.organisationId))
})
router.delete('/:id', async (req, res) => {
  res.json(await produitsService.delete(req.params.id, req.tenantContext.organisationId))
})

module.exports = router
