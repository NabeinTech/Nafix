const express = require('express')
const fournisseursService = require('../../../core/services/fournisseursService')
const { authentifier } = require('../middleware/authentification')
const { verifierAbonnement } = require('../middleware/subscriptionGate')
const { validerEntree, messageErreurSur } = require('../../../core/validation')

const router = express.Router()
router.use(authentifier)
router.use(verifierAbonnement)

router.get('/', async (req, res) => {
  res.json(await fournisseursService.getAll(req.tenantContext.organisationId))
})
router.post('/', async (req, res) => {
  try {
    validerEntree(req.body, { nom: { required: true, type: 'string', maxLen: 200 } })
    res.status(201).json(await fournisseursService.create(req.body || {}, req.tenantContext.organisationId))
  } catch (e) {
    res.status(400).json({ erreur: messageErreurSur(e) })
  }
})
router.put('/:id', async (req, res) => {
  try {
    validerEntree(req.body, { nom: { required: true, type: 'string', maxLen: 200 } })
    res.json(await fournisseursService.update({ ...req.body, id: req.params.id }, req.tenantContext.organisationId))
  } catch (e) {
    res.status(400).json({ erreur: messageErreurSur(e) })
  }
})
router.delete('/:id', async (req, res) => {
  res.json(await fournisseursService.delete(req.params.id, req.tenantContext.organisationId))
})

module.exports = router
