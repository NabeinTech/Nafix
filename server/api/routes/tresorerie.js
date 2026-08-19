const express = require('express')
const tresorerieService = require('../../../core/services/tresorerieService')
const { authentifier } = require('../middleware/authentification')
const { verifierAbonnement } = require('../middleware/subscriptionGate')

const router = express.Router()
router.use(authentifier)
router.use(verifierAbonnement)

router.get('/', async (req, res) => {
  res.json(await tresorerieService.getAll(req.tenantContext.organisationId))
})
router.get('/stats', async (req, res) => {
  res.json(await tresorerieService.getStats(req.tenantContext.organisationId))
})
router.get('/clotures', async (req, res) => {
  res.json(await tresorerieService.getClotures(req.tenantContext.organisationId))
})
router.get('/rapport-cloture/:date', async (req, res) => {
  res.json(await tresorerieService.rapportCloture(req.params.date, req.tenantContext.organisationId))
})
router.post('/', async (req, res) => {
  res.status(201).json(await tresorerieService.create(req.body || {}, req.tenantContext.organisationId))
})
router.post('/cloturer', async (req, res) => {
  const { date, cloturePar, notes } = req.body || {}
  res.json(await tresorerieService.cloturer(date, cloturePar, notes, req.tenantContext.organisationId))
})
router.put('/:id', async (req, res) => {
  res.json(await tresorerieService.update({ ...req.body, id: req.params.id }, req.tenantContext.organisationId))
})
router.delete('/:id', async (req, res) => {
  res.json(await tresorerieService.delete(req.params.id, req.tenantContext.organisationId))
})

module.exports = router
