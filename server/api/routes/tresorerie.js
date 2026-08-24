const express = require('express')
const tresorerieService = require('../../../core/services/tresorerieService')
const { authentifier } = require('../middleware/authentification')
const { verifierAbonnement } = require('../middleware/subscriptionGate')
const { validerEntree, messageErreurSur } = require('../../../core/validation')

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
  try {
    validerEntree(req.body, {
      type:    { required: true, type: 'string', enum: ['entree', 'sortie', 'recette', 'depense'] },
      montant: { required: true, type: 'number', min: 0 }
    })
    res.status(201).json(await tresorerieService.create(req.body || {}, req.tenantContext.organisationId))
  } catch (e) {
    res.status(400).json({ erreur: messageErreurSur(e) })
  }
})
router.post('/cloturer', async (req, res) => {
  try {
    validerEntree(req.body, {
      date:        { required: true, type: 'string' },
      cloturePar:  { required: true, type: 'string', maxLen: 200 }
    })
    const { date, cloturePar, notes } = req.body || {}
    res.json(await tresorerieService.cloturer(date, cloturePar, notes, req.tenantContext.organisationId))
  } catch (e) {
    res.status(400).json({ erreur: messageErreurSur(e) })
  }
})
router.put('/:id', async (req, res) => {
  try {
    validerEntree(req.body, {
      type:    { required: true, type: 'string', enum: ['entree', 'sortie', 'recette', 'depense'] },
      montant: { required: true, type: 'number', min: 0 }
    })
    res.json(await tresorerieService.update({ ...req.body, id: req.params.id }, req.tenantContext.organisationId))
  } catch (e) {
    res.status(400).json({ erreur: messageErreurSur(e) })
  }
})
router.delete('/:id', async (req, res) => {
  res.json(await tresorerieService.delete(req.params.id, req.tenantContext.organisationId))
})

module.exports = router
