// Sprint 15 — routes /auth/login, /auth/refresh, /auth/logout. Adaptateurs
// minces au-dessus de tokenService.js (Sprint 14), inchangé.
// Sprint 17 — /auth/signup : onboarding self-service public (sans session),
// réutilise organisationsService.creerAvecAdmin (Sprint 11/12) et
// tokenService.connexion (Sprint 14) tels quels — aucune nouvelle logique
// métier, uniquement l'assemblage des deux pour auto-connecter le compte
// fraîchement créé (même principe que le flux desktop Sprint 11).
const express = require('express')
const tokenService = require('../auth/tokenService')
const organisationsService = require('../../../core/services/organisationsService')
const { creerLimiteur } = require('../middleware/rateLimiter')

const limiterConnexion = creerLimiteur({ maxTentatives: 10 })
const limiterSignup = creerLimiteur({ maxTentatives: 5 }) // plus restrictif : creation de compte, pas juste une tentative de connexion

const router = express.Router()

router.post('/login', limiterConnexion, async (req, res) => {
  const { username, password } = req.body || {}
  if (!username || !password) {
    return res.status(400).json({ erreur: 'Identifiant et mot de passe requis' })
  }
  const resultat = await tokenService.connexion(username, password)
  if (resultat.erreur) return res.status(401).json({ erreur: resultat.erreur })
  res.json(resultat.succes)
})

router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body || {}
  if (!refreshToken) return res.status(400).json({ erreur: 'refreshToken requis' })
  const resultat = await tokenService.rafraichir(refreshToken)
  if (resultat.erreur) return res.status(401).json({ erreur: resultat.erreur })
  res.json(resultat.succes)
})

router.post('/logout', async (req, res) => {
  const { refreshToken } = req.body || {}
  if (refreshToken) await tokenService.deconnexion(refreshToken)
  res.json({ succes: true })
})

router.post('/signup', limiterSignup, async (req, res) => {
  const { nom, adminNom, username, password } = req.body || {}
  if (!nom || !adminNom || !username || !password) {
    return res.status(400).json({ erreur: 'Tous les champs sont obligatoires' })
  }
  if (password.length < 6) {
    return res.status(400).json({ erreur: 'Le mot de passe doit contenir au moins 6 caractères' })
  }

  const creation = await organisationsService.creerAvecAdmin({ nom, adminNom, username, password })
  if (creation.erreur) return res.status(400).json({ erreur: creation.erreur })

  // Auto-connexion — évite de faire ressaisir le mot de passe qui vient
  // d'être choisi (même principe que le flux desktop Sprint 11).
  const connexion = await tokenService.connexion(username, password)
  if (connexion.erreur) return res.status(500).json({ erreur: connexion.erreur })
  res.status(201).json(connexion.succes)
})

module.exports = router
