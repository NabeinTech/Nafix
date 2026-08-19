// Sprint 15 — module pilote : /clients. Réutilise core/services/clientsService.js
// tel quel (aucune modification). organisationId provient exclusivement de
// req.tenantContext (dérivé du token vérifié par le middleware authentifier) —
// jamais de req.body/req.query, même si le client en fournit un : toute
// valeur "organisationId" éventuellement présente dans la requête est
// silencieusement ignorée par construction (les appels ci-dessous ne la
// lisent jamais).
const express = require('express')
const clientsService = require('../../../core/services/clientsService')
const { authentifier } = require('../middleware/authentification')
const { verifierAbonnement } = require('../middleware/subscriptionGate')

const router = express.Router()
router.use(authentifier)
router.use(verifierAbonnement)

router.get('/', async (req, res) => {
  const clients = await clientsService.getAll(req.tenantContext.organisationId)
  res.json(clients)
})

router.post('/', async (req, res) => {
  const resultat = await clientsService.create(req.body || {}, req.tenantContext.organisationId)
  if (resultat?.erreur) return res.status(400).json(resultat)
  res.status(201).json(resultat)
})

router.put('/:id', async (req, res) => {
  const resultat = await clientsService.update({ ...req.body, id: req.params.id }, req.tenantContext.organisationId)
  res.json(resultat)
})

router.delete('/:id', async (req, res) => {
  const resultat = await clientsService.delete(req.params.id, req.tenantContext.organisationId)
  res.json(resultat)
})

module.exports = router
