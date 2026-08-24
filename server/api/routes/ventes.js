const express = require('express')
const ventesService = require('../../../core/services/ventesService')
const { authentifier } = require('../middleware/authentification')
const { verifierAbonnement } = require('../middleware/subscriptionGate')
const { validerEntree, messageErreurSur } = require('../../../core/validation')

const router = express.Router()
router.use(authentifier)
router.use(verifierAbonnement)

const MODES_PAIEMENT = ['especes', 'wave', 'orange_money', 'cheque', 'pret', 'carte']

router.get('/', async (req, res) => {
  res.json(await ventesService.getAll(req.tenantContext.organisationId))
})
router.post('/', async (req, res) => {
  try {
    validerEntree(req.body, {
      montant_total: { required: true, type: 'number', min: 0 },
      montant_paye:  { type: 'number', min: 0 },
      montant_du:    { type: 'number', min: 0 },
      mode_paiement: { required: true, type: 'string', enum: MODES_PAIEMENT },
      panier:        { required: true, type: 'string' }
    })
    res.status(201).json(await ventesService.create(req.body || {}, req.tenantContext.organisationId))
  } catch (e) {
    res.status(400).json({ erreur: messageErreurSur(e) })
  }
})
// Mise à jour partielle (montant_paye/montant_du/est_pret)
router.put('/:id', async (req, res) => {
  try {
    validerEntree(req.body, {
      montant_paye: { required: true, type: 'number', min: 0 },
      montant_du:   { required: true, type: 'number', min: 0 }
    })
    res.json(await ventesService.update({ ...req.body, id: req.params.id }, req.tenantContext.organisationId))
  } catch (e) {
    res.status(400).json({ erreur: messageErreurSur(e) })
  }
})
// Mise à jour complète (panier, client, etc. — recalcule le stock)
router.put('/:id/complet', async (req, res) => {
  try {
    validerEntree(req.body, {
      montant_total: { required: true, type: 'number', min: 0 },
      montant_paye:  { type: 'number', min: 0 },
      montant_du:    { type: 'number', min: 0 },
      mode_paiement: { required: true, type: 'string', enum: MODES_PAIEMENT },
      panier:        { required: true, type: 'string' }
    })
    res.json(await ventesService.fullUpdate({ ...req.body, id: req.params.id }, req.tenantContext.organisationId))
  } catch (e) {
    res.status(400).json({ erreur: messageErreurSur(e) })
  }
})
router.delete('/:id', async (req, res) => {
  res.json(await ventesService.delete(req.params.id, req.tenantContext.organisationId))
})

module.exports = router
