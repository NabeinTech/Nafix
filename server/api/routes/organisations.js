// Chantier web-shim — équivalent HTTP de organisations:getMine/update
// (main.js:1006-1020). Fichier séparé de auth.js à dessein : auth.js n'a
// délibérément aucun authentifier global (toutes ses routes sont pré-session),
// alors que getMine/update sont des opérations d'un utilisateur déjà connecté.
// organisations:creerAvecAdmin n'a besoin d'aucune route ici : elle mappe
// directement sur POST /auth/signup, déjà en place.
const express = require('express')
const organisationsService = require('../../../core/services/organisationsService')
const exportDonneesService = require('../../../core/services/exportDonneesService')
const UtilisateursDAO = require('../../../dao/UtilisateursDAO')
const AuthService = require('../../../auth/AuthService')
const { authentifier } = require('../middleware/authentification')
const { verifierAbonnement } = require('../middleware/subscriptionGate')
const { exigerRole } = require('../middleware/rbac')
const { validerEntree, messageErreurSur } = require('../../../core/validation')

const router = express.Router()
router.use(authentifier)
// Pas de verifierAbonnement global : GET /mine doit rester consultable même
// abonnement bloqué, même exception que getOrganisationIdActive({ignorerAbonnement:true})
// côté desktop — sinon un utilisateur bloqué ne peut plus voir le nom de sa
// propre organisation dans Paramètres pour comprendre sa situation.

router.get('/mine', async (req, res) => {
  res.json(await organisationsService.getById(req.tenantContext.organisationId))
})

router.put('/', verifierAbonnement, exigerRole('organisations:update'), async (req, res) => {
  try {
    validerEntree(req.body, { nom: { required: true, type: 'string', maxLen: 200 } })
    res.json(await organisationsService.update(req.tenantContext.organisationId, { nom: req.body.nom }))
  } catch (e) {
    res.status(400).json({ erreur: messageErreurSur(e) })
  }
})

// Gap web-shim comble — equivalent HTTP de organisations:creerOrganisation
// (main.js:1148), jamais expose jusqu'ici (le bouton "Creer une nouvelle
// organisation" plantait reellement sur le SaaS, aucune route ni canal).
// Franchise/multi-boutique : un administrateur deja connecte cree une
// organisation totalement independante, sans jamais obtenir d'acces dessus
// (aucun changement de session ici, meme principe que main.js). verifierAbonnement
// s'applique a l'organisation DU CREATEUR (via req.tenantContext, deja
// verifiee par le middleware) -- empeche un administrateur suspendu de
// s'echapper de sa propre suspension en creant indefiniment de nouvelles
// organisations avec un essai gratuit neuf.
router.post('/', verifierAbonnement, exigerRole('organisations:creerOrganisation'), async (req, res) => {
  try {
    validerEntree(req.body, {
      nom:      { required: true, type: 'string', maxLen: 200 },
      adminNom: { required: true, type: 'string', maxLen: 100 },
      username: { required: true, type: 'string', maxLen: 100 },
      password: { required: true, type: 'string', maxLen: 200 }
    })
    if (req.body.password.length < 6) {
      return res.status(400).json({ erreur: 'Le mot de passe doit contenir au moins 6 caractères' })
    }
    const resultat = await organisationsService.creerAvecAdmin(req.body)
    if (resultat.erreur) return res.status(400).json(resultat)
    res.status(201).json({ succes: { organisation: resultat.succes.organisation, utilisateur: resultat.succes.utilisateur } })
  } catch (e) {
    res.status(400).json({ erreur: messageErreurSur(e) })
  }
})

// Gap web-shim comble — equivalent HTTP de organisations:setStatut
// (main.js:1107), jamais expose jusqu'ici (le bouton "Desactiver
// l'organisation" de Parametres.js echouait reellement sur le SaaS). Pas de
// verifierAbonnement : une organisation deja bloquee doit pouvoir se
// reactiver elle-meme si l'administrateur le decide.
router.put('/statut', exigerRole('organisations:setStatut'), async (req, res) => {
  try {
    validerEntree(req.body, { statut: { required: true, type: 'string', enum: ['active', 'inactive'] } })
    const resultat = await organisationsService.setStatut(req.tenantContext.organisationId, req.body.statut)
    if (resultat.erreur) return res.status(400).json(resultat)
    res.json(resultat)
  } catch (e) {
    res.status(400).json({ erreur: messageErreurSur(e) })
  }
})

// Chantier RGPD — export complet, en JSON, des donnees de l'organisation
// connectee. Pas de verifierAbonnement : le droit de recuperer ses propres
// donnees ne doit jamais dependre du statut de facturation.
router.get('/export', exigerRole('organisations:update'), async (req, res) => {
  const donnees = await exportDonneesService.exporterTout(req.tenantContext.organisationId)
  res.setHeader('Content-Disposition', `attachment; filename="nafix-export-${req.tenantContext.organisationId}.json"`)
  res.json(donnees)
})

// Chantier RGPD — demande de suppression de compte, self-service. Jamais de
// suppression definitive automatique (voir OrganisationsDAO.demanderSuppression) :
// coupe l'acces immediatement (meme mecanisme que la desactivation manuelle),
// la suppression reelle des donnees reste une action manuelle du Platform
// Admin, une fois la demande visible cote plateforme. Re-confirmation par mot
// de passe exigee avant une action de cette gravite -- un jeton d'acces seul
// (valide ~15 min, potentiellement laisse ouvert sur un poste partage) ne
// suffit pas pour un geste de cette portee.
router.post('/demander-suppression', exigerRole('organisations:setStatut'), async (req, res) => {
  try {
    validerEntree(req.body, { password: { required: true, type: 'string', maxLen: 200 } })
    const utilisateur = await UtilisateursDAO.getByIdAvecPassword(req.tenantContext.userId, req.tenantContext.organisationId)
    const motDePasseOk = utilisateur && await AuthService.verifyPassword(req.body.password, utilisateur.password)
    if (!motDePasseOk) return res.status(400).json({ erreur: 'Mot de passe incorrect' })

    const resultat = await organisationsService.demanderSuppression(req.tenantContext.organisationId)
    res.json(resultat)
  } catch (e) {
    res.status(400).json({ erreur: messageErreurSur(e) })
  }
})

router.post('/annuler-suppression', exigerRole('organisations:setStatut'), async (req, res) => {
  const resultat = await organisationsService.annulerSuppression(req.tenantContext.organisationId)
  res.json(resultat)
})

module.exports = router
