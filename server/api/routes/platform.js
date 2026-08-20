// Sprint 19 — console Platform Admin. Namespace /platform entièrement séparé
// de /auth (organisation) : /platform/auth/login n'a rien à voir avec
// /auth/login, ce sont deux systèmes d'authentification distincts qui ne se
// recoupent jamais. Toutes les routes de gestion (statut, abonnement) sont
// journalisées dans audit_logs_plateforme.
const express = require('express')
const platformTokenService = require('../auth/platformTokenService')
const organisationsService = require('../../../core/services/organisationsService')
const abonnementsService = require('../../../core/services/abonnementsService')
const auditLogPlateformeService = require('../../../core/services/auditLogPlateformeService')
const { authentifierPlateforme } = require('../middleware/authentifierPlateforme')
const { creerLimiteur } = require('../middleware/rateLimiter')

const limiterConnexionPlateforme = creerLimiteur({ maxTentatives: 5 })
// Audit de clôture — aucun rate limiter n'était appliqué sur cette route.
const limiterRefreshPlateforme = creerLimiteur({ maxTentatives: 20 })

const router = express.Router()

// ── Authentification Platform Admin (namespace propre, jamais /auth) ──────
router.post('/auth/login', limiterConnexionPlateforme, async (req, res) => {
  const { email, password } = req.body || {}
  if (!email || !password) return res.status(400).json({ erreur: 'Email et mot de passe requis' })
  const resultat = await platformTokenService.connexion(email, password)
  if (resultat.erreur) return res.status(401).json({ erreur: resultat.erreur })
  res.json(resultat.succes)
})

router.post('/auth/refresh', limiterRefreshPlateforme, async (req, res) => {
  const { refreshToken } = req.body || {}
  if (!refreshToken) return res.status(400).json({ erreur: 'refreshToken requis' })
  const resultat = await platformTokenService.rafraichir(refreshToken)
  if (resultat.erreur) return res.status(401).json({ erreur: resultat.erreur })
  res.json(resultat.succes)
})

router.post('/auth/logout', async (req, res) => {
  const { refreshToken } = req.body || {}
  if (refreshToken) await platformTokenService.deconnexion(refreshToken)
  res.json({ succes: true })
})

// ── Gestion des organisations (authentifierPlateforme appliqué route par
//    route, jamais en router.use() global : un chemin non défini sous
//    /platform/* — ex. /platform/auth/signup, qui n'existe pas — doit tomber
//    sur le 404 générique de app.js, pas être intercepté par ce gate avant
//    même qu'Express ait pu constater qu'aucune route ne correspond) ───────

router.get('/organisations', authentifierPlateforme, async (req, res) => {
  res.json(await organisationsService.getAllPourPlateforme())
})

router.put('/organisations/:id/statut', authentifierPlateforme, async (req, res) => {
  const { statut } = req.body || {}
  const resultat = await organisationsService.setStatut(req.params.id, statut)
  if (resultat.erreur) return res.status(400).json(resultat)
  await auditLogPlateformeService.journaliser({
    adminPlateformeId: req.platformAdmin.id, action: 'organisation:setStatut',
    organisationId: req.params.id, details: { statut }
  })
  res.json(resultat)
})

router.put('/organisations/:id/abonnement/plan', authentifierPlateforme, async (req, res) => {
  const { codePlan } = req.body || {}
  const resultat = await abonnementsService.changerPlan(req.params.id, codePlan)
  if (resultat.erreur) return res.status(400).json(resultat)
  await auditLogPlateformeService.journaliser({
    adminPlateformeId: req.platformAdmin.id, action: 'abonnement:changerPlan',
    organisationId: req.params.id, details: { codePlan }
  })
  res.json(resultat)
})

router.put('/organisations/:id/abonnement/statut', authentifierPlateforme, async (req, res) => {
  const { statut } = req.body || {}
  const resultat = await abonnementsService.changerStatut(req.params.id, statut)
  if (resultat.erreur) return res.status(400).json(resultat)
  await auditLogPlateformeService.journaliser({
    adminPlateformeId: req.platformAdmin.id, action: 'abonnement:changerStatut',
    organisationId: req.params.id, details: { statut }
  })
  res.json(resultat)
})

router.get('/organisations/:id/audit', authentifierPlateforme, async (req, res) => {
  res.json(await auditLogPlateformeService.getPourOrganisation(req.params.id))
})

module.exports = router
