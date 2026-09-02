const express = require('express')
const devisService = require('../../../core/services/devisService')
const { authentifier } = require('../middleware/authentification')
const { verifierAbonnement } = require('../middleware/subscriptionGate')
const { validerEntree, messageErreurSur } = require('../../../core/validation')

const router = express.Router()
router.use(authentifier)
router.use(verifierAbonnement)

router.get('/', async (req, res) => {
  res.json(await devisService.getAll(req.tenantContext.organisationId))
})
router.post('/', async (req, res) => {
  try {
    validerEntree(req.body, {
      montant_total: { required: true, type: 'number', min: 0 },
      panier:        { required: true, type: 'string' }
    })
    res.status(201).json(await devisService.create(req.body || {}, req.tenantContext.organisationId))
  } catch (e) {
    res.status(400).json({ erreur: messageErreurSur(e) })
  }
})
router.put('/:id/statut', async (req, res) => {
  try {
    validerEntree(req.body, { statut: { required: true, type: 'string' } })
    res.json(await devisService.updateStatut(req.params.id, req.body?.statut, req.tenantContext.organisationId))
  } catch (e) {
    res.status(400).json({ erreur: messageErreurSur(e) })
  }
})
router.put('/:id', async (req, res) => {
  try {
    validerEntree(req.body, {
      montant_total: { required: true, type: 'number', min: 0 },
      panier:        { required: true, type: 'string' }
    })
    res.json(await devisService.update({ ...req.body, id: req.params.id }, req.tenantContext.organisationId))
  } catch (e) {
    res.status(400).json({ erreur: messageErreurSur(e) })
  }
})
router.delete('/:id', async (req, res) => {
  res.json(await devisService.delete(req.params.id, req.tenantContext.organisationId))
})
router.post('/convertir', async (req, res) => {
  try {
    validerEntree(req.body, {
      devis_id:      { required: true, type: 'number' },
      montant_total: { required: true, type: 'number', min: 0 },
      panier:        { required: true, type: 'string' }
    })
    res.status(201).json(await devisService.convertir(req.body || {}, req.tenantContext.organisationId))
  } catch (e) {
    res.status(400).json({ erreur: messageErreurSur(e) })
  }
})

module.exports = router
