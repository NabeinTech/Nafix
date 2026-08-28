// Job planifie — synchronise abonnements.statut pour les essais dont la
// date est depassee. Purement cosmetique pour le controle d'acces lui-meme
// (abonnementsService.accesAutorise() bloque deja a la volee des que
// fin_essai_le est depassee, avec ou sans ce job — voir son commentaire),
// mais necessaire pour que Platform Admin voie l'etat reel d'une
// organisation sans recalculer la date lui-meme.
//
// setInterval en process, meme pattern que la purge du rate limiter
// (server/api/middleware/rateLimiter.js) : aucune infrastructure de
// planification externe (cron Railway, service dedie) n'est justifiee pour
// une tache qui tolere une imprecision de l'ordre de l'heure.
const abonnementsService = require('./abonnementsService')
const auditLogPlateformeService = require('./auditLogPlateformeService')

async function executerCycle() {
  const organisationIds = await abonnementsService.expirerEssaisPasses()
  for (const organisationId of organisationIds) {
    // adminPlateformeId: null — declenche par le systeme, pas par un humain
    // (meme convention que paydunyaService.traiterWebhook pour les
    // changements automatiques d'abonnements.statut).
    await auditLogPlateformeService.journaliser({
      adminPlateformeId: null,
      action: 'abonnement:essaiExpire',
      organisationId,
      details: null
    }).catch((e) => console.error('Journalisation abonnement:essaiExpire echouee :', e.message))
  }
  return organisationIds
}

function demarrer(intervalleMs = 60 * 60 * 1000) {
  executerCycle().catch((e) => console.error('Cycle expiration essai echoue :', e.message))
  const minuteur = setInterval(() => {
    executerCycle().catch((e) => console.error('Cycle expiration essai echoue :', e.message))
  }, intervalleMs)
  // Ne doit jamais empecher le process de s'arreter proprement (SIGTERM, tests).
  minuteur.unref()
  return minuteur
}

module.exports = { executerCycle, demarrer }
