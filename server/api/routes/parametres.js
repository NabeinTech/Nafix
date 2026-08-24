const express = require('express')
const parametresService = require('../../../core/services/parametresService')
const { authentifier } = require('../middleware/authentification')
const { exigerRole } = require('../middleware/rbac')
const { verifierAbonnement } = require('../middleware/subscriptionGate')
const { validerEntree, messageErreurSur } = require('../../../core/validation')

const router = express.Router()
router.use(authentifier)
router.use(verifierAbonnement)

router.get('/', async (req, res) => {
  res.json(await parametresService.get(req.tenantContext.organisationId))
})
router.post('/', exigerRole('parametres:save'), async (req, res) => {
  try {
    // Tous les champs sont optionnels côté base (aucune contrainte NOT NULL) —
    // on ne valide que le type quand un champ est fourni, pas sa présence.
    validerEntree(req.body, {
      nom_entreprise:       { type: 'string', maxLen: 200 },
      slogan:               { type: 'string', maxLen: 200 },
      telephone:            { type: 'string', maxLen: 50 },
      telephone_secondaire: { type: 'string', maxLen: 50 },
      email:                { type: 'string', maxLen: 200 },
      adresse:              { type: 'string', maxLen: 500 },
      registre_commerce:    { type: 'string', maxLen: 100 },
      ninea:                { type: 'string', maxLen: 100 },
      mention_facture:      { type: 'string', maxLen: 500 }
    })
    res.json(await parametresService.save(req.body || {}, req.tenantContext.organisationId))
  } catch (e) {
    res.status(400).json({ erreur: messageErreurSur(e) })
  }
})
router.post('/reinitialiser', exigerRole('db:reinitialiser'), async (req, res) => {
  try {
    validerEntree(req.body, {
      ventes:       { type: 'boolean' },
      tresorerie:   { type: 'boolean' },
      clients:      { type: 'boolean' },
      produits:     { type: 'boolean' },
      fournisseurs: { type: 'boolean' },
      retours:      { type: 'boolean' },
      commandes:    { type: 'boolean' }
    })
    res.json(await parametresService.reinitialiser(req.body || {}, req.tenantContext.organisationId))
  } catch (e) {
    res.status(400).json({ erreur: messageErreurSur(e) })
  }
})

module.exports = router
