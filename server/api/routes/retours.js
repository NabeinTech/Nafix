const express = require('express')
const retoursService = require('../../../core/services/retoursService')
const { authentifier } = require('../middleware/authentification')
const { verifierAbonnement } = require('../middleware/subscriptionGate')
const { validerEntree, messageErreurSur } = require('../../../core/validation')

const router = express.Router()
router.use(authentifier)
router.use(verifierAbonnement)

router.get('/', async (req, res) => {
  res.json(await retoursService.getAll(req.tenantContext.organisationId))
})
router.get('/pendants', async (req, res) => {
  res.json(await retoursService.getPendants(req.tenantContext.organisationId))
})
router.post('/', async (req, res) => {
  try {
    validerEntree(req.body, {
      // vente_id volontairement non requis : un retour générique (sans vente
      // d'origine) est un cas légitime préexistant (cf. correctif Sprint 10).
      montant_retour: { required: true, type: 'number', min: 0 },
      panier_retour:  { type: 'string' }
    })
    res.status(201).json(await retoursService.create(req.body || {}, req.tenantContext.organisationId))
  } catch (e) {
    res.status(400).json({ erreur: messageErreurSur(e) })
  }
})
router.put('/:id/approuver', async (req, res) => {
  try {
    validerEntree(req.body, { approuvePar: { required: true, type: 'string', maxLen: 200 } })
    res.json(await retoursService.approuver(req.params.id, req.body?.approuvePar, req.tenantContext.organisationId))
  } catch (e) {
    res.status(400).json({ erreur: messageErreurSur(e) })
  }
})
router.put('/:id/rejeter', async (req, res) => {
  try {
    validerEntree(req.body, { approuvePar: { required: true, type: 'string', maxLen: 200 } })
    res.json(await retoursService.rejeter(req.params.id, req.body?.approuvePar, req.tenantContext.organisationId))
  } catch (e) {
    res.status(400).json({ erreur: messageErreurSur(e) })
  }
})

module.exports = router
