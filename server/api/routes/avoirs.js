const express = require('express')
const avoirsService = require('../../../core/services/avoirsService')
const { authentifier } = require('../middleware/authentification')
const { verifierAbonnement } = require('../middleware/subscriptionGate')
const { validerEntree } = require('../../../core/validation')

const router = express.Router()
router.use(authentifier)
router.use(verifierAbonnement)

router.get('/', async (req, res) => {
  res.json(await avoirsService.getAll(req.tenantContext.organisationId))
})
router.get('/transactions', async (req, res) => {
  res.json(await avoirsService.getAllTransactions(req.tenantContext.organisationId))
})
router.get('/client/:clientId', async (req, res) => {
  res.json(await avoirsService.getByClient(req.params.clientId, req.tenantContext.organisationId))
})
router.get('/:id/transactions', async (req, res) => {
  res.json(await avoirsService.getTransactions(req.params.id, req.tenantContext.organisationId))
})
router.post('/', async (req, res) => {
  try {
    validerEntree(req.body, {
      client_id:       { required: true, type: 'number' },
      montant_initial: { type: 'number', min: 0 }
    })
    res.status(201).json(await avoirsService.creerCompte(req.body || {}, req.tenantContext.organisationId))
  } catch (e) {
    res.status(400).json({ erreur: e.message })
  }
})
router.post('/:id/recharger', async (req, res) => {
  try {
    validerEntree(req.body, { montant: { required: true, type: 'number', min: 0 } })
    res.json(await avoirsService.recharger({ ...req.body, avoir_id: req.params.id }, req.tenantContext.organisationId))
  } catch (e) {
    res.status(400).json({ erreur: e.message })
  }
})
router.post('/:id/achat', async (req, res) => {
  try {
    validerEntree(req.body, { montant: { required: true, type: 'number', min: 0 } })
    res.json(await avoirsService.enregistrerAchat({ ...req.body, avoir_id: req.params.id }, req.tenantContext.organisationId))
  } catch (e) {
    res.status(400).json({ erreur: e.message })
  }
})
router.put('/:id/cloturer', async (req, res) => {
  res.json(await avoirsService.cloturerCompte(req.params.id, req.tenantContext.organisationId))
})
router.delete('/:id', async (req, res) => {
  res.json(await avoirsService.delete(req.params.id, req.tenantContext.organisationId))
})

module.exports = router
