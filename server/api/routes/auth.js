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
const passwordResetService = require('../../../core/services/passwordResetService')
const { creerLimiteur } = require('../middleware/rateLimiter')
const { validerEntree } = require('../../../core/validation')

const limiterConnexion = creerLimiteur({ maxTentatives: 10 })
const limiterSignup = creerLimiteur({ maxTentatives: 5 }) // plus restrictif : creation de compte, pas juste une tentative de connexion
// Budget large : un client légitime rafraîchit automatiquement toutes les
// ~15 min (durée de vie de l'access token), potentiellement pour plusieurs
// utilisateurs derrière la même IP (petit bureau) — mais reste borné pour
// éviter un flood applicatif sur cette route (audit de clôture, aucun
// rate limiter n'y était appliqué jusqu'ici).
const limiterRefresh = creerLimiteur({ maxTentatives: 30 })
const limiterMotDePasseOublie = creerLimiteur({ maxTentatives: 5 })
// Instance dediee, pas de partage avec limiterMotDePasseOublie : un
// utilisateur legitime demande un lien PUIS soumet son nouveau mot de passe
// (2 requetes, sur 2 routes differentes) — un seul compteur partage entre
// les deux routes ferait consommer le meme budget deux fois pour un usage
// parfaitement normal.
const limiterReinitialiser = creerLimiteur({ maxTentatives: 5 })

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

router.post('/refresh', limiterRefresh, async (req, res) => {
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
  // Audit onboarding — les checks manuels précédents (!champ) laissaient
  // passer des types non-string (ex. password numérique), ce qui faisait
  // échouer bcrypt plus loin avec un message technique peu clair ("Illegal
  // arguments"). Mêmes limites que validateIPC côté Desktop (main.js), pour
  // rester cohérent entre les deux points d'entrée d'inscription.
  try {
    validerEntree(req.body, {
      nom:      { required: true, type: 'string', maxLen: 200 },
      adminNom: { required: true, type: 'string', maxLen: 100 },
      username: { required: true, type: 'string', maxLen: 100 },
      password: { required: true, type: 'string', maxLen: 200 },
      email:    { type: 'email', maxLen: 200 }
    })
  } catch (e) {
    return res.status(400).json({ erreur: e.message })
  }
  const { nom, adminNom, username, password, email } = req.body
  if (password.length < 6) {
    return res.status(400).json({ erreur: 'Le mot de passe doit contenir au moins 6 caractères' })
  }

  const creation = await organisationsService.creerAvecAdmin({ nom, adminNom, username, password, email })
  if (creation.erreur) return res.status(400).json({ erreur: creation.erreur })

  // Auto-connexion — évite de faire ressaisir le mot de passe qui vient
  // d'être choisi (même principe que le flux desktop Sprint 11).
  const connexion = await tokenService.connexion(username, password)
  if (connexion.erreur) return res.status(500).json({ erreur: connexion.erreur })
  res.status(201).json(connexion.succes)
})

// Chantier mot de passe oublié — jamais d'information sur l'existence d'un
// compte (anti-énumération) : toujours {succes:true}, qu'un identifiant
// existe ou non, qu'un email soit envoyé ou non.
router.post('/mot-de-passe-oublie', limiterMotDePasseOublie, async (req, res) => {
  try {
    validerEntree(req.body, { identifiant: { required: true, type: 'string', maxLen: 150 } })
  } catch (e) {
    return res.status(400).json({ erreur: e.message })
  }
  res.json(await passwordResetService.demander(req.body.identifiant))
})

// Audit securite — seule route publique de auth.js sans limiteur (le token
// lui-meme, 256 bits aleatoires, rend un brute-force du token infaisable ;
// l'absence de limite reste neanmoins une incoherence avec toutes les
// routes soeurs et une charge base non bornee possible).
router.post('/reinitialiser-mot-de-passe', limiterReinitialiser, async (req, res) => {
  try {
    validerEntree(req.body, {
      token:    { required: true, type: 'string', maxLen: 200 },
      password: { required: true, type: 'string', maxLen: 200 }
    })
  } catch (e) {
    return res.status(400).json({ erreur: e.message })
  }
  if (req.body.password.length < 6) {
    return res.status(400).json({ erreur: 'Le mot de passe doit contenir au moins 6 caractères' })
  }
  const resultat = await passwordResetService.reinitialiser(req.body.token, req.body.password)
  if (resultat.erreur) return res.status(400).json(resultat)
  res.json(resultat)
})

module.exports = router
