const express = require('express')
const produitsService = require('../../../core/services/produitsService')
const { authentifier } = require('../middleware/authentification')
const { verifierAbonnement } = require('../middleware/subscriptionGate')
const { validerEntree, messageErreurSur } = require('../../../core/validation')

const router = express.Router()
router.use(authentifier)
router.use(verifierAbonnement)

router.get('/', async (req, res) => {
  res.json(await produitsService.getAll(req.tenantContext.organisationId))
})
router.post('/', async (req, res) => {
  try {
    validerEntree(req.body, {
      nom:          { required: true, type: 'string', maxLen: 300 },
      prix_vente:   { required: true, type: 'number', min: 0 },
      stock_actuel: { type: 'number', min: 0 }
    })
    const resultat = await produitsService.create(req.body || {}, req.tenantContext.organisationId)
    if (resultat?.erreur) return res.status(400).json(resultat)
    res.status(201).json(resultat)
  } catch (e) {
    res.status(400).json({ erreur: messageErreurSur(e) })
  }
})
router.put('/:id', async (req, res) => {
  try {
    validerEntree(req.body, {
      nom:        { required: true, type: 'string', maxLen: 300 },
      prix_vente: { required: true, type: 'number', min: 0 }
    })
    res.json(await produitsService.update({ ...req.body, id: req.params.id }, req.tenantContext.organisationId))
  } catch (e) {
    res.status(400).json({ erreur: messageErreurSur(e) })
  }
})
router.delete('/:id', async (req, res) => {
  res.json(await produitsService.delete(req.params.id, req.tenantContext.organisationId))
})

module.exports = router
