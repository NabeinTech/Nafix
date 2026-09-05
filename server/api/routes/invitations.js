// Chantier invitations d'equipe — point d'entree public (comme /auth/signup) :
// l'invite n'a par definition aucun compte, donc aucune authentification
// possible a ce stade. Jamais de gate d'abonnement non plus (accepter une
// invitation ne doit pas etre bloque par le statut de facturation de
// l'organisation qui invite).
const express = require('express')
const tokenService = require('../auth/tokenService')
const invitationsService = require('../../../core/services/invitationsService')
const { creerLimiteur } = require('../middleware/rateLimiter')
const { validerEntree, messageErreurSur } = require('../../../core/validation')

// Meme echecFerme que limiterSignup (auth.js) : creation de compte, la
// protection anti-bruteforce EST la defense primaire ici.
const limiterAccepter = creerLimiteur({ nom: 'invitations:accepter', maxTentatives: 10, echecFerme: true })

const router = express.Router()

// Apercu (page d'acceptation, avant soumission du formulaire) — lecture
// seule, ne marque jamais l'invitation comme utilisee.
router.get('/:token', async (req, res) => {
  const resultat = await invitationsService.getApercu(req.params.token)
  if (resultat.erreur) return res.status(400).json(resultat)
  res.json(resultat.succes)
})

router.post('/accepter', limiterAccepter, async (req, res) => {
  try {
    validerEntree(req.body, {
      token:    { required: true, type: 'string', maxLen: 128 },
      nom:      { required: true, type: 'string', maxLen: 100 },
      username: { required: true, type: 'string', maxLen: 100 },
      password: { required: true, type: 'string', maxLen: 200 }
    })
    // validerEntree n'a pas d'option minLen — meme controle manuel que
    // POST /auth/signup.
    if (req.body.password.length < 6) {
      return res.status(400).json({ erreur: 'Le mot de passe doit contenir au moins 6 caractères' })
    }
    const resultat = await invitationsService.accepter(req.body.token, {
      nom: req.body.nom, username: req.body.username, password: req.body.password
    })
    if (resultat.erreur) return res.status(400).json(resultat)

    // Auto-connexion — meme principe que POST /auth/signup, evite de faire
    // ressaisir le mot de passe qui vient d'etre choisi.
    const connexion = await tokenService.connexion(resultat.succes.username, req.body.password)
    if (connexion.erreur) return res.status(500).json({ erreur: connexion.erreur })
    res.status(201).json(connexion.succes)
  } catch (e) {
    res.status(400).json({ erreur: messageErreurSur(e) })
  }
})

module.exports = router
