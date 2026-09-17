const express = require('express')
const domaineService = require('../../../core/services/domaineService')
const { authentifier } = require('../middleware/authentification')
const { exigerRole } = require('../middleware/rbac')
const { verifierAbonnement } = require('../middleware/subscriptionGate')
const { validerEntree, messageErreurSur } = require('../../../core/validation')

const router = express.Router()
router.use(authentifier)
router.use(verifierAbonnement)

// Doit rester en miroir exact de src/utils/domainConfig.js (DOMAINES) et de
// dao/DomaineDAO.js (getCategoriesByDomaine) — restauration et btp existaient
// deja cote frontend mais etaient absents ici, ce qui bloquait leur sauvegarde.
const TYPES_DOMAINE = ['informatique', 'alimentaire', 'quincaillerie', 'textile', 'chaussures', 'restauration', 'btp', 'general']

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
