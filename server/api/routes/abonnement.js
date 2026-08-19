// Sprint 18 — consultation du statut d'abonnement. Volontairement PAS
// protégée par verifierAbonnement (l'utilisateur doit pouvoir voir pourquoi
// il est bloqué), uniquement par authentifier. Aucune route de changement de
// plan/statut ici : accorder à un administrateur d'organisation le pouvoir de
// changer son propre statut de facturation reviendrait à le laisser
// s'auto-accorder l'accès (contournement trivial du billing) — ce pouvoir
// n'appartient qu'à un futur Platform Admin (Sprint 19) ou, pour l'instant,
// à une intervention manuelle côté opérateur (changerPlan/changerStatut
// existent déjà dans abonnementsService, prêts à être branchés).
const express = require('express')
const abonnementsService = require('../../../core/services/abonnementsService')
const { authentifier } = require('../middleware/authentification')

const router = express.Router()
router.use(authentifier)

router.get('/', async (req, res) => {
  const abonnement = await abonnementsService.getByOrganisation(req.tenantContext.organisationId)
  res.json({
    ...abonnement,
    accesAutorise: abonnementsService.accesAutorise(abonnement)
  })
})

router.get('/plans', async (req, res) => {
  res.json(await abonnementsService.getPlans())
})

module.exports = router
