// Chantier PayDunya — point d'entree public (PAS d'authentifier : PayDunya
// appelle ce point serveur-a-serveur, jamais un utilisateur connecte).
// Toujours repondre 200, meme en cas d'erreur interne : un 4xx/5xx ferait
// boucler PayDunya en retentatives sur une erreur qui nous appartient,
// pas la sienne. Les erreurs sont journalisees pour investigation.
const express = require('express')
const paydunyaService = require('../../../core/services/paydunyaService')
const logger = require('../lib/logger')

const router = express.Router()

router.post('/paydunya', async (req, res) => {
  // TEMPORAIRE — le hash recu ne correspond pas a sha512(master_key) alors
  // que la meme formule marche sur la reponse de /checkout-invoice/confirm ;
  // le corps reel du webhook (par opposition a la reponse de confirmation)
  // n'a jamais ete observe directement. A retirer une fois la vraie forme
  // confirmee.
  logger.info('webhook_paydunya_corps_brut', { corps: req.body })
  try {
    const resultat = await paydunyaService.traiterWebhook(req.body)
    logger.info('webhook_paydunya_traite', resultat)
  } catch (e) {
    logger.erreur('webhook_paydunya_echec', { message: e.message })
  }
  res.sendStatus(200)
})

module.exports = router
