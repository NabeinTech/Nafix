// Sprint 18 — bloque l'accès aux routes métier si l'abonnement de
// l'organisation n'autorise plus l'accès (essai expiré, suspendu, annulé).
// Appliqué après authentifier() (a besoin de req.tenantContext), jamais sur
// /auth/* ni sur /abonnement (l'utilisateur doit pouvoir consulter son
// statut même quand il est bloqué, pour savoir quoi faire).
const abonnementsService = require('../../../core/services/abonnementsService')

async function verifierAbonnement(req, res, next) {
  const abonnement = await abonnementsService.getByOrganisation(req.tenantContext.organisationId)
  if (!abonnementsService.accesAutorise(abonnement)) {
    return res.status(402).json({
      erreur: 'Abonnement inactif ou expiré. Contactez votre administrateur pour régulariser l\'abonnement.',
      statutAbonnement: abonnement?.statut || 'aucun'
    })
  }
  req.abonnement = abonnement
  next()
}

module.exports = { verifierAbonnement }
