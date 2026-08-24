const express = require('express')
const commandesService = require('../../../core/services/commandesService')
const { authentifier } = require('../middleware/authentification')
const { verifierAbonnement } = require('../middleware/subscriptionGate')
const { validerEntree, messageErreurSur } = require('../../../core/validation')

const router = express.Router()
router.use(authentifier)
router.use(verifierAbonnement)

router.get('/', async (req, res) => {
  res.json(await commandesService.getAll(req.tenantContext.organisationId))
})
router.get('/alertes', async (req, res) => {
  res.json(await commandesService.getAlertes(req.tenantContext.organisationId))
})
router.get('/calendrier/:annee/:mois', async (req, res) => {
  res.json(await commandesService.getCalendrier(req.params.annee, req.params.mois, req.tenantContext.organisationId))
})
router.post('/', async (req, res) => {
  try {
    validerEntree(req.body, { client_nom: { required: true, type: 'string', maxLen: 200 } })
    res.status(201).json(await commandesService.create(req.body || {}, req.tenantContext.organisationId))
  } catch (e) {
    res.status(400).json({ erreur: messageErreurSur(e) })
  }
})
router.put('/:id/statut', async (req, res) => {
  try {
    validerEntree(req.body, { statut: { required: true, type: 'string' } })
    res.json(await commandesService.changerStatut(req.params.id, req.body?.statut, req.tenantContext.organisationId))
  } catch (e) {
    res.status(400).json({ erreur: messageErreurSur(e) })
  }
})
router.put('/:id/priorite', async (req, res) => {
  try {
    validerEntree(req.body, { priorite: { required: true, type: 'string' } })
    res.json(await commandesService.setPriorite(req.params.id, req.body?.priorite, req.tenantContext.organisationId))
  } catch (e) {
    res.status(400).json({ erreur: messageErreurSur(e) })
  }
})
router.put('/:id/livraison', async (req, res) => {
  try {
    validerEntree(req.body, { date: { required: true, type: 'string' } })
    res.json(await commandesService.setDateLivraison(req.params.id, req.body?.date, req.tenantContext.organisationId))
  } catch (e) {
    res.status(400).json({ erreur: messageErreurSur(e) })
  }
})
router.delete('/:id', async (req, res) => {
  res.json(await commandesService.delete(req.params.id, req.tenantContext.organisationId))
})

module.exports = router
