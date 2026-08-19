const express = require('express')
const ventesService = require('../../../core/services/ventesService')
const { authentifier } = require('../middleware/authentification')
const { verifierAbonnement } = require('../middleware/subscriptionGate')

const router = express.Router()
router.use(authentifier)
router.use(verifierAbonnement)

router.get('/', async (req, res) => {
  res.json(await ventesService.getAll(req.tenantContext.organisationId))
})
router.post('/', async (req, res) => {
  try {
    res.status(201).json(await ventesService.create(req.body || {}, req.tenantContext.organisationId))
  } catch (e) {
    res.status(400).json({ erreur: e.message })
  }
})
// Mise à jour partielle (montant_paye/montant_du/est_pret)
router.put('/:id', async (req, res) => {
  res.json(await ventesService.update({ ...req.body, id: req.params.id }, req.tenantContext.organisationId))
})
// Mise à jour complète (panier, client, etc. — recalcule le stock)
router.put('/:id/complet', async (req, res) => {
  try {
    res.json(await ventesService.fullUpdate({ ...req.body, id: req.params.id }, req.tenantContext.organisationId))
  } catch (e) {
    res.status(400).json({ erreur: e.message })
  }
})
router.delete('/:id', async (req, res) => {
  res.json(await ventesService.delete(req.params.id, req.tenantContext.organisationId))
})

module.exports = router
