// Job planifie — envoie un email de relance aux administrateurs d'une
// organisation dont l'essai gratuit approche de sa fin. Meme pattern que
// core/services/expirationEssaiJob.js (job sœur) : setInterval en process
// unref, un cycle immediat au demarrage puis toutes les heures, aucune
// infrastructure de planification externe justifiee.
const abonnementsService = require('./abonnementsService')
const UtilisateursDAO = require('../../dao/UtilisateursDAO')
const emailService = require('./emailService')

const JOURS_AVANT_RELANCE = 3

async function executerCycle() {
  const essais = await abonnementsService.getEssaisAExpirerBientot(JOURS_AVANT_RELANCE)
  for (const essai of essais) {
    const administrateurs = await UtilisateursDAO.getAdministrateursAvecEmail(essai.organisation_id)
    for (const admin of administrateurs) {
      const dateFin = new Date(essai.fin_essai_le).toLocaleDateString('fr-FR')
      // Fire-and-forget — un echec d'envoi ne doit jamais empecher de
      // marquer la relance comme traitee (voir marquerRelanceEnvoyee
      // ci-dessous : un seul essai, pas de retry storm si Resend est
      // indisponible).
      await emailService.envoyerEmail({
        to: admin.email,
        subject: 'Votre essai Nafix se termine bientôt',
        html: `<p>Bonjour ${admin.nom},</p>
               <p>La période d'essai gratuit de <strong>${essai.organisation_nom}</strong> se termine le <strong>${dateFin}</strong>.</p>
               <p>Passez à un abonnement payant dès maintenant pour ne pas perdre l'accès à Nafix.</p>`
      }).catch((e) => {
        console.error(`Échec envoi relance essai (organisation ${essai.organisation_id}) :`, e.message)
      })
    }
    // Marque comme traite meme si aucun administrateur n'a d'email (evite
    // de re-scanner cette organisation a chaque cycle) et meme si l'envoi a
    // echoue (un seul essai assume, coherent avec le reste du chantier).
    await abonnementsService.marquerRelanceEnvoyee(essai.organisation_id)
  }
  return essais.map(e => e.organisation_id)
}

function demarrer(intervalleMs = 60 * 60 * 1000) {
  executerCycle().catch((e) => console.error('Cycle relance essai echoue :', e.message))
  const minuteur = setInterval(() => {
    executerCycle().catch((e) => console.error('Cycle relance essai echoue :', e.message))
  }, intervalleMs)
  minuteur.unref()
  return minuteur
}

module.exports = { executerCycle, demarrer, JOURS_AVANT_RELANCE }
