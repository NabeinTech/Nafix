const express = require('express')
const domaineService = require('../../../core/services/domaineService')
const { authentifier } = require('../middleware/authentification')
const { exigerRole } = require('../middleware/rbac')
const { verifierAbonnement } = require('../middleware/subscriptionGate')
const { validerEntree, messageErreurSur } = require('../../../core/validation')

const router = express.Router()
router.use(authentifier)
router.use(verifierAbonnement)

const TYPES_DOMAINE = ['informatique', 'alimentaire', 'quincaillerie', 'textile', 'general']

router.get('/', async (req, res) => {
  res.json(await domaineService.get(req.tenantContext.organisationId))
})
router.post('/', exigerRole('domaine:save'), async (req, res) => {
  try {
    validerEntree(req.body, {
      type: { required: true, type: 'string', enum: TYPES_DOMAINE },
      nom:  { required: true, type: 'string', maxLen: 200 }
    })
    res.json(await domaineService.save(req.body || {}, req.tenantContext.organisationId))
  } catch (e) {
    res.status(400).json({ erreur: messageErreurSur(e) })
  }
})

module.exports = router
