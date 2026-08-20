const express = require('express')
const achatsService = require('../../../core/services/achatsService')
const { authentifier } = require('../middleware/authentification')
const { verifierAbonnement } = require('../middleware/subscriptionGate')
const { validerEntree } = require('../../../core/validation')

const router = express.Router()
router.use(authentifier)
router.use(verifierAbonnement)

router.get('/', async (req, res) => {
  res.json(await achatsService.getAll(req.tenantContext.organisationId))
})
router.post('/', async (req, res) => {
  try {
    validerEntree(req.body, {
      montant_total: { required: true, type: 'number', min: 0 },
      panier:        { required: true, type: 'string' }
    })
    res.status(201).json(await achatsService.create(req.body || {}, req.tenantContext.organisationId))
  } catch (e) {
    res.status(400).json({ erreur: e.message })
  }
})
router.put('/:id', async (req, res) => {
  try {
    validerEntree(req.body, {
      montant_paye: { required: true, type: 'number', min: 0 },
      montant_du:   { required: true, type: 'number', min: 0 },
      statut:       { required: true, type: 'string' }
    })
    res.json(await achatsService.update({ ...req.body, id: req.params.id }, req.tenantContext.organisationId))
  } catch (e) {
    res.status(400).json({ erreur: e.message })
  }
})
router.put('/:id/etape', async (req, res) => {
  try {
    validerEntree(req.body, { etape: { required: true, type: 'string' } })
    res.json(await achatsService.changerEtape(req.params.id, req.body?.etape, req.tenantContext.organisationId))
  } catch (e) {
    res.status(400).json({ erreur: e.message })
  }
})
router.delete('/:id', async (req, res) => {
  res.json(await achatsService.delete(req.params.id, req.tenantContext.organisationId))
})

module.exports = router
