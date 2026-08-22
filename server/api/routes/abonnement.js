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
const paydunyaService = require('../../../core/services/paydunyaService')
const { authentifier } = require('../middleware/authentification')
const { exigerRole } = require('../middleware/rbac')

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

// Chantier PayDunya — cree une facture de paiement et renvoie l'URL de
// checkout hebergee vers laquelle rediriger. N'ecrit jamais abonnements.statut
// elle-meme (voir l'en-tete du fichier) : seul le webhook PayDunya, verifie
// serveur-a-serveur, a ce pouvoir.
router.post('/payer', exigerRole('abonnement:payer'), async (req, res) => {
  const abonnement = await abonnementsService.getByOrganisation(req.tenantContext.organisationId)
  // "essai_gratuit" coute 0 FCFA — jamais un plan a payer en soi. Sans choix
  // explicite du client, "passer au payant" doit basculer vers un vrai plan
  // payant (standard), pas re-facturer l'essai lui-meme.
  const codePlan = req.body?.codePlan || (abonnement?.plan_code === 'essai_gratuit' ? 'standard' : abonnement?.plan_code)
  const resultat = await paydunyaService.creerFacture(req.tenantContext.organisationId, codePlan)
  if (resultat.erreur) return res.status(400).json(resultat)
  res.json(resultat.succes)
})

module.exports = router
